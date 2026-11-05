import { describe, expect, test } from "bun:test";

import {
  chromaEnGamut,
  clampAdjustments,
  computeRoles,
  CONTRAST_PAIRS,
  contrastRatio,
  hexToOklch,
  oklchToHex,
  ROLE_NAMES,
  roleVariables,
  type ThemeSeed,
} from "../src/lib/color-engine";
import { THEME_PACKS } from "../src/lib/themes";
import { ecarts } from "../scripts/parite-themes";

const SEEDS = Object.entries(THEME_PACKS).map(([id, pack]) => [id, pack.seed as ThemeSeed] as const);
const BOTH_MODES = SEEDS.flatMap(([id, seed]) =>
  (["light", "dark"] as const).map(mode => [`${id}/${mode}`, { ...seed, mode }] as const),
);

describe("conversions", () => {
  test.each([
    [1, 0, 0, "#ffffff"],
    [0, 0, 0, "#000000"],
    [0.62796, 0.25768, 29.234, "#ff0000"],
    [0.45201, 0.31321, 264.052, "#0000ff"],
  ])("oklch(%p %p %p) -> %s", (l, c, h, hex) => {
    expect(oklchToHex(l, c, h)).toBe(hex);
  });

  test("hexToOklch inverts oklchToHex", () => {
    const { l, c, h } = hexToOklch("#344e8c");
    expect(oklchToHex(l, c, h)).toBe("#344e8c");
  });

  test("gamut mapping lowers chroma and keeps lightness", () => {
    const c = chromaEnGamut(0.7, 0.4, 150);
    expect(c).toBeLessThan(0.4);
    expect(c).toBeGreaterThan(0.1);
    expect(Math.abs(hexToOklch(oklchToHex(0.7, 0.4, 150)).l - 0.7)).toBeLessThan(0.005);
  });

  test("WCAG ratio", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrastRatio("#777777", "#777777")).toBe(1);
  });
});

describe("computeRoles", () => {
  test.each(BOTH_MODES)("%s: every on-X/X pair meets 4.5:1 at contrast 0", (_, seed) => {
    const roles = computeRoles(seed);
    for (const [fg, bg] of CONTRAST_PAIRS)
      expect(contrastRatio(roles[fg], roles[bg]), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
  });

  test.each(BOTH_MODES)("%s: higher contrast levels raise every pair", (_, seed) => {
    const base = computeRoles(seed);
    const half = computeRoles(seed, { contrast: 0.5 });
    const full = computeRoles(seed, { contrast: 1 });
    for (const [fg, bg] of CONTRAST_PAIRS) {
      const r0 = contrastRatio(base[fg], base[bg]);
      const r5 = contrastRatio(half[fg], half[bg]);
      const r1 = contrastRatio(full[fg], full[bg]);
      expect(r5, `${fg} on ${bg} @0.5`).toBeGreaterThan(r0);
      expect(r1, `${fg} on ${bg} @1`).toBeGreaterThan(r5);
      expect(r1, `${fg} on ${bg} @1`).toBeGreaterThanOrEqual(7);
    }
  });

  test.each(BOTH_MODES)("%s: reduced contrast keeps the 4.5:1 floor", (_, seed) => {
    const roles = computeRoles(seed, { contrast: -1 });
    for (const [fg, bg] of CONTRAST_PAIRS)
      expect(contrastRatio(roles[fg], roles[bg]), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
  });

  test.each(BOTH_MODES)("%s: user adjustments keep the floor", (_, seed) => {
    for (const adj of [
      { hueShift: 90, chroma: 2 },
      { hueShift: -150, chroma: 0 },
      { hueShift: 45, chroma: 1.5, contrast: 0.3 },
    ]) {
      const roles = computeRoles(seed, adj);
      for (const [fg, bg] of CONTRAST_PAIRS)
        expect(contrastRatio(roles[fg], roles[bg]), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  test("outputs are deterministic and complete", () => {
    for (const [, seed] of BOTH_MODES) {
      const a = computeRoles(seed, { hueShift: 12, chroma: 0.8, contrast: 0.25 });
      const b = computeRoles(seed, { hueShift: 12, chroma: 0.8, contrast: 0.25 });
      expect(a).toEqual(b);
      expect(Object.keys(a)).toEqual([...ROLE_NAMES]);
      for (const v of Object.values(a)) expect(v).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  test("hue shift rotates the primary, chroma 0 gives greys", () => {
    const seed = THEME_PACKS.roy.seed;
    const shifted = hexToOklch(computeRoles(seed, { hueShift: 120 }).primary);
    expect(Math.abs(((shifted.h - ((seed.hue + 120) % 360) + 540) % 360) - 180)).toBeLessThan(3);
    expect(hexToOklch(computeRoles(seed, { chroma: 0 }).primary).c).toBeLessThan(0.005);
  });

  test("secondary sits opposite the seed, tertiary 60 degrees away", () => {
    const seed = THEME_PACKS.gaelle.seed;
    const roles = computeRoles(seed);
    const d = (h: number, target: number) => Math.abs(((h - target + 540) % 360) - 180);
    expect(d(hexToOklch(roles.secondary).h, (seed.hue + 180) % 360)).toBeLessThan(3);
    expect(d(hexToOklch(roles.tertiary).h, (seed.hue + 60) % 360)).toBeLessThan(3);
  });

  test("clampAdjustments bounds stored values", () => {
    expect(clampAdjustments({ hueShift: 999, chroma: -1, contrast: Number.NaN })).toEqual({
      hueShift: 180,
      chroma: 0,
      contrast: -1,
    });
    expect(clampAdjustments(null)).toEqual({ hueShift: 0, chroma: 1, contrast: 0 });
  });

  test("computed primary/surface/on-surface stay within dE OK 0.1 of the hand-written palettes", () => {
    for (const e of ecarts()) expect(e.dE, `${e.theme} ${e.role}`).toBeLessThan(0.1);
  });

  test("roleVariables uses the --md-sys-color- names", () => {
    const vars = roleVariables(computeRoles(THEME_PACKS.achillea.seed));
    expect(Object.keys(vars)).toHaveLength(36);
    expect(vars["--md-sys-color-on-surface-variant"]).toMatch(/^#/);
  });
});
