import { describe, expect, test } from "bun:test";

import {
  TAILLE_PAGE,
  codeBase,
  codeDepuisUrl,
  construireBanque,
  filtrerBanque,
  normaliser,
  parametresBanque,
  seriesDeLaBanque,
  urlPortrait,
  type LigneBanque,
} from "./banque";

const ligne = (internal_code: string, name_fr: string, series: string, name_en = "", name_ja = ""): LigneBanque => ({
  internal_code,
  name_fr,
  name_en,
  name_ja,
  series,
});

const LIGNES: LigneBanque[] = [
  ligne("c01000010", "Mark Evans", "Inazuma Eleven", "Mark Evans", "円堂守"),
  ligne("c01000010_5000", "Mark Evans", "Victory Road"),
  ligne("c01000020", "Nathan Swift", "Inazuma Eleven"),
  ligne("c05020110", "Fei", "Inazuma Eleven GO", "Fei Rune"),
  ligne("c05020111", "Éclair", "Inazuma Eleven GO"),
  ligne("x99", "Intrus", "Inazuma Eleven"),
  ligne("c05020112", "", "Galaxy"),
];
const PORTRAITS = new Set(["c01000010", "c01000020", "c05020110", "c05020111"]);

describe("codes et URL", () => {
  test("codeBase retire le suffixe de variante et refuse le reste", () => {
    expect(codeBase("c01000010_5000")).toBe("c01000010");
    expect(codeBase("c01000010")).toBe("c01000010");
    expect(codeBase("x99")).toBeNull();
    expect(codeBase(null)).toBeNull();
  });

  test("urlPortrait vise la texture nommée du conteneur et refuse un code forgé", () => {
    expect(urlPortrait("https://cdn.rosegriffon.fr/", "c01000010", 160)).toBe(
      "https://cdn.rosegriffon.fr/dx11/menu/200_icon/10_icon_chr/face/c01000010_l.g4tx/c01000010_1_l00.png?w=160&format=webp",
    );
    expect(() => urlPortrait("https://cdn.rosegriffon.fr", "../etc", 160)).toThrow();
  });

  test("codeDepuisUrl relit l'URL enregistrée, pas une photo téléversée", () => {
    const url = urlPortrait("https://cdn.rosegriffon.fr", "c05020110", 512);
    expect(codeDepuisUrl(url)).toBe("c05020110");
    expect(codeDepuisUrl("https://x.supabase.co/storage/v1/object/public/avatars/u/avatar-1.png")).toBeNull();
    expect(codeDepuisUrl(null)).toBeNull();
  });
});

describe("construireBanque", () => {
  const banque = construireBanque(LIGNES);

  test("dédoublonne les variantes et réunit les jeux", () => {
    const mark = banque.filter(p => p.code === "c01000010");
    expect(mark).toHaveLength(1);
    expect(mark[0]?.series).toEqual(["Inazuma Eleven", "Victory Road"]);
  });

  test("ignore les codes étrangers et les lignes sans nom", () => {
    expect(banque.map(p => p.code)).not.toContain("x99");
    expect(banque.map(p => p.code)).not.toContain("c05020112");
  });

  test("tri alphabétique français", () => {
    expect(banque.map(p => p.nom)).toEqual(["Éclair", "Fei", "Mark Evans", "Nathan Swift"]);
  });

  test("séries comptées", () => {
    expect(seriesDeLaBanque(banque)[0]).toEqual({ nom: "Inazuma Eleven", total: 2 });
  });
});

describe("filtrerBanque", () => {
  const banque = construireBanque(LIGNES);
  const filtre = (p: Partial<{ q: string; serie: string; page: number }>) =>
    filtrerBanque(banque, parametresBanque(p), PORTRAITS);

  test("sans filtre : tous les personnages ayant un portrait", () => {
    expect(filtre({}).total).toBe(4);
  });

  test("recherche insensible aux accents et à la casse", () => {
    expect(filtre({ q: "eclair" }).items.map(i => i.code)).toEqual(["c05020111"]);
    expect(filtre({ q: "MARK evans" }).total).toBe(1);
  });

  test("recherche sur le nom anglais et japonais", () => {
    expect(filtre({ q: "rune" }).items[0]?.code).toBe("c05020110");
    expect(filtre({ q: "円堂" }).items[0]?.code).toBe("c01000010");
  });

  test("filtre par jeu", () => {
    expect(filtre({ serie: "Victory Road" }).items.map(i => i.code)).toEqual(["c01000010"]);
    expect(filtre({ serie: "Galaxy" }).total).toBe(0);
  });

  test("exclut un personnage sans portrait réel", () => {
    const sans = filtrerBanque(banque, parametresBanque({}), new Set(["c01000020"]));
    expect(sans.items.map(i => i.code)).toEqual(["c01000020"]);
  });

  test("pagination bornée", () => {
    const grosse = construireBanque(
      Array.from({ length: TAILLE_PAGE * 2 + 5 }, (_, i) =>
        ligne(`c${String(10000000 + i)}`, `Joueur ${String(i).padStart(3, "0")}`, "Victory Road"),
      ),
    );
    const tous = new Set(grosse.map(p => p.code));
    const p0 = filtrerBanque(grosse, parametresBanque({}), tous);
    expect(p0.items).toHaveLength(TAILLE_PAGE);
    expect(p0.pages).toBe(3);
    expect(filtrerBanque(grosse, parametresBanque({ page: 2 }), tous).items).toHaveLength(5);
    expect(filtrerBanque(grosse, parametresBanque({ page: 99 }), tous).page).toBe(2);
  });
});

describe("parametresBanque", () => {
  test("borne les entrées du client", () => {
    expect(parametresBanque({ q: "a".repeat(200) }).q).toHaveLength(40);
    expect(parametresBanque({ page: -4 }).page).toBe(0);
    expect(parametresBanque({ page: "3" }).page).toBe(0);
    expect(parametresBanque({ page: 1e9 }).page).toBe(500);
  });

  test("normaliser", () => {
    expect(normaliser("  Éclair   Noir ")).toBe("eclair noir");
  });
});
