/**
 * Journal d'audit Achilléa — chaîne signée de l'ancien bot, rétablie dans l'API.
 *
 * Depuis le retrait de `legacy/achillea-bot`, plus rien n'écrivait
 * `achillea.audit_log` : la table était vide (constaté le 22/10/2026) alors que
 * l'API continuait d'accepter des ajustements de portefeuille, des changements
 * de rôle et des sanctions. Chaque mutation staff passe désormais par
 * `journaliserAudit`.
 *
 * Signature : `sha256(signaturePrecedente + json({actor_id, action, target_type, target_id, payload, ts}))`,
 * la formule de l'ancien bot à UNE différence près : la charge est sérialisée en JSON
 * CANONIQUE (clés triées, récursivement). Postgres stocke `payload` en `jsonb`, qui
 * réordonne les clés ; relue, la charge ne se sérialisait plus comme à l'écriture et
 * `verifierChaineAudit` déclarait la chaîne rompue dès la première entrée. L'ancien
 * bot avait ce défaut sans le voir : il ne vérifiait jamais sa chaîne, et la table
 * était vide quand elle a été reprise.
 */
import { sql, type Kysely } from "kysely";
import type { Database } from "@rosegriffon/db/schema";

import { publierSalonAchillea } from "../../../lib/achillea-discord";

export interface EntreeAudit {
  /** Identifiant Discord de l'auteur, `null` pour une action système. */
  acteur: string | null;
  /** Verbe stable, en `domaine.action` (`wallet.adjust`, `user.role`…). */
  action: string;
  cibleType: string;
  cibleId?: string | null;
  charge?: Record<string, unknown> | null;
  motif?: string | null;
  ip?: string | null;
  /** Serveur dont le salon d'audit (`guild.audit_log_channel_id`) reçoit une copie. */
  guildeId?: string | null;
}

export interface LigneAudit {
  id: string;
  ts: Date;
  actor_id: string | null;
  action: string;
  target_type: string;
  target_id: string | null;
  payload: Record<string, unknown> | null;
  reason: string | null;
  prev_signature: string | null;
  signature: string;
}

/** Valeur JSON aux clés d'objet triées, récursivement (ordre indépendant de `jsonb`). */
export function canonique(valeur: unknown): unknown {
  if (Array.isArray(valeur)) return valeur.map(canonique);
  if (valeur instanceof Date) return valeur.toISOString();
  if (valeur && typeof valeur === "object") {
    return Object.fromEntries(
      Object.keys(valeur)
        .toSorted()
        .map(cle => [cle, canonique((valeur as Record<string, unknown>)[cle])]),
    );
  }
  return valeur;
}

/** Signature chaînée (formule de l'ancien bot, charge en JSON canonique). */
export function signatureAudit(
  precedente: string | null,
  entree: {
    actor_id: string | null;
    action: string;
    target_type: string;
    target_id: string | null;
    payload: Record<string, unknown> | null;
    ts: Date;
  },
  ordre: "canonique" | "tel-quel" = "canonique",
): string {
  const hachage = new Bun.CryptoHasher("sha256");
  hachage.update(
    (precedente ?? "") +
      JSON.stringify({
        actor_id: entree.actor_id,
        action: entree.action,
        target_type: entree.target_type,
        target_id: entree.target_id,
        payload: ordre === "canonique" ? canonique(entree.payload) : entree.payload,
        ts: entree.ts.toISOString(),
      }),
  );
  return hachage.digest("hex");
}

/**
 * Ajoute une entrée en tête de chaîne.
 *
 * Lecture de la tête et insertion dans la même transaction, tête verrouillée :
 * deux écrivains simultanés ne peuvent pas signer à partir de la même tête.
 * Si `db` est déjà une transaction, l'entrée en fait partie (une mutation
 * annulée n'est pas journalisée).
 */
