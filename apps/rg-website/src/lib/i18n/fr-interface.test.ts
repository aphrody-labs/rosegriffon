// SPDX-License-Identifier: Apache-2.0
import { describe, expect, test } from "bun:test";
import { join } from "node:path";

import { cleInterface } from "./cles";
import frInterface from "./fr-interface.json";

const racine = join(import.meta.dir, "../../..");

describe("fr-interface.json", () => {
  test("est à jour avec public/locales/fr.json (sinon : bun scripts/locales-interface.ts)", async () => {
    const complet = (await Bun.file(join(racine, "public/locales/fr.json")).json()) as Record<string, string>;
    const attendu = Object.fromEntries(Object.entries(complet).filter(([cle]) => cleInterface(cle)));
    expect(frInterface as Record<string, string>).toEqual(attendu);
  });

  test("aucune source du site ne lit une clé de texte de jeu (0x…) par t()", async () => {
    // Les clés `0x…` ne sont plus embarquées en français : un appel t("0x…") rendrait la clé brute.
    const complet = (await Bun.file(join(racine, "public/locales/fr.json")).json()) as Record<string, string>;
    const jeu = new Set(Object.keys(complet).filter(cle => !cleInterface(cle)));
    const fautifs: string[] = [];
    for await (const fichier of new Bun.Glob("src/**/*.{ts,tsx}").scan(racine)) {
      const texte = await Bun.file(join(racine, fichier)).text();
      for (const m of texte.matchAll(/0x[0-9A-Fa-f]{8}/g)) if (jeu.has(m[0])) fautifs.push(`${fichier}: ${m[0]}`);
    }
    expect(fautifs).toEqual([]);
  });

  test("les clés de la coque se résolvent", () => {
    for (const cle of ["consent.manage", "ui.language.label", "search.palette.title", "wiki.elements.fire"]) {
      expect((frInterface as Record<string, string>)[cle]).toBeString();
    }
  });
});
