/**
 * Copyright 2026 Rose Griffon
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * `achillea:casts-rappels` — rappels J-2 et H-2 aux casters confirmés.
 *
 * Remplace `CastReminders` (`@Schedule("*\/15 * * * *")`) et
 * `CastNotificationService.dispatchUpcoming` de l'ancien bot, à l'identique :
 *
 *   - fenêtre J-2 : événements prévus dans [now + 48 h ± 30 min] ;
 *   - fenêtre H-2 : événements prévus dans [now + 2 h ± 15 min] ;
 *   - seuls les casters dont l'attribution est confirmée et qui n'ont pas déjà
 *     reçu ce rappel (`notified_j2` / `notified_h2`) sont visés ;
 *   - MP fermés (code 50007) : le drapeau est posé quand même, pour ne pas
 *     réessayer toutes les 15 min ; toute autre erreur laisse le drapeau à faux
 *     et le rappel repart au passage suivant (tant qu'on reste dans la fenêtre) ;
 *   - récapitulatif dans le salon staff (`ACHILLEA_STAFF_CHANNEL_ID`).
 *
 * Seule différence : le MP part avec le jeton REST de l'application Achilléa,
 * sans passerelle. Les tables `cast_*` sont hors du schéma Kysely typé
 * (migration MikroORM `Migration20260425230000` de l'ancien bot).
 */
import { sql } from "../lib/db.js";
import {
  configAchilleaCron,
  discordAchillea,
  envoyerMp,
  estMpFerme,
  publierSalon,
  type MessageDiscord,
  type PorteDiscordAchillea,
} from "../lib/achillea-discord.js";

export type Echeance = "J-2" | "H-2";

export const FENETRES: Readonly<Record<Echeance, { decalageMs: number; demiFenetreMs: number }>> = Object.freeze({
  "J-2": { decalageMs: 48 * 3600_000, demiFenetreMs: 30 * 60_000 },
  "H-2": { decalageMs: 2 * 3600_000, demiFenetreMs: 15 * 60_000 },
});

/** Bornes de la fenêtre d'une échéance à l'instant donné. */
export function fenetre(echeance: Echeance, maintenant: Date): { debut: Date; fin: Date } {
  const { decalageMs, demiFenetreMs } = FENETRES[echeance];
  const cible = maintenant.getTime() + decalageMs;
  return { debut: new Date(cible - demiFenetreMs), fin: new Date(cible + demiFenetreMs) };
}

export interface EvenementCast {
  id: string;
  name: string;
  kind: string;
  scheduledAt: Date;
  twitchUrl: string | null;
}

export interface AttributionCast {
  id: string;
  userId: string;
  role: string;
}

export interface DepotCasts {
  evenements(echeance: Echeance, debut: Date, fin: Date): Promise<EvenementCast[]>;
  attributions(echeance: Echeance, evenementId: string): Promise<AttributionCast[]>;
  marquer(echeance: Echeance, attributionIds: readonly string[]): Promise<void>;
}

export const depotCasts: DepotCasts = {
  async evenements(echeance, debut, fin) {
    const lignes = await sql<
      Array<{ id: string; name: string; kind: string; scheduled_at: Date; twitch_url: string | null }>
    >`
      SELECT DISTINCT ce.id, ce.name, ce.kind, ce.scheduled_at, ce.twitch_url
        FROM achillea.cast_event ce
        JOIN achillea.cast_slot cs ON cs.event_id = ce.id
        JOIN achillea.cast_attribution ca ON ca.slot_id = cs.id
       WHERE ce.scheduled_at BETWEEN ${debut} AND ${fin}
         AND ce.status NOT IN ('done', 'cancelled')
         AND ca.confirmed_at IS NOT NULL
         AND ca.user_id IS NOT NULL
         AND ((${echeance === "J-2"} AND ca.notified_j2 = false) OR (${echeance === "H-2"} AND ca.notified_h2 = false))
       ORDER BY ce.scheduled_at`;
    return lignes.map(l => ({
      id: l.id,
      name: l.name,
      kind: l.kind,
      scheduledAt: new Date(l.scheduled_at),
      twitchUrl: l.twitch_url,
    }));
  },
  async attributions(echeance, evenementId) {
    return sql<Array<AttributionCast>>`
      SELECT ca.id, ca.user_id AS "userId", cs.role
        FROM achillea.cast_attribution ca
        JOIN achillea.cast_slot cs ON cs.id = ca.slot_id
       WHERE cs.event_id = ${evenementId}
         AND ca.confirmed_at IS NOT NULL
         AND ca.user_id IS NOT NULL
         AND ((${echeance === "J-2"} AND ca.notified_j2 = false) OR (${echeance === "H-2"} AND ca.notified_h2 = false))`;
  },
  async marquer(echeance, attributionIds) {
    if (attributionIds.length === 0) return;
    await sql.begin(async tx => {
      await tx`SET LOCAL ROLE service_role`;
      await tx`
        UPDATE achillea.cast_attribution
           SET notified_j2 = notified_j2 OR ${echeance === "J-2"}, notified_h2 = notified_h2 OR ${echeance === "H-2"}
         WHERE id = ANY(${[...attributionIds]}::uuid[])`;
    });
  },
};

