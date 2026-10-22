/**
 * Messages Discord de la cellule cast (application Achilléa, REST) :
 *
 * - MP d'attribution : le caster placé par l'auto-attribution ou un échange
 *   est prévenu et invité à confirmer (absent du legacy, où il fallait
 *   surveiller le site) ;
 * - rappels J-2 et H-2 aux casters confirmés, portage de
 *   `CastNotificationService`, avec récapitulatif dans le salon staff
 *   (`ACHILLEA_STAFF_CHANNEL_ID`). Idempotents : `notified_j2` / `notified_h2`.
 *
 * Un MP refusé par Discord (403 : MP fermés) compte comme traité, pour ne pas
 * relancer le joueur à chaque passage ; toute autre panne sera retentée.
 */

import { envoyerMpAchillea, publierSalonAchillea, type MessageAchillea } from "../../../../lib/achillea-discord";
import { CastSlotRole } from "@rosegriffon/achillea-core/enums";
import type { CastDb, CastEvent } from "./service";

export const ACHILLEA_COLOR = 0x6d00ce;

const ROLE_LABELS: Record<string, string> = {
  [CastSlotRole.CasterMain]: "Caster principal",
  [CastSlotRole.CasterSecondary]: "Caster secondaire",
  [CastSlotRole.Observer]: "Observateur",
  [CastSlotRole.Producer]: "Réalisation",
  [CastSlotRole.Host]: "Présentation",
  [CastSlotRole.Technical]: "Technique",
};

const roleLabel = (role: string) => ROLE_LABELS[role] ?? role;
const unix = (date: Date | string) => Math.floor(new Date(date).getTime() / 1000);

export function castsPageUrl(eventId: string): string {
  return `${(process.env.WEBSITE_URL ?? "https://rosegriffon.fr").replace(/\/+$/, "")}/achillea/casts?event=${eventId}`;
}

export function attributionMessage(event: Pick<CastEvent, "id" | "name" | "kind" | "scheduledAt">, role: string): MessageAchillea {
  return {
    embeds: [
      {
        title: "Nouvelle attribution de cast",
        color: ACHILLEA_COLOR,
        description: "Tu as été placé sur une diffusion. Confirme ta présence depuis le site.",
        fields: [
          { name: "Évènement", value: `${event.name} (${event.kind})`, inline: true },
          { name: "Rôle", value: roleLabel(role), inline: true },
          { name: "Date", value: `<t:${unix(event.scheduledAt)}:F>`, inline: false },
        ],
        url: castsPageUrl(event.id),
        footer: { text: "Achilléa Cast — attribution" },
        timestamp: new Date().toISOString(),
      },
    ],
  };
}

/** MP aux casters nouvellement attribués ; ne lève jamais. */
export async function notifyAttributions(
  db: CastDb,
  event: Pick<CastEvent, "id" | "name" | "kind" | "scheduledAt">,
  attributions: ReadonlyArray<{ slotId: string; userId: string | null }>,
): Promise<number> {
  const targets = attributions.filter(a => a.userId);
  if (targets.length === 0) return 0;
  try {
    const slots = await db
      .selectFrom("cast_slot")
      .select(["id", "role"])
      .where("id", "in", targets.map(a => a.slotId))
      .execute();
    const roles = new Map(slots.map(slot => [slot.id, slot.role]));
    const results = await Promise.all(
      targets.map(a => envoyerMpAchillea(a.userId as string, attributionMessage(event, roles.get(a.slotId) ?? ""))),
    );
    for (const result of results) if (!result.ok) console.warn("[casts] MP d'attribution non remis", result);
    return results.filter(r => r.ok).length;
  } catch (err) {
    console.error("[casts] MP d'attribution en échec", err);
    return 0;
  }
}

export type ReminderKind = "j2" | "h2";

const OFFSETS: Record<ReminderKind, { offset: number; window: number }> = {
  j2: { offset: 48 * 60 * 60 * 1000, window: 30 * 60 * 1000 },
  h2: { offset: 2 * 60 * 60 * 1000, window: 15 * 60 * 1000 },
};

export interface ReminderEvent {
  id: string;
  name: string;
  kind: string;
  scheduledAt: Date;
  twitchUrl: string | null;
}

