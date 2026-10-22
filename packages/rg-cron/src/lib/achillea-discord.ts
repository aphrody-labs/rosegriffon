/**
 * Copyright 2026 Rose Griffon
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Discord REST avec le jeton de l'APPLICATION Achilléa, pour les tâches cron.
 *
 * Les tâches Achilléa écrivent sur le serveur Achilléa (rôles, salons, levée de
 * sanctions, annonces ranked) : c'est l'identité du bot Achilléa qui doit agir,
 * jamais celle du bot Rose Griffon (`lib/discord-rest.ts`). Aucune passerelle
 * n'est nécessaire : tout passe par l'API REST, donc la tâche tourne aussi bien
 * dans `rg-core` qu'en ligne de commande pendant que l'enfant `bot-achillea`
 * redémarre.
 *
 * Rien ici ne lève : chaque appel rend un `ResultatRest` que la tâche consigne
 * dans son bilan. Un salon supprimé ou des MP fermés sont des résultats, pas des
 * pannes de la tâche.
 */
import { ACHILLEA_GUILD_ID } from "@rosegriffon/types/discord";

export const API_DISCORD = "https://discord.com/api/v10";
const AGENT = "RoseGriffonCronAchillea (https://rosegriffon.fr/achillea, 1.0)";
const TENTATIVES_429 = 4;
const TENTATIVES_5XX = 2;

export type EnvAchillea = Record<string, string | undefined>;
export type MethodeRest = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
export type ResultatRest<T> = { ok: true; data: T } | { ok: false; statut: number | null; motif: string };

/** Message Discord réduit aux champs que les tâches émettent. */
export interface MessageDiscord {
  content?: string;
  embeds?: Array<Record<string, unknown>>;
  components?: Array<Record<string, unknown>>;
  /** Utilisateurs que le message a le droit de notifier (aucune mention sinon). */
  mentionsUtilisateurs?: readonly string[];
}

/** Jeton du bot Achilléa (`ACHILLEA_DISCORD_BOT_TOKEN`), `null` si absent ou non substitué. */
export function jetonBotAchillea(env: EnvAchillea = Bun.env): string | null {
  const jeton = (env.ACHILLEA_DISCORD_BOT_TOKEN ?? "").trim();
  return jeton === "" || jeton.startsWith("$") ? null : jeton;
}

function lire(env: EnvAchillea, cle: string, defaut: string): string {
  const valeur = (env[cle] ?? "").trim();
  return valeur === "" || valeur.startsWith("$") ? defaut : valeur;
}

/**
 * Identifiants du serveur central Achilléa (valeurs de production de l'ancien
 * bot, `legacy/achillea-bot/src/configs/general.ts`, surchargeables). Une chaîne
 * vide désactive l'intégration correspondante, comme dans l'ancien bot.
 */
export function configAchilleaCron(env: EnvAchillea = Bun.env) {
  return {
    guildeCentrale: lire(env, "ACHILLEA_CORE_GUILD_ID", ACHILLEA_GUILD_ID),
    roleCapitaine: lire(env, "ACHILLEA_CAPTAIN_ROLE_ID", "1398801292079403121"),
    salonAnnoncesClans: lire(env, "ACHILLEA_CLAN_ANNOUNCEMENTS_CHANNEL_ID", "1398801515694788719"),
    salonClassement: lire(env, "ACHILLEA_LEADERBOARD_CHANNEL_ID", "1398801522749477034"),
    salonFileRanked: lire(env, "ACHILLEA_RANKED_QUEUE_CHANNEL_ID", "1398801524179734528"),
    salonGeneralRanked: lire(env, "ACHILLEA_GENERAL_RANKED_CHANNEL_ID", "1398801536313983027"),
    salonAnnoncesRanked: lire(env, "ACHILLEA_RANKED_ANNOUNCEMENTS_CHANNEL_ID", "1398801521029943501"),
    // Pas de valeur de production dans l'ancien bot : sans salon, le récap staff est sauté.
    salonStaff: lire(env, "ACHILLEA_STAFF_CHANNEL_ID", ""),
    siteAchillea: lire(env, "ACHILLEA_WEBSITE_URL", "https://rosegriffon.fr/achillea").replace(/\/+$/u, ""),
  };
}

export type ConfigAchilleaCron = ReturnType<typeof configAchilleaCron>;

/** Accès Discord des tâches — interface pour que les tests la simulent. */
export interface PorteDiscordAchillea {
  rest<T = unknown>(methode: MethodeRest, chemin: string, corps?: unknown, raison?: string): Promise<ResultatRest<T>>;
}

