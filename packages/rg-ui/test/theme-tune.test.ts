import { describe, expect, test } from "bun:test";

import { computeRoles, roleVariables } from "../src/lib/color-engine";
import {
  applyThemeTune,
  getThemeTune,
  readTuneStore,
  resetThemeTune,
  setThemeTune,
  TUNE_BOOT_SNIPPET,
  TUNE_STORAGE_KEY,
} from "../src/lib/theme-tune";
import { THEME_PACKS } from "../src/lib/themes";

function contexte(classe: string) {
  const donnees = new Map<string, string>();
  const props = new Map<string, string>();
  return {
    donnees,
    props,
    ctx: {
      storage: {
        getItem: (k: string) => donnees.get(k) ?? null,
        setItem: (k: string, v: string) => void donnees.set(k, v),
        removeItem: (k: string) => void donnees.delete(k),
      },
      root: {
        classList: { contains: (c: string) => c === classe },
        style: {
          setProperty: (k: string, v: string | null) => void props.set(k, v ?? ""),
          removeProperty: (k: string) => {
            const v = props.get(k) ?? "";
            props.delete(k);
            return v;
          },
        },
      },
    },
  };
}

describe("theme-tune", () => {
  test("stores adjustments with the precomputed role map and applies them to the active theme", () => {
    const { donnees, props, ctx } = contexte("roy");
    setThemeTune("roy", { hueShift: 30, chroma: 1.2, contrast: 0.5 }, ctx);
    const brut = JSON.parse(donnees.get(TUNE_STORAGE_KEY)!);
    const attendu = roleVariables(computeRoles(THEME_PACKS.roy.seed, { hueShift: 30, chroma: 1.2, contrast: 0.5 }));
    expect(brut.roy.v).toEqual(attendu);
    expect(Object.fromEntries(props)).toEqual(attendu);
    expect(getThemeTune("roy", ctx)).toEqual({ hueShift: 30, chroma: 1.2, contrast: 0.5 });
  });

  test("does not touch <html> when tuning another theme", () => {
    const { props, ctx } = contexte("roy");
    setThemeTune("achillea", { hueShift: 10 }, ctx);
    expect(props.size).toBe(0);
  });

  test("reset removes the entry and the inline properties", () => {
    const { donnees, props, ctx } = contexte("gaelle");
    setThemeTune("gaelle", { contrast: 1 }, ctx);
    resetThemeTune("gaelle", ctx);
    expect(donnees.has(TUNE_STORAGE_KEY)).toBe(false);
    expect(props.size).toBe(0);
  });

  test("switching theme clears the previous theme's roles", () => {
    const { props, ctx } = contexte("roy");
    setThemeTune("roy", { hueShift: 40 }, ctx);
    applyThemeTune("achillea", ctx);
    expect(props.size).toBe(0);
  });

  test("ignores tampered storage and recomputes values from the adjustments", () => {
    const { donnees, ctx } = contexte("roy");
    donnees.set(
      TUNE_STORAGE_KEY,
      JSON.stringify({ roy: { a: { hueShift: 9999 }, v: { "--md-sys-color-primary": "red; x" } }, inconnu: {} }),
    );
    const store = readTuneStore(ctx);
    expect(Object.keys(store)).toEqual(["roy"]);
    expect(store.roy!.a.hueShift).toBe(180);
    expect(store.roy!.v["--md-sys-color-primary"]).toMatch(/^#[0-9a-f]{6}$/);
    donnees.set(TUNE_STORAGE_KEY, "{not json");
    expect(readTuneStore(ctx)).toEqual({});
  });

  test("boot snippet copies only well-formed role values", () => {
    const props = new Map<string, string>();
    const d = { style: { setProperty: (k: string, v: string) => void props.set(k, v) } };
    const localStorage = {
      getItem: () =>
        JSON.stringify({
          roy: { v: { "--md-sys-color-primary": "#123456", "--md-sys-color-surface": "url(x)", "--autre": "#000000" } },
        }),
    };
    new Function("t", "d", "localStorage", TUNE_BOOT_SNIPPET)("roy", d, localStorage);
    expect(Object.fromEntries(props)).toEqual({ "--md-sys-color-primary": "#123456" });
  });
});
