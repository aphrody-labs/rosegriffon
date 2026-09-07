/**
 * Helpers de validation et de découpage purs (portables).
 *
 * Extraits de `apps/bot/src/utils/functions/{string,array}.ts` — uniquement les
 * fonctions sans dépendance (les helpers couplés à `case`/Discord restent côté bot).
 */

/**
 * Vérifie que toutes les valeurs sont des chaînes non vides (après `trim`).
 * Retourne `false` si aucune valeur n'est fournie.
 */
export function validString(...values: readonly unknown[]): boolean {
	if (values.length === 0) return false;
	for (const value of values) {
		if (typeof value !== "string") return false;
		if (value.trim().length === 0) return false;
	}
	return true;
}

/** Indique si une chaîne est une URL absolue valide (via le constructeur `URL`). */
export function isValidUrl(url: string): boolean {
	return URL.canParse(url);
}

/** Aligne un nombre à droite sur `align` caractères (padding espace). */
export function numberAlign(value: number, align: number = 2): string {
	return value.toString().padStart(align, " ");
}

/**
 * Découpe un tableau en sous-tableaux de taille `chunkSize` (2 par défaut).
 */
export function chunkArray<T>(array: readonly T[], chunkSize: number = 2): T[][] {
	const result: T[][] = [];
	for (let i = 0; i < array.length; i += chunkSize) {
		result.push(array.slice(i, i + chunkSize));
	}
	return result;
}
