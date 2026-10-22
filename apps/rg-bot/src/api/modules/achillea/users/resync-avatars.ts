/**
 * `POST /users/resync-avatars` — réindexe pseudo, nom affiché et avatar de tous
 * les comptes Achilléa depuis Discord (Administrateur, en arrière-plan).
 *
 * Port de `UserService.resyncAvatars` et de `/owner resync-users` : par lots
 * de 10 identifiants, `GET /users/:id` sur l'API REST Discord avec le jeton de
 * l'application Achilléa, 1,5 s entre deux lots pour rester sous la limite de
 * débit. Les comptes que Discord ne connaît plus sont laissés tels quels.
 *
 * La réponse part tout de suite (`{ started: true }`) : le relevé dure une à
 * deux minutes. Un second appel pendant un relevé en cours rend
 * `{ started: false }` au lieu d'en lancer un deuxième.
 */
import { normalizeNames } from "@rosegriffon/achillea-core";
import { Elysia, status } from "elysia";
import type { Kysely } from "kysely";
import type { Database } from "@rosegriffon/db/schema";

import { dbPlugin } from "../../../plugins/db";
import { resolveAchilleaSession } from "../../auth/session";
import { restAchillea, type ResultatRest } from "../clans/discord";

export const TAILLE_LOT = 10;
export const PAUSE_ENTRE_LOTS_MS = 1500;
const ROLE_ADMIN = 2;

/** Utilisateur Discord, réduit aux champs relus. */
export interface UtilisateurDiscord {
  id: string;
  username: string;
  global_name?: string | null;
  avatar?: string | null;
}

/** URL d'avatar stockée : animé en `.gif`, sinon `.png`, avatar par défaut sinon. */
export function urlAvatar(utilisateur: UtilisateurDiscord): string {
  if (!utilisateur.avatar) {
    let index = 0;
    try {
      index = Number((BigInt(utilisateur.id) >> 22n) % 6n);
    } catch {
      index = 0;
    }
    return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
  }
  const extension = utilisateur.avatar.startsWith("a_") ? "gif" : "png";
  return `https://cdn.discordapp.com/avatars/${utilisateur.id}/${utilisateur.avatar}.${extension}?size=256`;
}

export function lots<T>(valeurs: readonly T[], taille: number): T[][] {
  const sortie: T[][] = [];
  for (let i = 0; i < valeurs.length; i += taille) sortie.push(valeurs.slice(i, i + taille));
  return sortie;
}

export interface DependancesResync {
  identifiants(): Promise<string[]>;
  lireDiscord(id: string): Promise<ResultatRest<UtilisateurDiscord>>;
  ecrire(id: string, champs: { username: string; displayName: string; avatar: string }): Promise<void>;
  pause(ms: number): Promise<void>;
}

/** Relevé complet. Rend le nombre de comptes mis à jour et ignorés. */
export async function resynchroniser(dep: DependancesResync): Promise<{ misAJour: number; ignores: number }> {
  let misAJour = 0;
  let ignores = 0;
  const paquets = lots(await dep.identifiants(), TAILLE_LOT);
  for (const [rang, paquet] of paquets.entries()) {
    const lus = await Promise.all(paquet.map(id => dep.lireDiscord(id)));
    for (const lu of lus) {
      if (!lu.ok) {
        ignores += 1;
        continue;
      }
      const u = lu.data;
      await dep.ecrire(u.id, { username: u.username, displayName: u.global_name || u.username, avatar: urlAvatar(u) });
      misAJour += 1;
    }
    if (rang < paquets.length - 1) await dep.pause(PAUSE_ENTRE_LOTS_MS);
  }
  return { misAJour, ignores };
}

export function dependancesKysely(db: Kysely<Database>): DependancesResync {
  return {
    async identifiants() {
      return (await db.selectFrom("user").select("id").execute()).map(l => l.id);
    },
    lireDiscord: id => restAchillea<UtilisateurDiscord>("GET", `/users/${id}`),
    async ecrire(id, champs) {
      await db
        .updateTable("user")
        .set({
          username: champs.username,
          display_name: champs.displayName,
          normalized_display_name: normalizeNames(champs.displayName),
          avatar: champs.avatar,
          updated_at: new Date(),
        })
        .where("id", "=", id)
        .execute();
    },
    pause: ms => Bun.sleep(ms),
  };
}

let releveEnCours: Promise<unknown> | null = null;

export function creerControleurResync(dependancesDe: (db: Kysely<Database>) => DependancesResync = dependancesKysely) {
  return new Elysia({ prefix: "/users" }).use(dbPlugin).post("/resync-avatars", async ({ db, headers }) => {
    const session = await resolveAchilleaSession(headers);
    if (!session) return status(401, { message: "Authentication required" });
    const acteur = await db.selectFrom("user").select("role").where("id", "=", session.id).executeTakeFirst();
    if ((acteur?.role ?? 0) < ROLE_ADMIN) return status(403, { message: "Réservé au staff" });
    if (releveEnCours) return { started: false };
    releveEnCours = resynchroniser(dependancesDe(db))
      .then(bilan => console.info(`[resync-avatars] ${bilan.misAJour} compte(s) à jour, ${bilan.ignores} ignoré(s)`))
      .catch(err => console.error("[resync-avatars]", err))
      .finally(() => {
        releveEnCours = null;
      });
    return { started: true };
  });
}

/** À monter dans `achilleaModule` AVANT `usersController` (sinon `/users/:id` n'est pas en cause : POST). */
export const resyncAvatarsController = creerControleurResync();