export function reminderMessage(kind: ReminderKind, event: ReminderEvent, role: string): MessageAchillea {
  const ts = unix(event.scheduledAt);
  const twitch = event.twitchUrl ? [{ name: "Twitch", value: event.twitchUrl, inline: false }] : [];
  return {
    embeds: [
      kind === "j2"
        ? {
            title: "Rappel de cast — J-2",
            color: ACHILLEA_COLOR,
            description: "Tu as un cast dans **2 jours** ! Voici les informations :",
            fields: [
              { name: "Évènement", value: `${event.name} (${event.kind})`, inline: true },
              { name: "Rôle", value: roleLabel(role), inline: true },
              { name: "Date", value: `<t:${ts}:F>`, inline: false },
              ...twitch,
            ],
            footer: { text: "Achilléa Cast — rappel J-2" },
            timestamp: new Date().toISOString(),
          }
        : {
            title: "Rappel de cast — H-2 (dans 2h !)",
            color: ACHILLEA_COLOR,
            description: "Tu cast dans **2 heures** ! Vérifie que tout est prêt.",
            fields: [
              { name: "Évènement", value: `${event.name} (${event.kind})`, inline: true },
              { name: "Rôle", value: roleLabel(role), inline: true },
              { name: "Heure", value: `<t:${ts}:t>`, inline: false },
              ...twitch,
            ],
            footer: { text: "Achilléa Cast — rappel H-2" },
            timestamp: new Date().toISOString(),
          },
    ],
  };
}

export interface ReminderReport {
  kind: ReminderKind;
  events: number;
  sent: number;
  failed: number;
}

/** Envoie les rappels d'un type pour les diffusions entrant dans leur fenêtre. */
export async function dispatchReminders(db: CastDb, kind: ReminderKind, now = new Date()): Promise<ReminderReport> {
  const { offset, window } = OFFSETS[kind];
  const target = now.getTime() + offset;
  const flag = kind === "j2" ? "ca.notified_j2" : "ca.notified_h2";
  const rows = await db
    .selectFrom("cast_attribution as ca")
    .innerJoin("cast_slot as cs", "cs.id", "ca.slot_id")
    .innerJoin("cast_event as ce", "ce.id", "cs.event_id")
    .select([
      "ca.id as attribution_id",
      "ca.user_id",
      "cs.role",
      "ce.id as event_id",
      "ce.name",
      "ce.kind",
      "ce.scheduled_at",
      "ce.twitch_url",
    ])
    .where("ce.scheduled_at", ">=", new Date(target - window))
    .where("ce.scheduled_at", "<=", new Date(target + window))
    .where("ce.status", "not in", ["done", "cancelled"])
    .where("ca.confirmed_at", "is not", null)
    .where("ca.user_id", "is not", null)
    .where(flag, "=", false)
    .execute();

  const byEvent = new Map<string, typeof rows>();
  for (const row of rows) byEvent.set(row.event_id, [...(byEvent.get(row.event_id) ?? []), row]);

  let sent = 0;
  let failed = 0;
  for (const [, group] of byEvent) {
    const first = group[0]!;
    const event: ReminderEvent = {
      id: first.event_id,
      name: first.name,
      kind: first.kind,
      scheduledAt: new Date(first.scheduled_at),
      twitchUrl: first.twitch_url,
    };
    const done: string[] = [];
    const mentioned: string[] = [];
    let eventSent = 0;
    let eventFailed = 0;
    for (const row of group) {
      const result = await envoyerMpAchillea(row.user_id as string, reminderMessage(kind, event, row.role));
      if (result.ok) {
        done.push(row.attribution_id);
        mentioned.push(`<@${row.user_id}>`);
        eventSent++;
      } else if (result.statut === 403) {
        // MP fermés : on ne relancera pas ce caster à chaque passage.
        done.push(row.attribution_id);
      } else {
        eventFailed++;
      }
    }
    if (done.length > 0) {
      await db
        .updateTable("cast_attribution")
        .set(kind === "j2" ? { notified_j2: true } : { notified_h2: true })
        .where("id", "in", done)
        .execute();
      const staff = process.env.ACHILLEA_STAFF_CHANNEL_ID?.trim();
      if (staff) {
        const label = kind === "j2" ? "J-2" : "H-2";
        const recap = await publierSalonAchillea(staff, {
          content: [
            `**[Cast ${label}]** Rappels envoyés pour **${event.name}**`,
            `Casters notifiés : ${mentioned.length > 0 ? mentioned.join(", ") : "_aucun_"}`,
            `Bilan : ${eventSent} envoyé(s), ${eventFailed} échec(s)`,
          ].join("\n"),
        });
        if (!recap.ok) console.warn("[casts] récapitulatif staff non publié", recap);
      }
    }
    sent += eventSent;
    failed += eventFailed;
  }
  return { kind, events: byEvent.size, sent, failed };
}
