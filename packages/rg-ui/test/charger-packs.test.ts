import { describe, expect, test } from "bun:test";

import { chargerPacks, cheminPublic, convertirPack, oklchVersTeinteChroma } from "../scripts/charger-packs";
import { THEME_PACKS } from "../src/lib/themes";

describe("charger-packs", () => {
  test("oklch() donne teinte et chroma", () => {
    expect(oklchVersTeinteChroma("oklch(0.55 0.267 297)")).toEqual({ hue: 297, chroma: 0.267 });
    expect(oklchVersTeinteChroma("oklch(55% 0.1 34deg)")).toEqual({ hue: 34, chroma: 0.1 });
    expect(() => oklchVersTeinteChroma("#fff")).toThrow();
  });

  test("cheminPublic retire la racine publique", () => {
    expect(cheminPublic("packages/rg-assets/public/emote/a.webp")).toBe("/emote/a.webp");
    expect(cheminPublic("apps/rg-website/public/emote/b.webp")).toBe("/emote/b.webp");
    expect(() => cheminPublic("autre/x.webp")).toThrow();
  });

  test("une clé inconnue est refusée (deny_unknown_fields)", () => {
    const base = {
      id: "x",
      name: "X",
      title: { product_name: "X", window_title_template: "{page}", ntp_heading: "X", extra: 1 },
    };
    expect(() => convertirPack(base)).toThrow(/clé inconnue/);
  });

  test("chaque theme.toml correspond à THEME_PACKS", async () => {
    const packs = await chargerPacks();
    expect(Object.keys(packs).sort()).toEqual(Object.keys(THEME_PACKS).sort());
    for (const [id, attendu] of Object.entries(THEME_PACKS)) {
      const pack = packs[id];
      expect(pack, id).toBeDefined();
      if (!pack) continue;
      const seed: { hue: number; chroma: number; mode: string; secondary?: unknown; neutralChroma?: number } =
        attendu.seed;
      expect(pack.title, `${id} title`).toBe(attendu.title);
      expect(pack.logo, `${id} logo`).toBe(attendu.logo);
      expect(pack.wallpaper, `${id} wallpaper`).toBe(attendu.wallpaper);
      expect(pack.pet, `${id} pet`).toEqual(attendu.pet);
      expect(pack.seed.hue, `${id} hue`).toBe(seed.hue);
      expect(pack.seed.chroma, `${id} chroma`).toBe(seed.chroma);
      expect(pack.seed.mode, `${id} mode`).toBe(seed.mode);
      expect(pack.seed.secondary, `${id} secondary`).toEqual(seed.secondary);
      expect(pack.seed.neutralChroma, `${id} neutralChroma`).toBe(seed.neutralChroma);
    }
  });

  test("chaque fond porte la licence propriétaire Rose Griffon", async () => {
    for (const id of Object.keys(THEME_PACKS)) {
      const toml = await Bun.file(new URL(`../themes/${id}/theme.toml`, import.meta.url)).text();
      expect(toml).toContain('license = "LicenseRef-RoseGriffon-Proprietary"');
      expect(toml).not.toContain("pending");
    }
  });
});
