/**
 * Dissolution des clans en sous-effectif — port de `ClanJobs.checkClanMemberCount`
 * et de `disbandClan(…, job = true)` du legacy.
 *
 * Le legacy planifiait un job BullMQ à +24 h quand un clan passait sous 5
 * membres. Ici, l'état est en base : `clan.under_member_limit` et
 * `clan.under_member_limit_since` (posés par `POST /v1/achillea/clans/kick/:id`).
 * Toutes les 15 minutes :
 *   - clan revenu à 5 membres ou plus → drapeau retiré ;
 *   - clan toujours sous la limite depuis 24 h → dissolution complète.
 *
 * Dissolution (écritures dans une transaction, effets Discord ensuite) :
 * `is_disbanded`, tous les membres passés en historique (le legacy n'en retirait
 * qu'un, `emptyClan` supprimant `clanMembers[0]`), invitations et candidatures
 * en attente supprimées, notification aux anciens membres (poussée en direct
 * par le trigger `achillea_notification_temps_reel`), entrée signée du journal
 * d'audit ; puis salon et rôle du clan supprimés, rôle Président retiré, annonce
 * dans le salon de diffusion du clan et dans le salon des clans, MP aux membres.
 */

import type { TransactionSQL } from "bun";

import { sql } from "../lib/db.js";
import { jetonAchillea } from "./achillea-guildes.js";

const API_DISCORD = "https://discord.com/api/v10";

/** Seuil du legacy (`onMembershipChange`). */
export const MEMBRES_MINIMUM = 5;
/** Délai de grâce du legacy (`scheduleClanCheck`). */
export const DELAI_GRACE_MS = 24 * 60 * 60 * 1000;
/** `LeaveReason.Leave` du legacy : la dissolution n'est pas une expulsion. */
const MOTIF_DEPART = 3;
/** `NotificationType.CLAN_DISBANDED` et `NotificationCategory.CLAN` (`@rosegriffon/achillea-types`). */
const TYPE_DISSOLUTION = 6;
const CATEGORIE_CLAN = 1;
const COULEUR_ERREUR = 0xed4245;
const COULEUR_ACHILLEA = 0x6d00ce;

/** Identifiants du serveur central (valeurs de production du legacy, surchargeables). */
export function configClans(env: Record<string, string | undefined> = Bun.env) {
  const lire = (cle: string, defaut: string) => (env[cle] ?? "").trim() || defaut;
  return {
    guildId: lire("ACHILLEA_CORE_GUILD_ID", "1055585286320554055"),
    captainRoleId: lire("ACHILLEA_CAPTAIN_ROLE_ID", "1398801292079403121"),
    clanAnnouncementsChannelId: lire("ACHILLEA_CLAN_ANNOUNCEMENTS_CHANNEL_ID", "1398801515694788719"),
  };
}

export type Decision = "dissoudre" | "retablir" | "attendre";

/** Ce que le job legacy décidait à l'échéance, rendu indépendant de l'horloge du job. */
export function decider(clan: { membres: number; depuis: Date | null }, maintenant: Date): Decision {
  if (clan.membres >= MEMBRES_MINIMUM) return "retablir";
  // Drapeau posé avant la colonne d'horodatage : on part du premier passage.
  if (!clan.depuis) return "attendre";
  return maintenant.getTime() - clan.depuis.getTime() >= DELAI_GRACE_MS ? "dissoudre" : "attendre";
}

type ResultatRest = { ok: true; data: unknown } | { ok: false; statut: number | null; motif: string };

