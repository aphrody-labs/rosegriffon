/**
 * Parité avec les rendus de l'ancien bot (`legacy/achillea-bot/src/services/
 * PlayerCardService.ts`, `ClanPosterService.ts`). Les deux rendus ont été
 * comparés pixel à pixel au legacy sur des fixtures sans image distante :
 * carte joueur identique, affiche identique une fois le « ? » du logo absent
 * ramené à 96 px. Ces tests figent ce qui avait divergé et les constantes qui
 * font l'identité visuelle.
 */
import { describe, expect, test } from "bun:test";
import type { SKRSContext2D } from "@aphrody/canvas";

import { iconeDeMarque } from "../../../../lib/ui/theme";
import { LOGO_PLACEHOLDER_FONT_SIZE } from "./clan-poster";
import { ACHILLEA_PURPLE, drawCircleImage, RANK_COLORS, RANK_NAMES, rankFromElo } from "./render";

/** Contexte factice qui ne retient que les polices posées. */
function contexteEspion(): { ctx: SKRSContext2D; polices: string[] } {
  const polices: string[] = [];
  const ctx = new Proxy({} as Record<string | symbol, unknown>, {
    get: (_cible, cle) => (cle === "font" ? polices.at(-1) : () => undefined),
    set: (_cible, cle, valeur) => {
      if (cle === "font") polices.push(String(valeur));
      return true;
    },
  }) as unknown as SKRSContext2D;
  return { ctx, polices };
}

describe("rendus Achilléa — parité legacy", () => {
  test("le « ? » du logo de clan absent est en 96 px, comme dans ClanPosterService", () => {
    expect(LOGO_PLACEHOLDER_FONT_SIZE).toBe(96);
    const { ctx, polices } = contexteEspion();
    drawCircleImage(ctx, null, 400, 220, 280, undefined, LOGO_PLACEHOLDER_FONT_SIZE);
    expect(polices[0]).toStartWith("bold 96px ");
  });

  test("les avatars absents gardent un « ? » de la moitié du disque", () => {
    const { ctx, polices } = contexteEspion();
    drawCircleImage(ctx, null, 0, 0, 90, "#3a2f44");
    expect(polices[0]).toStartWith("bold 45px ");
  });

  test("palette et paliers des rangs identiques au legacy", () => {
    expect(RANK_COLORS).toEqual([
      "#000000", "#959595", "#B17253", "#7FACB8", "#C2AD88", "#897E8B",
      "#88F6FF", "#2D925C", "#FF5648", "#7EDCB5", "#F010FF", "#FFA910",
    ]);
    expect(RANK_NAMES[11]).toBe("Légendaire");
    expect([0, 49, 50, 1234, 2100, 9999].map(rankFromElo)).toEqual([1, 1, 2, 8, 11, 11]);
    expect(ACHILLEA_PURPLE).toBe("#6d00ce");
  });

  test("les pieds Achilléa portent le casque Achilléa, pas le logo Rose Griffon", () => {
    expect(iconeDeMarque("achillea")).toBe("https://rosegriffon.fr/achillea/achillea_ico.png");
    expect(iconeDeMarque("rg")).toBe("https://rosegriffon.fr/RG_Logo_V2.5.webp");
    expect(iconeDeMarque("inconnu")).toBe(iconeDeMarque("rg"));
  });
});
