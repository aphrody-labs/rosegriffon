/**
 * Pont de l'API unifiée vers l'application Discord Achilléa.
 *
 * Deux chemins, selon ce qu'on demande :
 *
 *   - ÉCRIRE (messages privés, messages de salon) passe par l'API REST Discord
 *     avec le jeton de l'application Achilléa. Pas besoin d'une passerelle
 *     ouverte : une candidature de clan acceptée doit notifier le joueur même
 *     pendant le redémarrage de l'enfant `bot-achillea` de `rg-core`.
 *   - LIRE l'état vivant (guildes rejointes, commandes chargées, journal,
 *     invitations) passe par le serveur d'administration en boucle locale du
 *     profil `achillea` (`lib/serveur-admin.ts`, port de `PROFILS_BOT.achillea`),
 *     parce que cet état n'existe que dans le processus.
 *
 * Aucune fonction ne lève sur un refus Discord attendu (DM fermés, salon
 * supprimé) : elles rendent un résultat que l'appelant consigne.
 */
import { PROFILS_BOT } from "@rosegriffon/types/bot";

const API_DISCORD = "https://discord.com/api/v10";
const AGENT = "RoseGriffonAchillea (https://rosegriffon.fr/achillea, 1.0)";
const TENTATIVES_429 = 4;

export type EnvAchillea = Record<string, string | undefined>;

/** Charge utile d'un message, réduite aux champs que l'API émet. */
export interface MessageAchillea {
  content?: string;
  embeds?: Array<Record<string, unknown>>;
  components?: Array<Record<string, unknown>>;
}

export type ResultatEnvoi = { ok: true; id: string } | { ok: false; statut: number | null; motif: string };

export function jetonBotAchillea(env: EnvAchillea = Bun.env): string | null {
  const jeton = (env.ACHILLEA_DISCORD_BOT_TOKEN ?? "").trim();
  return jeton === "" || jeton.startsWith("$") ? null : jeton;
}

async function appelRest(
  jeton: string,
  chemin: string,
  init: { method: string; body?: unknown },
  tentative = 0,
): Promise<Response> {
  const reponse = await fetch(`${API_DISCORD}${chemin}`, {
    method: init.method,
    headers: { Authorization: `Bot ${jeton}`, "User-Agent": AGENT, "Content-Type": "application/json" },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    signal: AbortSignal.timeout(15_000),
  });
  if (reponse.status === 429 && tentative < TENTATIVES_429) {
    const corps = (await reponse.json().catch(() => ({}))) as { retry_after?: number };
    await Bun.sleep(Math.ceil((corps.retry_after ?? 1) * 1000) + 250);
    return appelRest(jeton, chemin, init, tentative + 1);
  }
  return reponse;
}

async function poster(chemin: string, message: MessageAchillea, env: EnvAchillea): Promise<ResultatEnvoi> {
  const jeton = jetonBotAchillea(env);
  if (!jeton) return { ok: false, statut: null, motif: "ACHILLEA_DISCORD_BOT_TOKEN absent" };
  try {
    // Aucune mention implicite : un texte saisi par un joueur ne doit jamais pinguer @everyone.
    const reponse = await appelRest(jeton, chemin, {
      method: "POST",
      body: { ...message, allowed_mentions: { parse: ["users"] } },
    });
    if (!reponse.ok) {
      const texte = await reponse.text().catch(() => "");
      return { ok: false, statut: reponse.status, motif: texte.slice(0, 200) };
    }
    const cree = (await reponse.json()) as { id: string };
    return { ok: true, id: cree.id };
  } catch (err) {
    return { ok: false, statut: null, motif: err instanceof Error ? err.message : String(err) };
  }
}

/** Salon des Tournament Organizers du serveur Achilléa (« discussion-to », preuves et alertes). */
export const SALON_TO_ACHILLEA = "1436378680153608203";

