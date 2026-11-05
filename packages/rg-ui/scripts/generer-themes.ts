/**
 * Génère `packages/rg-ui/src/themes.generated.css` : les 36 rôles
 * `--md-sys-color-*` de chaque thème, calculés par `src/lib/color-engine.ts`
 * depuis la graine `THEME_PACKS[id].seed` (réglages par défaut).
 *
 * Le fichier est importé par `styles.css` juste après `brands.css`, hors
 * couche : à spécificité égale il passe après lui et l'emporte, et il
 * l'emporte sur les blocs `@layer base` de `styles.css`, qui ne gardent que
 * le pont shadcn et les couleurs fixes (sidebar, graphiques).
 *
 * Usage : `bun packages/rg-ui/scripts/generer-themes.ts`, puis
 * `bun packages/rg-ui/scripts/generer-tokens.ts` (projection `tokens.ts`).
 */
import type { ThemeId } from "@rosegriffon/preferences";
import { computeRoles, roleVariables } from "../src/lib/color-engine";
import { THEME_PACKS } from "../src/lib/themes";

/** Sélecteurs d'un thème, dans l'ordre des blocs écrits à la main. */
export function selecteursTheme(id: ThemeId): string[] {
  return [`:root.theme-${id}`, `.theme-${id}`, `:root.${id}`, `.${id}`];
}

export function rendreThemesCss(): string {
  const blocs = (Object.keys(THEME_PACKS) as ThemeId[]).map(id => {
    const seed = THEME_PACKS[id].seed;
    const lignes = Object.entries(roleVariables(computeRoles(seed))).map(([nom, valeur]) => `  ${nom}: ${valeur};`);
    return `/* ${id}: hue ${seed.hue}, chroma ${seed.chroma}, ${seed.mode}. */\n${selecteursTheme(id).join(",\n")} {\n${lignes.join("\n")}\n}\n`;
  });
  return `/* GENERATED - do not hand-edit.
 * Source: packages/rg-ui/src/lib/color-engine.ts + THEME_PACKS seeds (src/lib/themes.ts).
 * Regenerate: bun packages/rg-ui/scripts/generer-themes.ts
 */

${blocs.join("\n")}`;
}

if (import.meta.main) {
  const sortie = new URL("../src/themes.generated.css", import.meta.url);
  await Bun.write(sortie, rendreThemesCss());
  console.log(`themes=ok sortie=${sortie}`);
}
