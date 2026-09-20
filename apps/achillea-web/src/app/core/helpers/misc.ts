/**
 * Helpers divers — la logique pure (slug d'image de rang, normalisation de
 * nom) vit dans `@rosegriffon/achillea-core` ; ce module n'en garde que les
 * alias consommés par les templates.
 */

import { rankImagePath } from "@rosegriffon/achillea-core";

export { normalizeNames } from "@rosegriffon/achillea-core";

/** Chemin de l'image du rang (`ranks/or.webp`). */
export function getEloImagePath(key: string | null | undefined): string {
	return rankImagePath(key);
}

export function sqlDateToUsableDate(dateStr: string): Date {
	return new Date(dateStr);
}
