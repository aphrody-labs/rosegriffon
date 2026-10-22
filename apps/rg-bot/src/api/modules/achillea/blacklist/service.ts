/**
 * Liste noire Achilléa — logique et accès base.
 *
 * Reprend `BlacklistCommand` / `BlacklistViewCommand` de l'ancien bot : une
 * ligne `blacklist` (motif, date) rattachée au joueur par `user.blacklist_id`.
 * La table réelle (`id` entier en série, `reason`, `vote_proposal_id`) diffère
 * du typage Kysely partagé : les requêtes passent donc par `sql` brut.
 *
 * La logique (`ajouter`, `retirer`) ne parle qu'à un `DepotListeNoire` : elle
 * se teste sans base, et les règles (administrateur requis, développeurs
 * protégés, doublons refusés) ne dépendent pas de Postgres.
 */
import { sql, type Kysely } from "kysely";
import type { Database } from "@rosegriffon/db/schema";

/** Rôle Achilléa minimal pour inscrire ou retirer un joueur (Administrateur). */
export const ROLE_ADMIN_LISTE_NOIRE = 2;

export interface EntreeListeNoire {
  userId: string;
  username: string | null;
  displayName: string;
  reason: string;
  since: string;
}

export interface DepotListeNoire {
  roleUtilisateur(userId: string): Promise<number | null>;
  joueur(userId: string): Promise<{ id: string; username: string | null; displayName: string } | null>;
  entree(userId: string): Promise<EntreeListeNoire | null>;
  lister(): Promise<EntreeListeNoire[]>;
  inscrire(userId: string, motif: string): Promise<EntreeListeNoire>;
  retirer(userId: string): Promise<boolean>;
}

type Ligne = {
  user_id: string;
  username: string | null;
  display_name: string;
  reason: string | null;
  created_at: Date | string;
};

function versEntree(ligne: Ligne): EntreeListeNoire {
  const date = ligne.created_at instanceof Date ? ligne.created_at : new Date(ligne.created_at);
  return {
    userId: ligne.user_id,
    username: ligne.username,
    displayName: ligne.display_name,
    reason: ligne.reason ?? "",
    since: date.toISOString(),
  };
}

export function depotKysely(db: Kysely<Database>): DepotListeNoire {
  const selection = sql<Ligne>`
    select u.id as user_id, u.username, u.display_name, b.reason, b.created_at
    from "user" u join blacklist b on b.id = u.blacklist_id`;
  return {
    async roleUtilisateur(userId) {
      const ligne = await db.selectFrom("user").select("role").where("id", "=", userId).executeTakeFirst();
      return ligne?.role ?? null;
    },
    async joueur(userId) {
      const ligne = await db
        .selectFrom("user")
        .select(["id", "username", "display_name"])
        .where("id", "=", userId)
        .executeTakeFirst();
      return ligne ? { id: ligne.id, username: ligne.username, displayName: ligne.display_name } : null;
    },
    async entree(userId) {
      const { rows } = await sql<Ligne>`${selection} where u.id = ${userId} limit 1`.execute(db);
      return rows[0] ? versEntree(rows[0]) : null;
    },
    async lister() {
      const { rows } = await sql<Ligne>`${selection} order by b.created_at desc`.execute(db);
      return rows.map(versEntree);
    },
    async inscrire(userId, motif) {
      return db.transaction().execute(async trx => {
        const { rows } = await sql<{ id: number }>`
          insert into blacklist (reason, created_at, updated_at) values (${motif}, now(), now()) returning id`.execute(trx);
        const id = rows[0]?.id;
        await sql`update "user" set blacklist_id = ${id}, updated_at = now() where id = ${userId}`.execute(trx);
        const lu = await sql<Ligne>`${selection} where u.id = ${userId} limit 1`.execute(trx);
        const ligne = lu.rows[0];
        if (!ligne) throw new Error(`Inscription de ${userId} sur la liste noire illisible après écriture.`);
        return versEntree(ligne);
      });
    },
    async retirer(userId) {
      return db.transaction().execute(async trx => {
        const { rows } = await sql<{ blacklist_id: number | null }>`
          select blacklist_id from "user" where id = ${userId} for update`.execute(trx);
        const id = rows[0]?.blacklist_id;
        if (id === null || id === undefined) return false;
        await sql`update "user" set blacklist_id = null, updated_at = now() where id = ${userId}`.execute(trx);
        await sql`delete from blacklist where id = ${id}`.execute(trx);
        return true;
      });
    },
  };
}

export type EchecListeNoire = { ok: false; statut: 400 | 403 | 404 | 409; message: string };
export type IssueListeNoire<T> = { ok: true; valeur: T } | EchecListeNoire;

const echec = (statut: EchecListeNoire["statut"], message: string): EchecListeNoire => ({ ok: false, statut, message });

async function exigerAdministrateur(depot: DepotListeNoire, acteurId: string): Promise<EchecListeNoire | null> {
  const role = await depot.roleUtilisateur(acteurId);
  return (role ?? 0) >= ROLE_ADMIN_LISTE_NOIRE ? null : echec(403, "Rôle Administrateur Achilléa requis.");
}

/** Inscrit un joueur. Les développeurs du bot sont protégés, comme dans l'ancien bot. */
export async function ajouterListeNoire(
  depot: DepotListeNoire,
  acteurId: string,
  cibleId: string,
  motif: string,
  developpeurs: readonly string[],
): Promise<IssueListeNoire<EntreeListeNoire>> {
  const refus = await exigerAdministrateur(depot, acteurId);
  if (refus) return refus;
  const raison = motif.trim();
  if (raison.length < 3) return echec(400, "Le motif doit faire au moins 3 caractères.");
  if (developpeurs.includes(cibleId)) return echec(403, "Impossible d'ajouter un développeur à la liste noire.");
  const joueur = await depot.joueur(cibleId);
  if (!joueur) return echec(404, "Ce joueur n'a pas de compte Achilléa (il ne s'est jamais connecté).");
  if (await depot.entree(cibleId)) return echec(409, `${joueur.displayName} est déjà sur la liste noire.`);
  return { ok: true, valeur: await depot.inscrire(cibleId, raison.slice(0, 500)) };
}

/** Retire un joueur de la liste noire. */
export async function retirerListeNoire(
  depot: DepotListeNoire,
  acteurId: string,
  cibleId: string,
): Promise<IssueListeNoire<{ userId: string }>> {
  const refus = await exigerAdministrateur(depot, acteurId);
  if (refus) return refus;
  if (!(await depot.joueur(cibleId))) return echec(404, "Ce joueur n'a pas de compte Achilléa.");
  if (!(await depot.retirer(cibleId))) return echec(404, "Ce joueur n'est pas sur la liste noire.");
  return { ok: true, valeur: { userId: cibleId } };
}
