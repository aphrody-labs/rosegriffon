// Garde-fous d'URL pour tout ce qui vient de Discord.
//
// Le contenu republié provient d'utilisateurs : aucune URL ne doit être rendue
// en lien ou en image sans avoir été validée. Seuls `http` et `https` sont
// acceptés (donc ni `javascript:`, ni `data:`, ni `vbscript:`, ni les schémas
// applicatifs type `discord://`).

const SCHEMAS_AUTORISES = new Set(["http:", "https:"]);

/** Vrai si l'URL est absolue et porte un schéma web sûr. */
export function estUrlSure(url: unknown): url is string {
	if (typeof url !== "string" || url.length === 0 || url.length > 2048) return false;
	try {
		return SCHEMAS_AUTORISES.has(new URL(url).protocol);
	} catch {
		return false;
	}
}

/** Renvoie l'URL telle quelle si elle est sûre, sinon `null`. */
export function urlSureOuNull(url: unknown): string | null {
	return estUrlSure(url) ? url : null;
}

/**
 * URL CDN d'un emoji personnalisé Discord.
 * Les emojis animés n'existent qu'en `.gif`, les autres sont servis en `.webp`.
 */
export function urlEmojiPersonnalise(id: string, anime = false): string {
	return `https://cdn.discordapp.com/emojis/${id}.${anime ? "gif" : "webp"}`;
}

/** Convertit la couleur entière de l'API Discord en couleur CSS (`#rrggbb`). */
export function couleurDiscord(valeur: unknown): string | null {
	if (typeof valeur !== "number" || !Number.isFinite(valeur)) return null;
	const entier = Math.trunc(valeur);
	if (entier <= 0 || entier > 0xff_ff_ff) return null;
	return `#${entier.toString(16).padStart(6, "0")}`;
}
