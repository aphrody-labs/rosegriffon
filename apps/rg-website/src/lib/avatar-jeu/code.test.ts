import { describe, expect, test } from "bun:test";

import { encoder, longueurCode, specDe, valeursDepuisChoix } from "@/app/wiki/avatar/partage";
import type { Catalogue, Part } from "@/app/wiki/avatar/types";

import { analyserCode, extraireCode, urlApercu } from "./code";

// Alphabet publié par le catalogue du jeu (64 caractères distincts).
const ALPHABET = [..."3456789ABCDEFGHJKLMNPQRSTUVWXYabcdefghijkmnpqrstuvwxy!?-#$*&=+><"];

const part = (id: string, resource: string, modele: string): Part => ({
  id,
  itemNo: 0,
  viewNo: 0,
  gender: 0,
  resource,
  resourceHash: id,
  resource2: null,
  modeles: [modele],
  modeles2: [],
  icone: null,
  iconeHash: id,
  atlasCentre: null,
  poseTransMode: null,
  poseTrans: null,
  poseScale: null,
  resource2Connu: false,
});

// 86 emplacements totalisant 410 bits, comme le jeu : 66 de 5 bits et 20 de 4 bits.
const emplacements = Array.from({ length: 86 }, (_, i) => {
  const bits = i < 66 ? 5 : 4;
  return { emplacement: i, bits, valeurs: 2 ** bits, categorie: 0, param: 0, paramSub: 0 };
});

const CATALOGUE = {
  source: "fixture",
  rubriques: [],
  codePartage: { bits: 410, alphabet: ALPHABET, emplacements },
  modelesDeBase: {
    morphologies: ["male", "female"],
    visages: [{ resources: ["face_m", "face_f"] }],
  },
  categories: [
    {
      faceSettingType: 4,
      prefixe: "hairF0",
      couleurs: [],
      parts: [
        part("A1", "hairF001", "x/20_EDIT/_hairF/hairF001.g4md"),
        part("A2", "hairF002", "x/20_EDIT/_hairF/hairF002.g4md"),
        part("A3", "hairF003", "x/20_EDIT/_hairF/hairF003.g4md"),
      ],
    },
  ],
} as unknown as Catalogue;

const spec = specDe(CATALOGUE)!;
const codeValide = encoder(spec, valeursDepuisChoix(CATALOGUE, spec, { 4: "A3" }, 1, 1));

describe("extraireCode", () => {
  test("retire les blancs d'un copier-coller", () => {
    expect(extraireCode(` ${codeValide.slice(0, 30)}\n${codeValide.slice(30)} `)).toBe(codeValide);
  });

  test("lit le paramètre d'un lien de partage, y compris avec des caractères encodés", () => {
    const lien = new URL("https://rosegriffon.fr/wiki/avatar");
    lien.searchParams.set("code", codeValide);
    expect(extraireCode(lien.href)).toBe(codeValide);
    expect(extraireCode("https://rosegriffon.fr/wiki/avatar")).toBe("");
  });
});

describe("analyserCode", () => {
  test("accepte un code produit par l'éditeur et rend ses choix", () => {
    expect(codeValide).toHaveLength(longueurCode(spec));
    const r = analyserCode(CATALOGUE, codeValide);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.etat.choix[4]).toBe("A3");
    expect(r.etat.genre).toBe(1);
    expect(r.etat.morphologie).toBe(1);
  });

  test("refuse un code vide, trop court, trop long ou à caractère étranger", () => {
    for (const mauvais of ["", codeValide.slice(1), `${codeValide}3`, `${codeValide.slice(0, -1)}0`]) {
      expect(analyserCode(CATALOGUE, mauvais).ok).toBe(false);
    }
    const intrus = analyserCode(CATALOGUE, `${codeValide.slice(0, -1)}0`);
    expect(!intrus.ok && intrus.erreur).toContain("« 0 »");
  });

  test("refuse un catalogue sans spécification ou incohérent", () => {
    const sans = { ...CATALOGUE, codePartage: undefined } as unknown as Catalogue;
    expect(analyserCode(sans, codeValide).ok).toBe(false);
    const faux = { ...CATALOGUE, codePartage: { ...CATALOGUE.codePartage, bits: 400 } } as Catalogue;
    expect(analyserCode(faux, codeValide).ok).toBe(false);
  });

  test("l'aperçu vise le rendu GLB du CDN avec la coiffure choisie", () => {
    const r = analyserCode(CATALOGUE, codeValide);
    if (!r.ok) throw new Error(r.erreur);
    const url = urlApercu(CATALOGUE, "https://cdn.rosegriffon.fr", r.etat);
    expect(url).toStartWith("https://cdn.rosegriffon.fr/model-avatar/");
    expect(url).toContain("_hairF/hairF003");
  });
});
