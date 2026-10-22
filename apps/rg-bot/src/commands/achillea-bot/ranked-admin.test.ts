import { afterEach, describe, expect, test } from "bun:test";

import { fausseInteraction, installerApi, type AppelApi } from "../../../test/achillea-kit";
import { CommandeRankedAdmin, origineRanked } from "./ranked-admin";

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

const joueur = (id: string, nom: string) => ({
  userId: id,
  displayName: nom,
  submittedScore: 2,
  claimedOpponentScore: 1,
  screenshotUrl: "/storage/disputes/1.png",
});
const REFUS = [403, { message: "Administrator role required" }] as const;

describe("/ranked-admin", () => {
  test("litiges : liste avec captures absolues", async () => {
    api({
      "GET /admin/lobbies/disputes": [
        { lobbyId: 7, mode: 2, player1: joueur("1", "Akira"), player2: joueur("2", "Bo"), createdAt: new Date().toISOString() },
      ],
    });
    const interaction = fausseInteraction();
    await new CommandeRankedAdmin().litiges(interaction as never);
    expect(interaction.texte()).toContain("Lobby #7");
    expect(interaction.texte()).toContain(`${origineRanked({})}/storage/disputes/1.png`);
  });

  test("litiges : aucun", async () => {
    api({ "GET /admin/lobbies/disputes": [] });
    const interaction = fausseInteraction();
    await new CommandeRankedAdmin().litiges(interaction as never);
    expect(interaction.texte()).toContain("Aucun litige");
  });

  test("valider : score, forfait et Elo", async () => {
    const appels = api({ "POST /admin/lobbies/7/validate": { ok: true, eloDelta: 12 } });
    const interaction = fausseInteraction();
    await new CommandeRankedAdmin().valider(7, 3, 1, { id: "999999999999999991", username: "x" } as never, interaction as never);
    expect(appels[0]?.corps).toEqual({ scoreTeam1: 3, scoreTeam2: 1, forfeitUserId: "999999999999999991" });
    expect(interaction.texte()).toContain("+12");
  });

  test("valider refusé (403)", async () => {
    api({ "POST /admin/lobbies/7/validate": REFUS });
    const interaction = fausseInteraction();
    await new CommandeRankedAdmin().valider(7, 3, 1, undefined, interaction as never);
    expect(interaction.texte()).toContain("Administrator role required");
  });

  test("annuler : nominal et conflit", async () => {
    api({ "POST /admin/lobbies/7/cancel": { ok: true }, "POST /admin/lobbies/8/cancel": [409, { message: "Lobby déjà résolu" }] });
    const ok = fausseInteraction();
    await new CommandeRankedAdmin().annuler(7, ok as never);
    expect(ok.texte()).toContain("Match annulé");
    const conflit = fausseInteraction();
    await new CommandeRankedAdmin().annuler(8, conflit as never);
    expect(conflit.texte()).toContain("Lobby déjà résolu");
  });

  test("logs : filtre par lobby transmis à l'API", async () => {
    const appels = api({
      "GET /admin/ranked/telemetry": [
        { id: 1, createdAt: new Date().toISOString(), lobbyId: 7, roomCode: null, mode: 2, userId: "1", displayName: "Akira", type: "score_submitted", detail: {} },
      ],
    });
    const interaction = fausseInteraction();
    await new CommandeRankedAdmin().logs(7, interaction as never);
    expect(appels[0]?.chemin).toBe("/admin/ranked/telemetry");
    expect(interaction.texte()).toContain("score_submitted");
  });

  test("logs refusé (403)", async () => {
    api({ "GET /admin/ranked/telemetry": [403, { message: "Moderator role required" }] });
    const interaction = fausseInteraction();
    await new CommandeRankedAdmin().logs(undefined, interaction as never);
    expect(interaction.texte()).toContain("Moderator role required");
  });
});
