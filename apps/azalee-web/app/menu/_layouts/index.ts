// Registre des écrans de menu IEVR disponibles dans azalee.
//
// Les `layout.json` sont des **fixtures trackées** (le dump iecode `re/` est gitignoré et
// non déployé) : un layout = un écran exporté par `iecode menu export <screen>`. Les sprites
// PNG correspondants vivent sous `public/menu/<screen>/` (assetBase "" → `/menu/...`) ou sur
// le CDN (`NEXT_PUBLIC_MENU_ASSET_BASE`).
//
// Ajouter un écran : déposer `<screen>.json` ici + ses PNG sous `public/menu/<screen>/`, puis
// l'enregistrer dans `MENU_SCREENS`.

import type { MenuLayout } from "@rose-griffon/menu-render-webgpu";
import title50 from "./50_title.json" with { type: "json" };

/** Écrans de menu disponibles, indexés par identifiant (= dossier `dx11/menu/<screen>`). */
export const MENU_SCREENS: Record<string, MenuLayout> = {
	"50_title": title50 as MenuLayout,
};

/** Identifiants d'écrans disponibles (pour `generateStaticParams`). */
export const MENU_SCREEN_IDS: readonly string[] = Object.keys(MENU_SCREENS);

/** Renvoie le layout d'un écran, ou `null` si inconnu. */
export function getMenuLayout(screen: string): MenuLayout | null {
	return MENU_SCREENS[screen] ?? null;
}
