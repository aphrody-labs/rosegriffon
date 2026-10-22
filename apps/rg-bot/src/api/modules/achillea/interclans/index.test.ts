/**
 * Routes `/interclans` sans base : authentification et validation des entrées
 * sont tranchées AVANT toute requête SQL.
 */
import { describe, expect, test } from "bun:test";

import { interclanController } from "./index";

const requete = (methode: string, chemin: string, corps?: unknown, entetes: Record<string, string> = {}) =>
  interclanController.handle(
    new Request(`http://api.test/interclans${chemin}`, {
      method: methode,
      headers: { "content-type": "application/json", ...entetes },
      ...(corps === undefined ? {} : { body: JSON.stringify(corps) }),
    }),
  );

describe("écritures sans session : 401", () => {
  const cas: Array<[string, string, unknown]> = [
    ["POST", "", { challengedShortName: "BB", date: "25/10 20:00" }],
    ["POST", "/42/respond", { accept: true }],
    ["PUT", "/42/lineups/7", { members: [{ userId: "110000000000000000", position: 1 }] }],
    ["POST", "/42/lineups/7/lock", undefined],
    ["POST", "/42/cancel", undefined],
    ["POST", "/42/start", undefined],
    ["POST", "/matches/100/score", { scoreA: 2, scoreB: 1 }],
    ["POST", "/42/arbitrate", { approve: true }],
  ];
  for (const [methode, chemin, corps] of cas) {
    test(`${methode} /interclans${chemin}`, async () => {
      const reponse = await requete(methode, chemin, corps);
      expect(reponse.status).toBe(401);
      expect(await reponse.json()).toEqual({ message: "Authentication required" });
    });
  }

  test("un jeton invalide ne vaut pas une session", async () => {
    const reponse = await requete("POST", "/42/start", undefined, { authorization: "Bearer faux.jeton.signe" });
    expect(reponse.status).toBe(401);
  });

  test("la liste « mine » exige une session", async () => {
    expect((await requete("GET", "?mine=true")).status).toBe(401);
  });
});

describe("route interne d'entretien", () => {
  test("sans jeton ou avec un mauvais jeton : 401", async () => {
    const precedent = process.env.API_ADMIN_TOKEN;
    process.env.API_ADMIN_TOKEN = "jeton-interne-de-test";
    try {
      const sans = await requete("POST", "/internal/maintenance", {});
      expect(sans.status).toBe(401);
      expect(await sans.json()).toEqual({ message: "Internal authentication required" });
      const faux = await requete("POST", "/internal/maintenance", {}, { authorization: "Bearer autre-jeton" });
      expect(faux.status).toBe(401);
    } finally {
      if (precedent === undefined) delete process.env.API_ADMIN_TOKEN;
      else process.env.API_ADMIN_TOKEN = precedent;
    }
  });

  test("sans API_ADMIN_TOKEN configuré, aucun jeton n'ouvre la route", async () => {
    const precedent = process.env.API_ADMIN_TOKEN;
    delete process.env.API_ADMIN_TOKEN;
    try {
      expect((await requete("POST", "/internal/maintenance", {}, { authorization: "Bearer " })).status).toBe(401);
    } finally {
      if (precedent !== undefined) process.env.API_ADMIN_TOKEN = precedent;
    }
  });
});

describe("validation des entrées", () => {
  test("score hors bornes, position hors 1–5, sans date : refusés avant le service", async () => {
    expect((await requete("POST", "/matches/100/score", { scoreA: -1, scoreB: 1 })).status).toBeGreaterThanOrEqual(400);
    expect((await requete("POST", "/matches/100/score", { scoreA: -1, scoreB: 1 })).status).not.toBe(401);
    expect((await requete("PUT", "/42/lineups/7", { members: [{ userId: "110000000000000000", position: 6 }] })).status).not.toBe(200);
    expect((await requete("POST", "", { challengedShortName: "BB" })).status).not.toBe(200);
    expect((await requete("POST", "/abc/start")).status).not.toBe(200);
  });
});
