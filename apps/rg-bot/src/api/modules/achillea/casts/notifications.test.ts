/**
 * Rappels de cast J-2 / H-2 : parité avec `CastNotificationService` de
 * `legacy/achillea-bot` (`_buildJ2Embed`, `_buildH2Embed`).
 */
import { describe, expect, test } from "bun:test";

import { reminderMessage } from "./notifications";

const EVENEMENT = {
  id: "evt-1",
  name: "Coupe des Clans",
  kind: "tournament",
  scheduledAt: new Date("2026-11-07T18:00:00.000Z"),
  twitchUrl: "https://twitch.tv/achillea",
};

describe("rappels de cast (parité legacy)", () => {
  test("J-2 : blurple, libellés et pied de l'ancien bot, rôle brut", () => {
    const embed = reminderMessage("j2", EVENEMENT, "caster_main").embeds?.[0];
    expect(embed).toMatchObject({
      title: "Rappel de cast — J-2",
      color: 0x58_65_f2,
      description: "Tu as un cast dans **2 jours** ! Voici les informations :",
      footer: { text: "Achillea Cast — rappel J-2" },
    });
    expect(embed?.fields).toEqual([
      { name: "Evenement", value: "Coupe des Clans (tournament)", inline: true },
      { name: "Role", value: "caster_main", inline: true },
      { name: "Date", value: `<t:${Math.floor(EVENEMENT.scheduledAt.getTime() / 1000)}:F>`, inline: false },
      { name: "Twitch", value: "https://twitch.tv/achillea", inline: false },
    ]);
  });

  test("H-2 : rouge, « Verifie que tout est pret. », heure courte", () => {
    const embed = reminderMessage("h2", { ...EVENEMENT, twitchUrl: null }, "observer").embeds?.[0];
    expect(embed).toMatchObject({
      title: "Rappel de cast — H-2 (dans 2h !)",
      color: 0xed_42_45,
      description: "Tu cast dans **2 heures** ! Verifie que tout est pret.",
      footer: { text: "Achillea Cast — rappel H-2" },
    });
    expect((embed?.fields as Array<{ name: string }> | undefined)?.map(f => f.name)).toEqual(["Evenement", "Role", "Heure"]);
  });
});
