import { describe, expect, test } from "bun:test";
import { libelleRedondantAvecTitre } from "./libelle-redondant";

describe("libelleRedondantAvecTitre", () => {
  test("badge repris mot pour mot en tête du titre", () => {
    expect(
      libelleRedondantAvecTitre(
        "Critique",
        "Critique communautaire d'Inazuma Eleven",
      ),
    ).toBe(true);
    expect(
      libelleRedondantAvecTitre("Événement", "evenement : tournoi d'été"),
    ).toBe(true);
    expect(libelleRedondantAvecTitre("Critique", "Critique")).toBe(true);
  });

  test("mot différent ou simple préfixe : le badge reste", () => {
    expect(libelleRedondantAvecTitre("Critique", "Critiques des fans")).toBe(
      false,
    );
    expect(libelleRedondantAvecTitre("Critique", "Autocritique")).toBe(false);
    expect(
      libelleRedondantAvecTitre("Communauté", "Le tournoi de la communauté"),
    ).toBe(false);
  });

  test("valeurs absentes", () => {
    expect(libelleRedondantAvecTitre(null, "Titre")).toBe(false);
    expect(libelleRedondantAvecTitre("Critique", undefined)).toBe(false);
    expect(libelleRedondantAvecTitre("", "Titre")).toBe(false);
  });
});
