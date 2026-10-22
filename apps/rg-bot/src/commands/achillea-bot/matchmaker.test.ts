import { afterEach, describe, expect, test } from "bun:test";

import { fausseInteraction, installerApi, type AppelApi } from "../../../test/achillea-kit";
import { BoutonsFileRanked, estCodeDefi, suffixe } from "./matchmaker";

let restaurer: (() => void) | null = null;
afterEach(() => {
  restaurer?.();
  restaurer = null;
});
function api(routes: Parameters<typeof installerApi>[0]): AppelApi[] {
  const installation = installerApi(routes);
  restaurer = installation.restaurer;
  return installation.appels;
}

const defi = { code: "AbC123xy", url: "https://rosegriffon.fr/achillea/ranked/defi/AbC123xy", mode: 2, ranked: true, toUserId: null, expiresAt: Date.now() + 600_000 };

describe("analyse des custom_id", () => {
  test("ancien identifiant numérique ≠ code de défi", () => {
    expect(suffixe("leave_queue:AbC123xy")).toBe("AbC123xy");
    expect(estCodeDefi("AbC123xy")).toBe(true);
    expect(estCodeDefi("42")).toBe(false);
    expect(estCodeDefi("a b")).toBe(false);
  });
});

describe("join_queue", () => {
  test("crée un défi classé et propose de le retirer", async () => {
    const appels = api({ "POST /ranked/challenge": defi });
    const interaction = fausseInteraction({ customId: "join_queue:12" });
    await new BoutonsFileRanked().rejoindre(interaction as never);
    expect(appels[0]?.corps).toEqual({ ranked: true });
    expect(interaction.texte()).toContain(defi.url);
    expect(interaction.texte()).toContain("leave_queue:AbC123xy");
  });

  test("refus (403)", async () => {
    api({ "POST /ranked/challenge": [403, { message: "Compte sur liste noire" }] });
    const interaction = fausseInteraction({ customId: "join_queue:12" });
    await new BoutonsFileRanked().rejoindre(interaction as never);
    expect(interaction.texte()).toContain("Compte sur liste noire");
  });
});

describe("leave_queue", () => {
  test("code de défi : annulation par l'API", async () => {
    const appels = api({ "DELETE /ranked/challenge/AbC123xy": { ok: true } });
    const interaction = fausseInteraction({ customId: "leave_queue:AbC123xy" });
    await new BoutonsFileRanked().quitter(interaction as never);
    expect(appels).toHaveLength(1);
    expect(interaction.texte()).toContain("Défi retiré");
  });

  test("ancien message : aucune file Discord, renvoi au site", async () => {
    const appels = api({});
    const interaction = fausseInteraction({ customId: "leave_queue:12" });
    await new BoutonsFileRanked().quitter(interaction as never);
    expect(appels).toEqual([]);
    expect(interaction.texte()).toContain("Plus de file Discord");
  });

  test("annulation refusée (403)", async () => {
    api({ "DELETE /ranked/challenge/AbC123xy": [403, { message: "Ce défi n'est pas le tien" }] });
    const interaction = fausseInteraction({ customId: "leave_queue:AbC123xy" });
    await new BoutonsFileRanked().quitter(interaction as never);
    expect(interaction.texte()).toContain("pas le tien");
  });
});

describe("confirm_presence", () => {
  test("renvoie vers la salle du match", async () => {
    api({ "GET /ranked/me": { userId: "111111111111111111", mode: 2, elo: 1000, peakRating: 1000, gamesPlayed: 0, wins: 0, losses: 0, tier: null, seasonId: null } });
    const interaction = fausseInteraction({ customId: "confirm_presence:9" });
    await new BoutonsFileRanked().confirmerPresence(interaction as never);
    expect(interaction.texte()).toContain("/ranked/match");
  });

  test("sans compte ranked (401)", async () => {
    api({ "GET /ranked/me": [401, { message: "Authentication required" }] });
    const interaction = fausseInteraction({ customId: "confirm_presence:9" });
    await new BoutonsFileRanked().confirmerPresence(interaction as never);
    expect(interaction.texte()).toContain("Session refusée");
  });
});