/** Appel REST Discord avec le jeton Achilléa ; ne lève jamais. */
export async function restDiscord(
  jeton: string,
  method: "POST" | "PUT" | "DELETE",
  chemin: string,
  body?: unknown,
  raison?: string,
): Promise<ResultatRest> {
  try {
    const headers: Record<string, string> = { Authorization: `Bot ${jeton}` };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (raison) headers["X-Audit-Log-Reason"] = encodeURIComponent(raison);
    const reponse = await fetch(`${API_DISCORD}${chemin}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });
    if (!reponse.ok) return { ok: false, statut: reponse.status, motif: (await reponse.text().catch(() => "")).slice(0, 200) };
    const texte = await reponse.text();
    return { ok: true, data: texte ? JSON.parse(texte) : null };
  } catch (err) {
    return { ok: false, statut: null, motif: err instanceof Error ? err.message : String(err) };
  }
}

function consigner(action: string, resultat: ResultatRest) {
  if (!resultat.ok) console.warn(`[achillea:clans] ${action} : échec Discord (${resultat.statut ?? "réseau"}) ${resultat.motif}`);
}

const estSnowflake = (id: string | null | undefined): id is string => Boolean(id && /^\d{17,20}$/.test(id));

export interface ClanDissous {
  id: number;
  name: string;
  founders: string[];
  clan_avatar_url: string;
  clan_fame: number;
  created_at: Date;
  channel_id: string;
  role_id: string;
  broadcast_channel: string | null;
  capitaine: string | null;
  membres: string[];
  fils: string[];
}

/** Embed d'annonce du legacy (`buildClanDisbandEmbed`). */
export function embedDissolution(clan: Pick<ClanDissous, "name" | "founders" | "clan_avatar_url" | "clan_fame" | "created_at">, le: Date) {
  return {
    color: COULEUR_ERREUR,
    title: `Dissolution de Clan : ${clan.name}`,
    description: `__*Clan dissout le ${le.toLocaleDateString("fr-FR")}*__`,
    thumbnail: { url: clan.clan_avatar_url },
    fields: [
      { name: "Fondateurs", value: clan.founders.map(id => `- <@${id}>`).join("\n") || "—", inline: true },
      { name: "Fondé le", value: new Date(clan.created_at).toLocaleDateString("fr-FR"), inline: true },
      { name: "Fame accumulée", value: String(clan.clan_fame), inline: true },
    ],
  };
}

export const MESSAGE_DISSOLUTION =
  "Votre Clan a été dissout car il ne respectait plus le minimum de membres requis ! Merci d'avoir contribué à la communauté et au plaisir de vous revoir.";

/** Signature chaînée du journal d'audit, identique à `apps/rg-bot/src/api/modules/achillea/audit.ts`. */
export function signatureAudit(
  precedente: string | null,
  entree: { actor_id: string | null; action: string; target_type: string; target_id: string | null; payload: Record<string, unknown> | null; ts: Date },
): string {
  const hachage = new Bun.CryptoHasher("sha256");
  hachage.update(
    (precedente ?? "") +
      JSON.stringify({
        actor_id: entree.actor_id,
        action: entree.action,
        target_type: entree.target_type,
        target_id: entree.target_id,
        payload: entree.payload,
        ts: entree.ts.toISOString(),
      }),
  );
  return hachage.digest("hex");
}

/** Effets Discord d'une dissolution, après la transaction. */
export async function effetsDiscord(jeton: string, clan: ClanDissous, maintenant: Date) {
  const config = configClans();
  const raison = `Clan ${clan.name} dissous (sous-effectif)`;
  if (estSnowflake(clan.channel_id)) consigner("suppression du salon", await restDiscord(jeton, "DELETE", `/channels/${clan.channel_id}`, undefined, raison));
  if (estSnowflake(clan.role_id))
    consigner("suppression du rôle", await restDiscord(jeton, "DELETE", `/guilds/${config.guildId}/roles/${clan.role_id}`, undefined, raison));
  if (clan.capitaine)
    consigner(
      "retrait du rôle Président",
      await restDiscord(jeton, "DELETE", `/guilds/${config.guildId}/members/${clan.capitaine}/roles/${config.captainRoleId}`, undefined, raison),
    );
  for (const fil of clan.fils.filter(estSnowflake))
    consigner("suppression d'un fil d'invitation", await restDiscord(jeton, "DELETE", `/channels/${fil}`, undefined, raison));
  if (estSnowflake(clan.broadcast_channel))
    consigner(
      "message au serveur du clan",
      await restDiscord(jeton, "POST", `/channels/${clan.broadcast_channel}/messages`, {
        embeds: [{ color: COULEUR_ACHILLEA, title: MESSAGE_DISSOLUTION }],
        allowed_mentions: { parse: [] },
      }),
    );
  consigner(
    "annonce de dissolution",
    await restDiscord(jeton, "POST", `/channels/${config.clanAnnouncementsChannelId}/messages`, {
      embeds: [embedDissolution(clan, maintenant)],
      allowed_mentions: { parse: [] },
    }),
  );
  for (const membre of clan.membres) {
    const canal = await restDiscord(jeton, "POST", "/users/@me/channels", { recipient_id: membre });
    if (!canal.ok) {
      consigner("ouverture du MP", canal);
      continue;
    }
    consigner(
      "MP de dissolution",
      await restDiscord(jeton, "POST", `/channels/${(canal.data as { id: string }).id}/messages`, {
        embeds: [{ color: COULEUR_ACHILLEA, title: `Clan ${clan.name} dissous`, description: MESSAGE_DISSOLUTION }],
        allowed_mentions: { parse: [] },
      }),
    );
  }
}

export interface ResultatClansAchillea {
  success: boolean;
  examines?: number;
  dissous?: number[];
  retablis?: number[];
  ignore?: boolean;
  error?: string;
}

export async function runAchilleaClans(maintenant = new Date()): Promise<ResultatClansAchillea> {
  try {
    const resultat = await sql.begin(async tx => {
      await tx`SET LOCAL ROLE service_role`;
      const [verrou] = await tx<Array<{ acquis: boolean }>>`
        SELECT pg_try_advisory_xact_lock(hashtext('rg-cron:achillea:clans')) AS acquis`;
      if (!verrou?.acquis) return { ignore: true as const };

      const candidats = await tx<Array<{ id: number; membres: number; depuis: Date | null }>>`
        SELECT c.id, c.under_member_limit_since AS depuis,
               (SELECT count(*)::int FROM achillea.clan_member m WHERE m.clan_id = c.id) AS membres
          FROM achillea.clan c
         WHERE c.under_member_limit AND NOT c.is_disbanded
         FOR UPDATE OF c`;
      const retablis: number[] = [];
      const dissous: ClanDissous[] = [];
      for (const candidat of candidats) {
        const decision = decider(candidat, maintenant);
        if (decision === "retablir") {
          await tx`UPDATE achillea.clan SET under_member_limit = false, under_member_limit_since = NULL, updated_at = now() WHERE id = ${candidat.id}`;
          retablis.push(candidat.id);
        } else if (decision === "attendre" && !candidat.depuis) {
          await tx`UPDATE achillea.clan SET under_member_limit_since = ${maintenant} WHERE id = ${candidat.id}`;
        } else if (decision === "dissoudre") {
          dissous.push(await dissoudre(tx, candidat.id, maintenant));
        }
      }
      return { ignore: false as const, examines: candidats.length, retablis, dissous };
    });
    if (resultat.ignore) return { success: true, ignore: true };

    const jeton = jetonAchillea();
    if (!jeton && resultat.dissous.length > 0)
      console.warn("[achillea:clans] ACHILLEA_DISCORD_BOT_TOKEN absent : dissolutions faites en base sans effets Discord.");
    if (jeton) for (const clan of resultat.dissous) await effetsDiscord(jeton, clan, maintenant);

    return {
      success: true,
      examines: resultat.examines,
      dissous: resultat.dissous.map(clan => clan.id),
      retablis: resultat.retablis,
    };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

type Tx = TransactionSQL;

async function dissoudre(tx: Tx, clanId: number, maintenant: Date): Promise<ClanDissous> {
  const [clan] = await tx<Array<Omit<ClanDissous, "capitaine" | "membres" | "fils">>>`
    SELECT c.id, c.name, c.founders, c.clan_avatar_url, c.clan_fame, c.created_at, c.channel_id, c.role_id,
           g.broadcast_channel
      FROM achillea.clan c LEFT JOIN achillea.guild g ON g.id = c.guild_id
     WHERE c.id = ${clanId}`;
  const membres = await tx<Array<{ user_id: string; role: number }>>`
    DELETE FROM achillea.clan_member WHERE clan_id = ${clanId}
    RETURNING user_id, role, created_at, clan_fame_contributed`;
  await tx`
    INSERT INTO achillea.clan_member_history
      (created_at, updated_at, user_id, clan_id, join_date, leave_reason, kick_reason, clan_fame_contributed, role)
    SELECT now(), now(), m.user_id, ${clanId}, m.created_at, ${MOTIF_DEPART}, 'Dissolution du clan (sous-effectif)',
           m.clan_fame_contributed, m.role
      FROM jsonb_to_recordset(${JSON.stringify(membres)}::jsonb)
        AS m(user_id text, role int, created_at timestamptz, clan_fame_contributed int)`;
  const fils = await tx<Array<{ thread_id: string | null }>>`
    DELETE FROM achillea.clan_invite WHERE clan_id = ${clanId} RETURNING thread_id`;
  await tx`DELETE FROM achillea.clan_application WHERE clan_id = ${clanId}`;
  await tx`
    UPDATE achillea.clan
       SET is_disbanded = true, is_recruiting = false, under_member_limit = false,
           under_member_limit_since = NULL, updated_at = now()
     WHERE id = ${clanId}`;

  const ids = membres.map(m => m.user_id);
  if (ids.length > 0) {
    const [notification] = await tx<Array<{ id: number }>>`
      INSERT INTO achillea.notification (created_at, updated_at, title, message, type, category, payload)
      VALUES (now(), now(), 'Dissolution', ${`Le Clan ${clan!.name} a été dissous : ${MESSAGE_DISSOLUTION}`}, ${TYPE_DISSOLUTION}, ${CATEGORIE_CLAN},
              ${JSON.stringify({ clanId, clanName: clan!.name, motif: "sous-effectif" })}::jsonb)
      RETURNING id`;
    await tx`
      INSERT INTO achillea.user_notification (created_at, updated_at, notification_id, user_id, is_read)
      SELECT now(), now(), ${notification!.id}, u, false FROM jsonb_array_elements_text(${JSON.stringify(ids)}::jsonb) AS u`;
  }

  // Journal d'audit signé : action système (aucun auteur).
  const charge = { name: clan!.name, membres: ids, motif: "sous-effectif" };
  const [tete] = await tx<Array<{ signature: string }>>`
    SELECT signature FROM achillea.audit_log ORDER BY ts DESC, id DESC LIMIT 1 FOR UPDATE`;
  const precedente = tete?.signature ?? null;
  const signature = signatureAudit(precedente, {
    actor_id: null,
    action: "clan.disband",
    target_type: "Clan",
    target_id: String(clanId),
    payload: charge,
    ts: maintenant,
  });
  await tx`
    INSERT INTO achillea.audit_log (actor_id, action, target_type, target_id, payload, reason, ts, prev_signature, signature)
    VALUES (NULL, 'clan.disband', 'Clan', ${String(clanId)}, ${JSON.stringify(charge)}::jsonb,
            ${`Moins de ${MEMBRES_MINIMUM} membres depuis 24 h`}, ${maintenant}, ${precedente}, ${signature})`;

  return {
    ...clan!,
    capitaine: membres.find(m => Number(m.role) === 3)?.user_id ?? null,
    membres: ids,
    fils: fils.map(f => f.thread_id).filter((id): id is string => Boolean(id)),
  };
}