/** MP de rappel (textes de l'ancien `_buildJ2Embed` / `_buildH2Embed`). */
export function messageRappel(echeance: Echeance, evenement: EvenementCast, role: string): MessageDiscord {
  const horodatage = Math.floor(evenement.scheduledAt.getTime() / 1000);
  const j2 = echeance === "J-2";
  return {
    embeds: [
      {
        title: j2 ? "Rappel de cast — J-2" : "Rappel de cast — H-2 (dans 2h !)",
        color: j2 ? 0x5865f2 : 0xed4245,
        description: j2
          ? "Tu as un cast dans **2 jours** ! Voici les informations :"
          : "Tu cast dans **2 heures** ! Vérifie que tout est prêt.",
        fields: [
          { name: "Événement", value: `${evenement.name} (${evenement.kind})`, inline: true },
          { name: "Rôle", value: role, inline: true },
          { name: j2 ? "Date" : "Heure", value: `<t:${horodatage}:${j2 ? "F" : "t"}>`, inline: false },
          ...(evenement.twitchUrl ? [{ name: "Twitch", value: evenement.twitchUrl, inline: false }] : []),
        ],
        footer: { text: `Achilléa Cast — rappel ${echeance}` },
        timestamp: new Date().toISOString(),
      },
    ],
  };
}

/** Récapitulatif staff (texte de l'ancien `_pingStaffChannel`). */
export function messageRecap(
  echeance: Echeance,
  evenement: EvenementCast,
  notifies: readonly string[],
  envoyes: number,
  echecs: number,
): MessageDiscord {
  const liste = notifies.length > 0 ? notifies.map(id => `<@${id}>`).join(", ") : "_aucun_";
  return {
    content: [
      `**[Cast ${echeance}]** Rappels envoyés pour **${evenement.name}**`,
      `Casters notifiés : ${liste}`,
      `Bilan : ${envoyes} envoyé(s), ${echecs} échec(s)`,
    ].join("\n"),
  };
}

export interface ResultatCastsRappels {
  success: true;
  evenements: number;
  envoyes: number;
  mpFermes: number;
  echecs: number;
}

export async function runAchilleaCastsRappels(
  depot: DepotCasts = depotCasts,
  discord: PorteDiscordAchillea = discordAchillea,
  salonStaff: string = configAchilleaCron().salonStaff,
  maintenant: Date = new Date(),
): Promise<ResultatCastsRappels> {
  const bilan: ResultatCastsRappels = { success: true, evenements: 0, envoyes: 0, mpFermes: 0, echecs: 0 };

  for (const echeance of ["J-2", "H-2"] as const) {
    const { debut, fin } = fenetre(echeance, maintenant);
    for (const evenement of await depot.evenements(echeance, debut, fin)) {
      bilan.evenements += 1;
      const marques: string[] = [];
      const notifies: string[] = [];
      let envoyes = 0;
      let echecs = 0;
      for (const attribution of await depot.attributions(echeance, evenement.id)) {
        const envoi = await envoyerMp(discord, attribution.userId, messageRappel(echeance, evenement, attribution.role));
        if (envoi.ok) {
          envoyes += 1;
          marques.push(attribution.id);
          notifies.push(attribution.userId);
        } else if (estMpFerme(envoi)) {
          bilan.mpFermes += 1;
          marques.push(attribution.id);
          console.warn(`[achillea:casts-rappels] ${echeance} MP fermés pour ${attribution.userId} (événement ${evenement.id})`);
        } else {
          echecs += 1;
          console.error(
            `[achillea:casts-rappels] ${echeance} MP échoué pour ${attribution.userId} (événement ${evenement.id}) : ${envoi.statut ?? "réseau"} ${envoi.motif}`,
          );
        }
      }
      await depot.marquer(echeance, marques);
      bilan.envoyes += envoyes;
      bilan.echecs += echecs;
      if (marques.length > 0 && salonStaff) {
        const recap = await publierSalon(discord, salonStaff, {
          ...messageRecap(echeance, evenement, notifies, envoyes, echecs),
          // Le récap mentionne les casters pour le staff, sans les notifier une seconde fois.
          mentionsUtilisateurs: [],
        });
        if (!recap.ok) console.warn(`[achillea:casts-rappels] récap staff non publié : ${recap.statut ?? "réseau"} ${recap.motif}`);
      }
    }
  }
  return bilan;
}
