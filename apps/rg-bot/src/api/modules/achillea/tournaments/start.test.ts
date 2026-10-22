/**
 * Démarrage d'un tournoi sans phase : règles pures (manches, lobbys de l'arbre)
 * et gardes des routes. Aucun appel n'atteint Postgres : les refus 401
 * précèdent toute lecture.
 */
import { describe, expect, test } from "bun:test";

import { tournamentController } from "./index";
import { lobbysAOuvrir, nombreManches, REFUS_DEMARRAGE } from "./start";

describe("démarrage sans phase — règles du legacy `generateLobbies`", () => {
  test("une manche par partie du format (legacy `getChildCount`)", () => {
    expect(nombreManches("bo1")).toBe(1);
    expect(nombreManches("bo3")).toBe(3);
    expect(nombreManches("bo5")).toBe(5);
    expect(nombreManches("double_leg")).toBe(2);
    expect(nombreManches("custom", 7)).toBe(7);
    expect(nombreManches("custom", null)).toBe(1);
    expect(nombreManches(null)).toBe(1);
    expect(nombreManches("inconnu")).toBe(1);
  });

  const joueurs = new Map([
    [10, "u1"],
    [11, "u2"],
    [12, "u3"],
    [13, "u4"],
  ]);

  test("un lobby par match aux deux camps connus, équipe 1 = opponent1", () => {
    const matchs = [
      { id: 1, opponent1: { id: 10 }, opponent2: { id: 13 } },
      { id: 2, opponent1: { id: 11 }, opponent2: { id: 12 } },
    ];
    expect(lobbysAOuvrir(matchs, joueurs, new Set())).toEqual([
      { matchId: 1, equipe1: "u1", equipe2: "u4" },
      { matchId: 2, equipe1: "u2", equipe2: "u3" },
    ]);
  });

  test("ni bye, ni tour futur, ni participant inconnu", () => {
    const matchs = [
      { id: 1, opponent1: { id: 10 }, opponent2: null },
      { id: 2, opponent1: { id: null }, opponent2: { id: 11 } },
      { id: 3, opponent1: { id: 12 }, opponent2: { id: 99 } },
      { id: 4, opponent1: null, opponent2: null },
    ];
    expect(lobbysAOuvrir(matchs, joueurs, new Set())).toEqual([]);
  });

  test("idempotent : un match qui a déjà son lobby est sauté", () => {
    const matchs = [
      { id: 1, opponent1: { id: 10 }, opponent2: { id: 13 } },
      { id: 2, opponent1: { id: "11" }, opponent2: { id: "12" } },
    ];
    expect(lobbysAOuvrir(matchs, joueurs, new Set([1]))).toEqual([{ matchId: 2, equipe1: "u2", equipe2: "u3" }]);
  });

  test("messages de refus explicites", () => {
    expect(REFUS_DEMARRAGE.sansArbre).toContain("aucun arbre");
    expect(REFUS_DEMARRAGE.championnat).toContain("phase");
  });
});

describe("routes de démarrage", () => {
  test("PUT /start/:id sans session → 401", async () => {
    const reponse = await tournamentController.handle(new Request("http://localhost/tournaments/start/12", { method: "PUT" }));
    expect(reponse.status).toBe(401);
  });

  test("POST /internal/:id/start sans jeton ou avec un mauvais jeton → 401", async () => {
    const precedent = process.env.API_ADMIN_TOKEN;
    process.env.API_ADMIN_TOKEN = "jeton-interne-de-test";
    try {
      for (const entetes of [{}, { authorization: "Bearer mauvais" }] as Array<Record<string, string>>) {
        const reponse = await tournamentController.handle(
          new Request("http://localhost/tournaments/internal/12/start", { method: "POST", headers: entetes }),
        );
        expect(reponse.status).toBe(401);
        expect(await reponse.json()).toEqual({ message: "Internal authentication required" });
      }
    } finally {
      if (precedent === undefined) delete process.env.API_ADMIN_TOKEN;
      else process.env.API_ADMIN_TOKEN = precedent;
    }
  });
});
