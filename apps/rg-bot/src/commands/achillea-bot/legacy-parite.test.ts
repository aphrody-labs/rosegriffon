/**
 * Parité visuelle avec `legacy/achillea-bot` : couleurs `Colors.*` de
 * discord.js, ordre des champs, pieds de page — exactement ce que l'ancien bot
 * posait (`SanctionCommands.ts`, `RankedAdmin.ts`, `blacklist-view.ts`,
 * `OAuthService.ts`). Aucun pied de marque : l'ancien bot n'en avait pas.
 */
import { afterEach, describe, expect, test } from "bun:test";
import type { APIEmbed } from "discord.js";

import { fausseInteraction, installerApi } from "../../../test/achillea-kit";
import { dateFrancaiseLegacy } from "../../lib/achillea-legacy";
import { ficheListeNoire, texteListeNoire } from "./joueur";
import { CommandeRankedAdmin, deltasElo } from "./ranked-admin";
import { CommandeSanction } from "./sanction";

let restaurer: (() => void) | null = null;
afterEach(() => {
  restaurer?.();
  restaurer = null;
});
function api(routes: Parameters<typeof installerApi>[0]): void {
  restaurer = installerApi(routes).restaurer;
}

/** Dernier embed envoyé, en JSON. */
function dernierEmbed(interaction: ReturnType<typeof fausseInteraction>): APIEmbed {
  for (const envoi of [...interaction.envois].reverse()) {
    const embeds = (envoi.charge as { embeds?: Array<{ toJSON?: () => APIEmbed } | APIEmbed> } | undefined)?.embeds;
    const embed = embeds?.[0];
    if (embed) return "toJSON" in embed && typeof embed.toJSON === "function" ? embed.toJSON() : (embed as APIEmbed);
  }
  throw new Error("aucun embed envoyé");
}

const SERVEUR = "1055585286320554055";
const CIBLE = { id: "333333333333333333", username: "fautif", bot: false, displayName: "Fautif" };
const sanction = (champs: Record<string, unknown> = {}) => ({
  id: "5d1c2a9e-0000-4000-8000-000000000001",
  userId: CIBLE.id,
  guildId: SERVEUR,
  type: "warn",
  reason: "spam",
  durationSec: null,
  issuedBy: "111111111111111111",
  issuedByType: "staff",
  expiresAt: null,
  revokedAt: null,
  revokedBy: null,
  revokeReason: null,
  evidence: null,
  createdAt: new Date().toISOString(),
  ...champs,
});
const page = (data: unknown[]) => ({ data, total: data.length, meta: { page: 1, pageSize: 100, pageCount: 1 } });

describe("parité legacy : /sanction", () => {
  test("warn : jaune, Utilisateur · Raison · ID, sans pied", async () => {
    api({ "POST /sanctions": sanction(), "GET /sanctions": page([sanction()]) });
    const interaction = fausseInteraction({ guildId: SERVEUR, client: { guilds: { fetch: async () => ({}) } } });
    await new CommandeSanction().warn(CIBLE as never, "spam", undefined, interaction as never);
    const embed = dernierEmbed(interaction);
    expect(embed.color).toBe(0xfe_e7_5c);
    expect(embed.title).toBe("⚠️ Avertissement émis");
    expect(embed.fields?.map(f => [f.name, f.inline])).toEqual([
      ["Utilisateur", true],
      ["Raison", false],
      ["ID sanction", true],
    ]);
    expect(embed.footer).toBeUndefined();
    expect(embed.timestamp).toBeDefined();
  });

  test("list : vert sans sanction, orange avec, ID tronqué", async () => {
    api({ "GET /sanctions": page([]) });
    const vide = fausseInteraction({ guildId: SERVEUR });
    await new CommandeSanction().list(CIBLE as never, vide as never);
    expect(dernierEmbed(vide)).toMatchObject({ color: 0x57_f2_87, title: "fautif — Sanctions actives", description: "Aucune sanction active." });

    restaurer?.();
    api({ "GET /sanctions": page([sanction()]) });
    const pleine = fausseInteraction({ guildId: SERVEUR });
    await new CommandeSanction().list(CIBLE as never, pleine as never);
    const embed = dernierEmbed(pleine);
    expect(embed.color).toBe(0xe6_7e_22);
    expect(embed.fields?.map(f => f.name)).toEqual(["Type", "Raison", "Durée", "Expire", "ID (tronqué)"]);
    expect(embed.fields?.[4]?.value).toBe("`5d1c2a9e…`");
    expect(embed.footer).toBeUndefined();
  });
});

describe("parité legacy : /ranked-admin", () => {
  test("litiges vides : vert, sans pied", async () => {
    api({ "GET /admin/lobbies/disputes": [] });
    const interaction = fausseInteraction();
    await new CommandeRankedAdmin().litiges(interaction as never);
    expect(dernierEmbed(interaction)).toMatchObject({ color: 0x57_f2_87, title: "🎖️ Litiges ranked", description: "Aucun litige en attente. ✅" });
    expect(dernierEmbed(interaction).footer).toBeUndefined();
  });

  test("valider : ΔELO joueur 1 et joueur 2, vert", async () => {
    api({ "POST /admin/lobbies/7/validate": { ok: true, eloDelta: 12 } });
    const interaction = fausseInteraction();
    await new CommandeRankedAdmin().valider(7, 3, 1, undefined, interaction as never);
    const embed = dernierEmbed(interaction);
    expect(embed.color).toBe(0x57_f2_87);
    expect(embed.title).toBe("✅ Litige tranché — Lobby #7");
    expect(embed.fields?.map(f => [f.name, f.inline])).toEqual([
      ["Score appliqué", true],
      ["ΔELO joueur 1", true],
      ["ΔELO joueur 2", true],
      ["Forfait", false],
      ["Arbitre", false],
    ]);
    expect(deltasElo({ p1: 15, p2: -15 })).toEqual(["+15", "-15"]);
  });

  test("annuler : rouge ; logs vides : bleu, sans pied", async () => {
    api({ "POST /admin/lobbies/7/cancel": { ok: true }, "GET /admin/ranked/telemetry": [] });
    const annule = fausseInteraction();
    await new CommandeRankedAdmin().annuler(7, annule as never);
    expect(dernierEmbed(annule)).toMatchObject({ color: 0xed_42_45, title: "🚫 Match annulé — Lobby #7" });
    const logs = fausseInteraction();
    await new CommandeRankedAdmin().logs(undefined, logs as never);
    expect(dernierEmbed(logs)).toMatchObject({ color: 0x34_98_db, title: "📜 Journal ranked", description: "Aucun événement." });
    expect(dernierEmbed(logs).footer).toBeUndefined();
  });
});

describe("parité legacy : /blacklist", () => {
  test("fiche de liste noire : NotQuiteBlack, « Raison: », date française", () => {
    const embed = ficheListeNoire({ userId: "1", displayName: "Akira", username: "akira", reason: null, since: "2026-10-27T11:02:00.000Z" }).toJSON();
    expect(embed.color).toBe(0x23_27_2a);
    expect(embed.title).toBe("Akira - Liste Noire");
    expect(embed.description).toBe(
      "**Raison:** Cet utilisateur est présent sur la Liste Noire d'Achillea sur décision des Administrateurs.",
    );
    expect(embed.fields?.map(f => f.name)).toEqual(["Identifiant", "Nom d'utilisateur", "Depuis le"]);
    expect(dateFrancaiseLegacy("2026-10-27T11:02:00.000Z")).toBe("27 oct. à 12h02");
    expect(texteListeNoire([])).toBe("Il n'y a aucun utilisateur sur la liste noire.");
  });
});
