/**
 * Parité visuelle : compare, thème par thème, les rôles calculés par
 * `lib/color-engine.ts` aux valeurs effectives des palettes écrites à la main
 * qu'ils remplacent (relevées dans la cascade de styles.css + brands.css avant
 * la migration). Affiche les écarts OKLCH (ΔL, ΔC, Δh) et ΔE OK.
 *
 * Usage : `bun packages/rg-ui/scripts/parite-themes.ts`
 */
import type { ThemeId } from "@rosegriffon/types/preferences";
import { computeRoles, hexToOklch, type Role } from "../src/lib/color-engine";
import { THEME_PACKS } from "../src/lib/themes";

/** Valeurs effectives avant migration (tokens.ts régénéré sur le CSS écrit à la main). */
export const ANCIENNES: Record<ThemeId, Partial<Record<Role, string>>> = {
  roy: { primary: "#0e5794", surface: "#f9f4ee", "on-surface": "#03172c" },
  gaelle: { primary: "#b32228", surface: "#ffe8e0", "on-surface": "#550000" },
  "azalee-light": {
    primary: "#8b5023",
    surface: "#fff8f5",
    "on-surface": "#221a15",
  },
  "azalee-dark": {
    primary: "#ffb786",
    surface: "#19120d",
    "on-surface": "#f0dfd7",
  },
  achillea: { primary: "#d7bafb", surface: "#151218", "on-surface": "#e7e0e8" },
};

export interface Ecart {
  theme: ThemeId;
  role: Role;
  avant: string;
  apres: string;
  dL: number;
  dC: number;
  dH: number;
  dE: number;
}

export function ecarts(): Ecart[] {
  const sortie: Ecart[] = [];
  for (const [theme, roles] of Object.entries(ANCIENNES) as [
    ThemeId,
    Partial<Record<Role, string>>,
  ][]) {
    const calcules = computeRoles(THEME_PACKS[theme].seed);
    for (const [role, avant] of Object.entries(roles) as [Role, string][]) {
      const a = hexToOklch(avant);
      const b = hexToOklch(calcules[role]);
      const dH = ((b.h - a.h + 540) % 360) - 180;
      const da =
        b.c * Math.cos((b.h * Math.PI) / 180) -
        a.c * Math.cos((a.h * Math.PI) / 180);
      const db =
        b.c * Math.sin((b.h * Math.PI) / 180) -
        a.c * Math.sin((a.h * Math.PI) / 180);
      sortie.push({
        theme,
        role,
        avant,
        apres: calcules[role],
        dL: b.l - a.l,
        dC: b.c - a.c,
        dH: a.c < 0.02 || b.c < 0.02 ? 0 : dH,
        dE: Math.hypot(b.l - a.l, da, db),
      });
    }
  }
  return sortie;
}

if (import.meta.main) {
  const f = (v: number, n = 3) => (v >= 0 ? "+" : "") + v.toFixed(n);
  for (const e of ecarts())
    console.log(
      `${e.theme.padEnd(13)} ${e.role.padEnd(11)} ${e.avant} -> ${e.apres}  dL=${f(e.dL)} dC=${f(e.dC)} dh=${f(e.dH, 1)} dE=${e.dE.toFixed(3)}`,
    );
}
