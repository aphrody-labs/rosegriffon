import { afterEach, describe, expect, test } from "bun:test";

import { fausseInteraction, installerApi, type AppelApi } from "../../../test/achillea-kit";
import { CommandeReport } from "./report";

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

const CIBLE = { id: "333333333333333333", username: "fautif", bot: false };
const note = {
  id: "n1",
  target: null,
  author: null,
  tournament: null,
  category: "cheating",
  severity: "serious",
  content: "macro",
  resolved: false,
  resolvedAt: null,
  resolvedBy: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  docsUrl: null,
};

describe("/report", () => {
  test("nominal : note créée au nom de l'auteur, réponse privée", async () => {
    const appels = api({ "POST /player-notes": note });
    const interaction = fausseInteraction();
    await new CommandeReport().report(CIBLE as never, "macro", "cheating" as never, "serious" as never, undefined, interaction as never);
    expect(interaction.envois[0]).toMatchObject({ via: "deferReply" });
    expect(appels[0]?.corps).toMatchObject({ targetId: CIBLE.id, content: "macro", category: "cheating", severity: "serious" });
    expect(interaction.texte()).toContain("Signalement enregistré");
    expect(interaction.texte()).toContain("Triche suspectée");
  });

  test("refus (403) : le motif de l'API est montré", async () => {
    api({ "POST /player-notes": [403, { message: "Staff ou organisateur du tournoi requis" }] });
    const interaction = fausseInteraction();
    await new CommandeReport().report(CIBLE as never, "x", undefined, undefined, undefined, interaction as never);
    expect(interaction.texte()).toContain("Staff ou organisateur du tournoi requis");
  });

  test("un bot ou soi-même : refus avant tout appel", async () => {
    const appels = api({});
    const interaction = fausseInteraction();
    await new CommandeReport().report({ ...CIBLE, bot: true } as never, "x", undefined, undefined, undefined, interaction as never);
    await new CommandeReport().report({ id: "111111111111111111", username: "moi" } as never, "x", undefined, undefined, undefined, interaction as never);
    expect(appels).toEqual([]);
    expect(interaction.texte()).toContain("On ne signale pas un bot");
  });

  test("tournoi inconnu : arrêt avant la note", async () => {
    const appels = api({ "GET /tournaments/42": [404, { message: "Tournament not found" }] });
    const interaction = fausseInteraction();
    await new CommandeReport().report(CIBLE as never, "x", undefined, undefined, 42, interaction as never);
    expect(appels.map(a => a.chemin)).toEqual(["/tournaments/42"]);
    expect(interaction.texte()).toContain("Tournament not found");
  });
});

describe("/report-tournois", () => {
  test("liste les tournois ouverts (états transmis)", async () => {
    const appels = api({
      "GET /tournaments": {
        data: [{ id: 12, name: "Coupe", description: "", type: "TOURNAMENT", status: "Ongoing", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }],
        meta: { total: 1 },
      },
    });
    const interaction = fausseInteraction();
    await new CommandeReport().tournois(interaction as never);
    expect(appels[0]?.chemin).toBe("/tournaments");
    expect(interaction.texte()).toContain("`12` — Coupe");
  });

  test("API en panne : message lisible", async () => {
    api({ "GET /tournaments": [500, {}] });
    const interaction = fausseInteraction();
    await new CommandeReport().tournois(interaction as never);
    expect(interaction.texte()).toContain("HTTP 500");
  });
});
