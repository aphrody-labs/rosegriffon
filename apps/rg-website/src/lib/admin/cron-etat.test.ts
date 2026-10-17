import { describe, expect, test } from "bun:test";
import type { DescriptionTache } from "@rosegriffon/types/cron";

import {
  bilanTaches,
  construireTaches,
  peutLancerDepuisLeSite,
  resumerExecutions,
  type ExecutionBrute,
} from "./cron-etat";

const decrire = (nom: string, niveau: DescriptionTache["niveau"] = "admin"): DescriptionTache =>
  ({
    nom,
    titre: `T ${nom}`,
    role: "r",
    planification: "0 * * * *",
    famille: "donnees",
    niveau,
    motifInterdiction: niveau === "interdit" ? "dangereux" : null,
    dureeIndicative: null,
  }) as unknown as DescriptionTache;

const ex = (tache: string, demarre_le: string, succes: boolean): ExecutionBrute => ({
  tache,
  demarre_le,
  duree_ms: 10,
  succes,
  erreur: succes ? null : "boum",
});

describe("resumerExecutions", () => {
  test("dernier état et dernier échec, quel que soit l'ordre des lignes", () => {
    const { dernieres, echecs } = resumerExecutions([
      ex("warm", "2026-10-17T10:00:00Z", false),
      ex("warm", "2026-10-17T12:00:00Z", true),
      ex("warm", "2026-10-17T11:00:00Z", false),
    ]);
    expect(dernieres.get("warm")?.demarre_le).toBe("2026-10-17T12:00:00Z");
    expect(echecs.get("warm")?.demarre_le).toBe("2026-10-17T11:00:00Z");
  });
});

describe("construireTaches", () => {
  const catalogue = [
    decrire("db", "interdit"),
    decrire("warm"),
    decrire("achillea:weekly-payout"),
    decrire("achillea:seasons"),
  ];

  test("alias d'historique : db est consignée sous db:sync", () => {
    const t = construireTaches(catalogue, null, [ex("db:sync", "2026-10-17T02:00:00Z", true)]);
    expect(t.find(x => x.nom === "db")?.dernier?.succes).toBe(true);
  });

  test("tâches du registre absentes du catalogue : ajoutées, lecture seule", () => {
    const t = construireTaches(catalogue, { registre: ["warm", "x", "x-search"] }, []);
    expect(t.map(x => x.nom)).toEqual(["db", "warm", "achillea:weekly-payout", "achillea:seasons", "x", "x-search"]);
    expect(t.find(x => x.nom === "x")).toMatchObject({ niveau: "cli", famille: "autre" });
    expect(t.find(x => x.nom === "x")?.motifBlocage).toContain("CLI");
  });

  test("achillea:seasons et weekly-payout ne sont jamais lançables, même par un admin", () => {
    const t = construireTaches(catalogue, null, []);
    for (const nom of ["achillea:seasons", "achillea:weekly-payout"]) {
      const tache = t.find(x => x.nom === nom)!;
      expect(tache.motifBlocage).toContain("financier");
      expect(peutLancerDepuisLeSite(tache, "admin")).toBe(false);
    }
  });

  test("tâche interdite du catalogue : motif repris", () => {
    expect(construireTaches(catalogue, null, []).find(x => x.nom === "db")?.motifBlocage).toBe("dangereux");
  });

  test("hors serverless repris de la réponse de l'API", () => {
    const t = construireTaches(catalogue, { horsServerless: { warm: "disque local" } }, []);
    expect(t.find(x => x.nom === "warm")?.horsServerless).toBe("disque local");
  });
});

describe("peutLancerDepuisLeSite", () => {
  const libre = { motifBlocage: null };
  test("administrateurs seulement", () => {
    expect(peutLancerDepuisLeSite(libre, "admin")).toBe(true);
    expect(peutLancerDepuisLeSite(libre, "superadmin")).toBe(true);
    expect(peutLancerDepuisLeSite(libre, "staff")).toBe(false);
    expect(peutLancerDepuisLeSite(libre, null)).toBe(false);
  });
});

describe("bilanTaches", () => {
  test("compte réussies, échecs et jamais exécutées", () => {
    const t = construireTaches([decrire("a"), decrire("b"), decrire("c")], null, [
      ex("a", "2026-10-17T10:00:00Z", true),
      ex("b", "2026-10-17T10:00:00Z", false),
    ]);
    expect(bilanTaches(t)).toEqual({ total: 3, enEchec: 1, jamaisExecutees: 1, reussies: 1 });
  });
});