/** Salon des preuves de litige : `RANKED_PROOF_CHANNEL_ID`, sinon `ACHILLEA_TO_CHANNEL_ID`, sinon le salon TO. */
export function salonPreuvesRanked(env: EnvAchillea = Bun.env): string {
  for (const variable of ["RANKED_PROOF_CHANNEL_ID", "ACHILLEA_TO_CHANNEL_ID"]) {
    const valeur = (env[variable] ?? "").trim();
    if (/^\d{15,25}$/.test(valeur)) return valeur;
  }
  return SALON_TO_ACHILLEA;
}

/** Publie un message dans un salon où le bot Achilléa a accès. */
export function publierSalonAchillea(
  salonId: string,
  message: MessageAchillea,
  env: EnvAchillea = Bun.env,
): Promise<ResultatEnvoi> {
  return poster(`/channels/${salonId}/messages`, message, env);
}

/**
 * Message privé à un joueur. Discord refuse (403, code 50007) quand le joueur a
 * fermé ses MP aux membres de ses serveurs : c'est un résultat, pas une panne.
 */
export async function envoyerMpAchillea(
  utilisateurId: string,
  message: MessageAchillea,
  env: EnvAchillea = Bun.env,
): Promise<ResultatEnvoi> {
  const jeton = jetonBotAchillea(env);
  if (!jeton) return { ok: false, statut: null, motif: "ACHILLEA_DISCORD_BOT_TOKEN absent" };
  try {
    const canal = await appelRest(jeton, "/users/@me/channels", { method: "POST", body: { recipient_id: utilisateurId } });
    if (!canal.ok) {
      return { ok: false, statut: canal.status, motif: (await canal.text().catch(() => "")).slice(0, 200) };
    }
    const { id } = (await canal.json()) as { id: string };
    return poster(`/channels/${id}/messages`, message, env);
  } catch (err) {
    return { ok: false, statut: null, motif: err instanceof Error ? err.message : String(err) };
  }
}

/** Erreur d'appel du serveur d'administration du profil Achilléa. */
export class BotAchilleaInjoignable extends Error {
  constructor(
    message: string,
    readonly statut: number | null = null,
  ) {
    super(message);
    this.name = "BotAchilleaInjoignable";
  }
}

/** Base du serveur d'administration Achilléa (surchargeable en développement). */
export function baseBotAchillea(env: EnvAchillea = Bun.env): string {
  const surcharge = (env.BOT_ADMIN_URL_ACHILLEA ?? "").trim();
  return (surcharge === "" ? `http://127.0.0.1:${PROFILS_BOT.achillea.portAdmin}` : surcharge).replace(/\/+$/, "");
}

/**
 * Appel du serveur d'administration du profil Achilléa.
 *
 * Lève `BotAchilleaInjoignable` (avec le statut HTTP quand il y en a un) : les
 * routes qui l'utilisent le traduisent en 503, ou en 404/409 quand le bot l'a dit.
 */
export async function appelerBotAchillea<T>(
  chemin: string,
  init: { method?: "GET" | "POST" } = {},
  env: EnvAchillea = Bun.env,
): Promise<T> {
  const secret = (env.BOT_ADMIN_TOKEN ?? "").trim();
  if (secret === "") throw new BotAchilleaInjoignable("BOT_ADMIN_TOKEN absent : le bot Achilléa ne peut pas être interrogé.");
  let reponse: Response;
  try {
    reponse = await fetch(`${baseBotAchillea(env)}${chemin}`, {
      method: init.method ?? "GET",
      headers: { Authorization: `Bearer ${secret}` },
      signal: AbortSignal.timeout(5_000),
    });
  } catch (err) {
    throw new BotAchilleaInjoignable(
      `Bot Achilléa injoignable : ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  if (!reponse.ok) {
    const corps = (await reponse.json().catch(() => ({}))) as { erreur?: string };
    throw new BotAchilleaInjoignable(corps.erreur ?? `HTTP ${reponse.status}`, reponse.status);
  }
  return (await reponse.json()) as T;
}
