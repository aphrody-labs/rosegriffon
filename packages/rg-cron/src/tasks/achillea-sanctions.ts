/**
 * Copyright 2026 Rose Griffon
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * `achillea:sanctions` — levée automatique des sanctions arrivées à échéance.
 *
 * Remplace `SanctionJobs.revoke` de l'ancien bot : il posait, à l'émission, un
 * travail BullMQ différé de `duration_sec` qui appelait `SanctionService.revoke`.
 * Une file Redis perdue (redémarrage sans persistance, changement de machine)
 * laissait des bannis temporaires bannis pour toujours. Ici, la base fait foi :
 * toute sanction `expires_at <= now()` non révoquée est levée au prochain
 * passage, quelle que soit la façon dont elle a été émise (bot, site, CLI).
 *
 * Pour chaque sanction échue :
 *   1. `revoked_at = now()`, `revoked_by = 'system'` — conditionné à
 *      `revoked_at IS NULL`, donc idempotent et sûr face à un humain qui révoque
 *      au même instant ;
 *   2. effet Discord inverse avec le jeton Achilléa : `mute` → fin du délai
 *      d'exclusion (`communication_disabled_until = null`), `ban` → débannissement.
 *      Un membre parti (404) ou un ban déjà levé (404) ne sont pas des échecs ;
 *   3. propagation aux serveurs partenaires (`ACHILLEA_CROSS_SYNC_TARGETS`),
 *      comme `CrossSyncService.pushSanction(…, "revoke")`.
 */
import { sql } from "../lib/db.js";
import { discordAchillea, motifEchec, type PorteDiscordAchillea } from "../lib/achillea-discord.js";

/** Révocateur consigné en base, celui de l'ancien bot. */
export const REVOCATEUR_SYSTEME = "system";
/** Sanctions traitées au plus par passage : borne le temps d'une tâche après une longue panne. */
export const LOT_SANCTIONS = 200;

export interface SanctionEchue {
  id: string;
  userId: string;
  guildId: string;
  type: string;
  reason: string | null;
  durationSec: number | null;
  expiresAt: Date | null;
  issuedBy: string;
  createdAt: Date;
  evidence: Record<string, unknown>[] | null;
}

export interface DepotSanctions {
  /** Sanctions non révoquées dont l'échéance est passée, les plus anciennes d'abord. */
  echues(maintenant: Date, limite: number): Promise<SanctionEchue[]>;
  /** Révoque si elle ne l'est pas déjà. `false` si un autre l'a fait entre-temps. */
  revoquer(id: string, maintenant: Date): Promise<boolean>;
}

export const depotSanctions: DepotSanctions = {
  async echues(maintenant, limite) {
    const lignes = await sql<
      Array<{
        id: string;
        user_id: string;
        guild_id: string;
        type: string;
        reason: string | null;
        duration_sec: number | null;
        expires_at: Date | null;
        issued_by: string;
        created_at: Date;
        evidence: Record<string, unknown>[] | null;
      }>
    >`
      SELECT id, user_id, guild_id, type, reason, duration_sec, expires_at, issued_by, created_at, evidence
        FROM achillea.sanction
       WHERE revoked_at IS NULL
         AND expires_at IS NOT NULL
         AND expires_at <= ${maintenant}
       ORDER BY expires_at ASC
       LIMIT ${limite}`;
    return lignes.map(l => ({
      id: l.id,
      userId: l.user_id,
      guildId: l.guild_id,
      type: l.type,
      reason: l.reason,
      durationSec: l.duration_sec,
      expiresAt: l.expires_at,
      issuedBy: l.issued_by,
      createdAt: l.created_at,
      evidence: l.evidence,
    }));
  },
  async revoquer(id, maintenant) {
    return sql.begin(async tx => {
      await tx`SET LOCAL ROLE service_role`;
      const lignes = await tx`
        UPDATE achillea.sanction
           SET revoked_at = ${maintenant}, revoked_by = ${REVOCATEUR_SYSTEME},
               revoke_reason = COALESCE(revoke_reason, 'Échéance atteinte'), updated_at = ${maintenant}
         WHERE id = ${id} AND revoked_at IS NULL
         RETURNING id`;
      return lignes.length > 0;
    });
  },
};

/** Appel Discord qui lève l'effet d'une sanction, ou `null` si son type n'en a pas. */
export function effetInverse(
  sanction: Pick<SanctionEchue, "id" | "type" | "guildId" | "userId">,
): { methode: "PATCH" | "DELETE"; chemin: string; corps?: unknown; raison: string } | null {
  const raison = `Sanction ${sanction.id} expirée`;
  if (sanction.type === "mute")
    return {
      methode: "PATCH",
      chemin: `/guilds/${sanction.guildId}/members/${sanction.userId}`,
      corps: { communication_disabled_until: null },
      raison,
    };
  if (sanction.type === "ban")
    return { methode: "DELETE", chemin: `/guilds/${sanction.guildId}/bans/${sanction.userId}`, raison };
  return null;
}

// ─── Propagation inter-serveurs (CrossSyncService) ──────────────────────────

export type PolitiqueSync = "ban-only" | "all";
export interface CibleSync {
  url: string;
  secret: string;
  policy: PolitiqueSync;
}