/** Appel REST Discord avec le jeton Achilléa. Ne lève jamais. */
export async function restAchillea<T = unknown>(
  methode: MethodeRest,
  chemin: string,
  corps?: unknown,
  raison?: string,
  env: EnvAchillea = Bun.env,
  tentative = 0,
): Promise<ResultatRest<T>> {
  const jeton = jetonBotAchillea(env);
  if (!jeton) return { ok: false, statut: null, motif: "ACHILLEA_DISCORD_BOT_TOKEN absent" };
  try {
    const entetes: Record<string, string> = { Authorization: `Bot ${jeton}`, "User-Agent": AGENT };
    if (corps !== undefined) entetes["Content-Type"] = "application/json";
    if (raison) entetes["X-Audit-Log-Reason"] = encodeURIComponent(raison.slice(0, 400));
    const reponse = await fetch(`${API_DISCORD}${chemin}`, {
      method: methode,
      headers: entetes,
      body: corps === undefined ? undefined : JSON.stringify(corps),
      signal: AbortSignal.timeout(15_000),
    });
    if (reponse.status === 429 && tentative < TENTATIVES_429) {
      const attente = (await reponse.json().catch(() => ({}))) as { retry_after?: number };
      await Bun.sleep(Math.ceil((attente.retry_after ?? 1) * 1000) + 250);
      return restAchillea<T>(methode, chemin, corps, raison, env, tentative + 1);
    }
    if (reponse.status >= 500 && tentative < TENTATIVES_5XX) {
      await Bun.sleep(1000 * (tentative + 1));
      return restAchillea<T>(methode, chemin, corps, raison, env, tentative + 1);
    }
    if (!reponse.ok) {
      return { ok: false, statut: reponse.status, motif: (await reponse.text().catch(() => "")).slice(0, 200) };
    }
    const texte = await reponse.text();
    return { ok: true, data: (texte ? JSON.parse(texte) : null) as T };
  } catch (err) {
    return { ok: false, statut: null, motif: err instanceof Error ? err.message : String(err) };
  }
}

export const discordAchillea: PorteDiscordAchillea = {
  rest: (methode, chemin, corps, raison) => restAchillea(methode, chemin, corps, raison),
};

/** Corps JSON d'un message : mentions verrouillées sauf les utilisateurs nommés. */
export function corpsMessage(message: MessageDiscord): Record<string, unknown> {
  const { mentionsUtilisateurs, ...reste } = message;
  return {
    ...reste,
    allowed_mentions: { parse: [], users: [...(mentionsUtilisateurs ?? [])] },
  };
}

/** Publie dans un salon. */
export function publierSalon(
  discord: PorteDiscordAchillea,
  salonId: string,
  message: MessageDiscord,
): Promise<ResultatRest<{ id: string }>> {
  return discord.rest<{ id: string }>("POST", `/channels/${salonId}/messages`, corpsMessage(message));
}

/** Message privé. Les MP fermés (403, code 50007) remontent en échec, à l'appelant de trancher. */
export async function envoyerMp(
  discord: PorteDiscordAchillea,
  utilisateurId: string,
  message: MessageDiscord,
): Promise<ResultatRest<{ id: string }>> {
  const canal = await discord.rest<{ id: string }>("POST", "/users/@me/channels", { recipient_id: utilisateurId });
  if (!canal.ok) return canal;
  return publierSalon(discord, canal.data.id, message);
}

/** Vrai si l'échec signifie « MP fermés / destinataire injoignable » (code Discord 50007). */
export function estMpFerme(resultat: ResultatRest<unknown>): boolean {
  return !resultat.ok && resultat.statut === 403 && resultat.motif.includes("50007");
}

/**
 * Publie un message persistant, ou l'édite s'il existe déjà et appartient au bot.
 *
 * C'est le `postOrEdit` des intégrations ranked de l'ancien bot : un message par
 * salon, édité en place à chaque passage, jamais un nouveau message par tick.
 * L'identifiant est rendu pour être mémorisé par l'appelant.
 */
export async function publierOuEditer(
  discord: PorteDiscordAchillea,
  salonId: string,
  idConnu: string | null,
  message: MessageDiscord,
): Promise<ResultatRest<{ id: string; action: "edite" | "publie" }>> {
  if (idConnu) {
    const [existant, moi] = await Promise.all([
      discord.rest<{ id: string; author?: { id: string } }>("GET", `/channels/${salonId}/messages/${idConnu}`),
      discord.rest<{ id: string }>("GET", "/users/@me"),
    ]);
    if (existant.ok && moi.ok && existant.data.author?.id === moi.data.id) {
      const edition = await discord.rest<{ id: string }>(
        "PATCH",
        `/channels/${salonId}/messages/${idConnu}`,
        corpsMessage(message),
      );
      if (edition.ok) return { ok: true, data: { id: idConnu, action: "edite" } };
    }
  }
  const publie = await publierSalon(discord, salonId, message);
  return publie.ok ? { ok: true, data: { id: publie.data.id, action: "publie" } } : publie;
}

/** Texte d'un échec pour le bilan d'une tâche. */
export function motifEchec(resultat: ResultatRest<unknown>): string {
  return resultat.ok ? "" : `${resultat.statut ?? "réseau"} ${resultat.motif}`.trim();
}