export async function journaliserAudit(db: Kysely<Database>, entree: EntreeAudit): Promise<LigneAudit> {
  const ts = new Date();
  const acteur = entree.acteur ?? null;
  const cibleId = entree.cibleId ?? null;
  const charge = entree.charge ?? null;
  const ecrire = async (trx: Kysely<Database>) => {
    const tete = await sql<{ signature: string }>`
      SELECT signature FROM achillea.audit_log ORDER BY ts DESC, id DESC LIMIT 1 FOR UPDATE`.execute(trx);
    const precedente = tete.rows[0]?.signature ?? null;
    const signature = signatureAudit(precedente, {
      actor_id: acteur,
      action: entree.action,
      target_type: entree.cibleType,
      target_id: cibleId,
      payload: charge,
      ts,
    });
    const insere = await sql<LigneAudit>`
      INSERT INTO achillea.audit_log (actor_id, action, target_type, target_id, payload, reason, ip, ts, prev_signature, signature)
      VALUES (${acteur}, ${entree.action}, ${entree.cibleType}, ${cibleId}, ${charge === null ? null : JSON.stringify(charge)}::jsonb,
              ${entree.motif ?? null}, ${entree.ip ?? null}, ${ts}, ${precedente}, ${signature})
      RETURNING id, ts, actor_id, action, target_type, target_id, payload, reason, prev_signature, signature`.execute(trx);
    return insere.rows[0]!;
  };
  const ligne = db.isTransaction ? await ecrire(db) : await db.transaction().execute(ecrire);
  if (entree.guildeId) void refleterSurDiscord(db, ligne, entree.guildeId);
  return ligne;
}

/** Copie l'entrée dans le salon d'audit du serveur, s'il en a un. Ne lève jamais. */
async function refleterSurDiscord(db: Kysely<Database>, ligne: LigneAudit, guildeId: string): Promise<void> {
  try {
    const salon = await sql<{ audit_log_channel_id: string | null }>`
      SELECT audit_log_channel_id FROM achillea.guild WHERE id = ${guildeId}`.execute(db);
    const salonId = salon.rows[0]?.audit_log_channel_id;
    if (!salonId) return;
    const envoi = await publierSalonAchillea(salonId, {
      embeds: [
        {
          title: `Audit · ${ligne.action}`,
          color: 0x6d00ce,
          timestamp: ligne.ts.toISOString(),
          fields: [
            { name: "Auteur", value: ligne.actor_id ? `<@${ligne.actor_id}>` : "Système", inline: true },
            { name: "Cible", value: `${ligne.target_type}${ligne.target_id ? ` \`${ligne.target_id}\`` : ""}`, inline: true },
            ...(ligne.reason ? [{ name: "Motif", value: ligne.reason.slice(0, 1024) }] : []),
          ],
          footer: { text: `Signature ${ligne.signature.slice(0, 12)}…` },
        },
      ],
    });
    if (!envoi.ok) console.warn(`[audit] copie Discord refusée (${envoi.statut ?? "réseau"}) : ${envoi.motif}`);
  } catch (err) {
    console.warn("[audit] copie Discord impossible :", err instanceof Error ? err.message : err);
  }
}

/** Relit toute la chaîne ; rend l'identifiant de la première entrée altérée. */
export async function verifierChaineAudit(db: Kysely<Database>): Promise<{ valid: boolean; broken_at: string | null; total: number }> {
  const lignes = await sql<LigneAudit>`
    SELECT id, ts, actor_id, action, target_type, target_id, payload, reason, prev_signature, signature
      FROM achillea.audit_log ORDER BY ts ASC, id ASC`.execute(db);
  let precedente: string | null = null;
  for (const ligne of lignes.rows) {
    // Une charge enregistrée comme CHAÎNE jsonb (première entrée, écrite par le script de
    // migration des images via Bun.SQL) a gardé l'ordre de ses clés à l'écriture : elle a
    // été signée sur cet ordre-là, avant la sérialisation canonique. La table est en
    // ajout seul (trigger `audit_log_immutable`) : on relit, on ne réécrit pas.
    const attendue: string =
      typeof ligne.payload === "string"
        ? signatureAudit(precedente, { ...ligne, payload: JSON.parse(ligne.payload) as Record<string, unknown> }, "tel-quel")
        : signatureAudit(precedente, ligne);
    if (attendue !== ligne.signature) return { valid: false, broken_at: ligne.id, total: lignes.rows.length };
    precedente = ligne.signature;
  }
  return { valid: true, broken_at: null, total: lignes.rows.length };
}