/** Cibles de `ACHILLEA_CROSS_SYNC_TARGETS` (JSON) ; liste vide si absente ou illisible. */
export function ciblesSync(env: Record<string, string | undefined> = Bun.env): CibleSync[] {
  const brut = (env.ACHILLEA_CROSS_SYNC_TARGETS ?? "").trim();
  if (!brut) return [];
  try {
    const valeur = JSON.parse(brut) as unknown;
    if (!Array.isArray(valeur)) return [];
    return valeur.filter(
      (c): c is CibleSync =>
        !!c &&
        typeof c === "object" &&
        typeof (c as CibleSync).url === "string" &&
        typeof (c as CibleSync).secret === "string" &&
        ((c as CibleSync).policy === "all" || (c as CibleSync).policy === "ban-only"),
    );
  } catch {
    return [];
  }
}

/** Charge utile du webhook de l'ancien `CrossSyncService` (version 1.0), à l'identique. */
export function chargeSync(sanction: SanctionEchue, politique: PolitiqueSync) {
  return {
    version: "1.0" as const,
    source_guild_id: sanction.guildId,
    source_bot_id: "achillea-bot" as const,
    sanction: {
      id: sanction.id,
      userId: sanction.userId,
      type: sanction.type,
      reason: sanction.reason,
      durationSec: sanction.durationSec,
      expiresAt: sanction.expiresAt?.toISOString() ?? null,
      issuedBy: sanction.issuedBy,
      issuedAt: sanction.createdAt.toISOString(),
      evidence: sanction.evidence,
    },
    action: "revoke" as const,
    propagation_policy: politique,
  };
}

/** HMAC-SHA256 hexadécimal de `${horodatage}.${corps}` — signature attendue par les partenaires. */
export async function signatureSync(horodatage: string, corps: string, secret: string): Promise<string> {
  const cle = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const octets = await crypto.subtle.sign("HMAC", cle, new TextEncoder().encode(`${horodatage}.${corps}`));
  return Buffer.from(octets).toString("hex");
}

/** La politique accepte-t-elle ce type ? (`ban-only` : bannissements uniquement.) */
export function politiqueAccepte(politique: PolitiqueSync, type: string): boolean {
  return politique === "all" || type === "ban" || type === "unban";
}

async function propager(sanction: SanctionEchue, cibles: readonly CibleSync[]): Promise<string[]> {
  // Anti-boucle : une sanction reçue d'un partenaire (evidence[0].from) n'est pas renvoyée.
  if (sanction.evidence?.[0]?.from != null) return [];
  const echecs: string[] = [];
  const horodatage = String(Date.now());
  for (const cible of cibles) {
    if (!politiqueAccepte(cible.policy, sanction.type)) continue;
    const corps = JSON.stringify(chargeSync(sanction, cible.policy));
    try {
      const reponse = await fetch(cible.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-achillea-signature": await signatureSync(horodatage, corps, cible.secret),
          "x-achillea-timestamp": horodatage,
        },
        body: corps,
        signal: AbortSignal.timeout(10_000),
      });
      if (!reponse.ok) echecs.push(`${cible.url} : HTTP ${reponse.status}`);
    } catch (err) {
      echecs.push(`${cible.url} : ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return echecs;
}

export interface ResultatSanctions {
  success: true;
  echues: number;
  revoquees: number;
  /** Effets Discord levés (unban / fin d'exclusion). */
  effetsLeves: number;
  /** Échecs non bloquants (Discord, partenaires), pour le journal. */
  avertissements: string[];
}

export async function runAchilleaSanctions(
  depot: DepotSanctions = depotSanctions,
  discord: PorteDiscordAchillea = discordAchillea,
  cibles: readonly CibleSync[] = ciblesSync(),
  maintenant: Date = new Date(),
): Promise<ResultatSanctions> {
  const echues = await depot.echues(maintenant, LOT_SANCTIONS);
  const avertissements: string[] = [];
  let revoquees = 0;
  let effetsLeves = 0;

  for (const sanction of echues) {
    if (!(await depot.revoquer(sanction.id, maintenant))) continue;
    revoquees += 1;

    const effet = effetInverse(sanction);
    if (effet) {
      const resultat = await discord.rest(effet.methode, effet.chemin, effet.corps, effet.raison);
      // 404 : membre parti, ban déjà levé, serveur quitté — l'effet n'existe plus, c'est le but.
      if (resultat.ok || resultat.statut === 404) effetsLeves += 1;
      else avertissements.push(`sanction ${sanction.id} (${sanction.type}) : ${motifEchec(resultat)}`);
    }
    for (const echec of await propager(sanction, cibles)) avertissements.push(`sync ${sanction.id} : ${echec}`);
  }

  if (echues.length > 0)
    console.log(
      `[achillea:sanctions] ${revoquees}/${echues.length} sanction(s) levée(s), ${effetsLeves} effet(s) Discord retiré(s)`,
    );
  for (const avertissement of avertissements) console.warn(`[achillea:sanctions] ${avertissement}`);
  return { success: true, echues: echues.length, revoquees, effetsLeves, avertissements };
}
