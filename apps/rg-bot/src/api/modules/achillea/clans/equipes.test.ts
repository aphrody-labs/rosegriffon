/**
 * `/clans/teams` — règles pures et refus avant toute base.
 *
 * Les routes d'écriture sont exercées jusqu'à l'authentification et la
 * validation du corps : aucune connexion SQL n'est ouverte ici.
 */
import { describe, expect, test } from "bun:test";

import {
  capitaineApres,
  clanTeamsController,
  erreursValidite,
  estRoleEquipe,
  estTypeEquipe,
  LIMITE_PAR_ROLE,
  nomEquipeValide,
  planifierEffectif,
} from "./equipes";

const MEMBRES = new Set(["1001", "1002", "1003", "1004", "1005", "1006", "1007"]);

describe("planifierEffectif", () => {
  test("remplace l'effectif du rôle : retire les absents, ajoute les nouveaux", () => {
    const plan = planifierEffectif({
      role: 0,
      equipeId: 1,
      demandes: ["1001", " 1003 ", "", "1003"],
      membresDuClan: MEMBRES,
      liensDuRole: [
        { linkId: 10, userId: "1001" },
        { linkId: 11, userId: "1002" },
      ],
      occupes: [],
    });
    expect(plan).toEqual({ ok: true, retirer: [11], ajouter: ["1003"] });
  });

  test("refuse un identifiant étranger au clan (400)", () => {
    const plan = planifierEffectif({
      role: 1,
      equipeId: 1,
      demandes: ["9999"],
      membresDuClan: MEMBRES,
      liensDuRole: [],
      occupes: [],
    });
    expect(plan).toMatchObject({ ok: false, statut: 400 });
    if (!plan.ok) expect(plan.message).toContain("9999");
  });

  test("refuse au-delà de la limite du rôle", () => {
    const plan = planifierEffectif({
      role: 2,
      equipeId: 1,
      demandes: ["1001", "1002"],
      membresDuClan: MEMBRES,
      liensDuRole: [],
      occupes: [],
    });
    expect(plan).toMatchObject({ ok: false, statut: 400, message: "Trop de coachs (limite 1)." });
    expect(LIMITE_PAR_ROLE).toEqual({ 0: 5, 1: 2, 2: 1 });
  });

  test("un membre déjà placé ailleurs est refusé (409), en nommant l'équipe", () => {
    const plan = planifierEffectif({
      role: 0,
      equipeId: 1,
      demandes: ["1004"],
      membresDuClan: MEMBRES,
      liensDuRole: [],
      occupes: [{ userId: "1004", teamId: 2, teamName: "Equipe secondaire", role: 2 }],
    });
    expect(plan).toMatchObject({ ok: false, statut: 409 });
    if (!plan.ok) expect(plan.message).toContain("Equipe secondaire");
  });
});

describe("capitaineApres", () => {
  test("conservé s'il reste joueur", () => {
    expect(capitaineApres({ capitaineActuel: 10, joueursRestants: [10, 12], joueursAjoutes: [20] })).toBe(10);
  });
  test("retiré : le premier joueur restant, sinon le premier ajouté", () => {
    expect(capitaineApres({ capitaineActuel: 10, joueursRestants: [12], joueursAjoutes: [20] })).toBe(12);
    expect(capitaineApres({ capitaineActuel: 10, joueursRestants: [], joueursAjoutes: [20] })).toBe(20);
    expect(capitaineApres({ capitaineActuel: null, joueursRestants: [], joueursAjoutes: [] })).toBeNull();
  });
});

describe("validité et gardes", () => {
  test("3 joueurs minimum, 2 remplaçants et 1 coach maximum", () => {
    expect(erreursValidite([{ role: 0 }, { role: 0 }])).toEqual(["Il faut au moins 3 joueurs."]);
    expect(erreursValidite([{ role: 0 }, { role: 0 }, { role: 0 }, { role: 2 }])).toEqual([]);
    expect(erreursValidite([{ role: 0 }, { role: 0 }, { role: 0 }, { role: 2 }, { role: 2 }])).toEqual([
      "Pas plus d'un coach.",
    ]);
  });
  test("types, rôles et noms", () => {
    expect([estTypeEquipe(0), estTypeEquipe(1), estTypeEquipe(2)]).toEqual([true, true, false]);
    expect([estRoleEquipe(2), estRoleEquipe(3)]).toEqual([true, false]);
    expect([nomEquipeValide("ab"), nomEquipeValide(" Raimon "), nomEquipeValide("x".repeat(31))]).toEqual([false, true, false]);
  });
});

describe("routes : refus avant la base", () => {
  const appeler = (methode: string, chemin: string, corps?: unknown) =>
    clanTeamsController.handle(
      new Request(`http://localhost/clans/teams${chemin}`, {
        method: methode,
        headers: { "content-type": "application/json" },
        body: corps === undefined ? undefined : JSON.stringify(corps),
      }),
    );

  test("sans session : 401 sur toutes les écritures et sur /membership", async () => {
    for (const [methode, chemin, corps] of [
      ["GET", "/membership", undefined],
      ["POST", "/", { clanId: 1, type: 0 }],
      ["PUT", "/3/roster", { role: 0, userIds: [] }],
      ["PATCH", "/3", { name: "Raimon" }],
      ["DELETE", "/3", undefined],
    ] as const) {
      const reponse = await appeler(methode, chemin, corps);
      expect(`${methode} ${chemin} → ${reponse.status}`).toBe(`${methode} ${chemin} → 401`);
    }
  });

  test("corps invalide : 422 avant toute lecture", async () => {
    const reponse = await appeler("PUT", "/3/roster", { role: "joueur" });
    expect(reponse.status).toBe(422);
  });
});
