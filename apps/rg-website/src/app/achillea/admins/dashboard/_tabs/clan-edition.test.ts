import { describe, expect, test } from "bun:test";
import { COUNTRIES } from "@rosegriffon/achillea-core/reference";
import type { ClanDTO } from "@rosegriffon/achillea-types/domain/clan";
import { lienSocialValide, patchClan, saisieDepuisClan, validerSaisieClan, type SaisieClan } from "./clan-edition";

const CODES = new Set(COUNTRIES.map(pays => pays.code));

const CLAN = {
  id: 7,
  name: "Griffons",
  shortenedName: "GRF",
  clanAvatarUrl: "https://cdn.example/logo.png",
  clanBiography: "Bio",
  xUrl: null,
  instagramUrl: "https://instagram.com/griffons",
  tiktokUrl: null,
  isRecruiting: true,
  autoAcceptMembers: false,
  isInactive: false,
  isHidden: false,
  origin: "fr",
  languages: ["fr"],
} as unknown as ClanDTO;

const saisie = (modifs: Partial<SaisieClan> = {}): SaisieClan => ({ ...saisieDepuisClan(CLAN), ...modifs });

describe("édition complète d'un clan", () => {
  test("une saisie intacte est valide et ne produit aucun patch", () => {
    expect(validerSaisieClan(saisie(), CODES, saisie())).toEqual({});
    expect(patchClan(saisie(), saisie(), true)).toEqual({});
  });

  test("bornes de l'API : nom 3-30, tag 2-3 sans espace, bio 1500, logo requis", () => {
    const erreurs = validerSaisieClan(
      saisie({ name: "ab", shortenedName: "A B", clanBiography: "x".repeat(1501), clanAvatarUrl: " " }),
      CODES,
    );
    expect(Object.keys(erreurs).toSorted()).toEqual(["clanAvatarUrl", "clanBiography", "name", "shortenedName"]);
    expect(validerSaisieClan(saisie({ name: "x".repeat(31) }), CODES).name).toBeDefined();
    expect(validerSaisieClan(saisie({ shortenedName: "ABCD" }), CODES).shortenedName).toBeDefined();
  });

  test("liens sociaux : bon réseau et identifiant, ou vide", () => {
    expect(lienSocialValide("", "xUrl")).toBe(true);
    expect(lienSocialValide("https://twitter.com/griffons", "xUrl")).toBe(true);
    expect(lienSocialValide("https://www.x.com/griffons", "xUrl")).toBe(true);
    expect(lienSocialValide("https://x.com/", "xUrl")).toBe(false);
    expect(lienSocialValide("https://instagram.com/griffons", "xUrl")).toBe(false);
    expect(lienSocialValide("griffons", "tiktokUrl")).toBe(false);
    expect(validerSaisieClan(saisie({ tiktokUrl: "https://youtube.com/@g" }), CODES).tiktokUrl).toBeDefined();
  });

  test("origine et langues : référentiel, au moins une langue, contrôlées seulement si modifiées", () => {
    expect(validerSaisieClan(saisie({ languages: [] }), CODES, saisie()).languages).toBeDefined();
    expect(validerSaisieClan(saisie({ languages: ["xx"] }), CODES, saisie()).languages).toBe("Langue inconnue.");
    expect(validerSaisieClan(saisie({ origin: "xx" }), CODES, saisie()).origin).toBeDefined();
    const ancien = saisie({ origin: "legacy", languages: [] });
    expect(validerSaisieClan({ ...ancien, name: "Nouveau nom" }, CODES, ancien)).toEqual({});
  });

  test("le patch ne contient que les champs modifiés, normalisés", () => {
    const patch = patchClan(
      saisie(),
      saisie({
        name: "  Griffons Or  ",
        shortenedName: "gro",
        instagramUrl: "",
        xUrl: "https://x.com/griffons",
        autoAcceptMembers: true,
        languages: ["en", "fr", "en"],
      }),
      false,
    );
    expect(patch).toEqual({
      name: "Griffons Or",
      shortenedName: "GRO",
      instagramUrl: null,
      xUrl: "https://x.com/griffons",
      autoAcceptMembers: true,
      languages: ["en", "fr"],
    });
    expect(patchClan(saisie(), saisie({ languages: ["fr"] }), false)).toEqual({});
  });

  test("inactif et masqué ne partent que pour un administrateur", () => {
    const modifiee = saisie({ isInactive: true, isHidden: true });
    expect(patchClan(saisie(), modifiee, false)).toEqual({});
    expect(patchClan(saisie(), modifiee, true)).toEqual({ isInactive: true, isHidden: true });
  });
});
