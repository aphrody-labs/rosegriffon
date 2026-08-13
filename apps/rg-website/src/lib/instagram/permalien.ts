/**
 * PERMALIEN INSTAGRAM — analyse PURE, sans réseau.
 *
 * Séparé de `oembed.ts` (qui interroge Meta et porte `import "server-only"`)
 * parce que c'est la partie qui décide de la DÉDUPLICATION : le shortcode est la
 * clé primaire de `campagne_creations_instagram`, et deux écritures du même post
 * doivent produire la même clé. Un participant colle son lien depuis l'appli
 * mobile, depuis le bouton « partager », depuis la barre d'adresse : les trois
 * formes diffèrent.
 *
 * Formes rencontrées, toutes vues en vrai :
 *   https://www.instagram.com/p/Db_AxXAlywQ/
 *   https://www.instagram.com/rose_griffonfr/p/Db_AxXAlywQ/
 *   https://instagram.com/p/Db_AxXAlywQ/?igsh=MzRlODBiNWFlZA==
 *   https://www.instagram.com/reel/Db_AxXAlywQ/
 *   instagram.com/p/Db_AxXAlywQ            (collé sans le protocole)
 *
 * ⚠ LE PARAMÈTRE `igsh` EST UN JETON DE TRAÇAGE. Il identifie le partageur, pas
 * la publication : le conserver en base reviendrait à stocker une donnée de
 * pistage sans raison, et deux membres partageant le même post créeraient deux
 * lignes. On le retire, comme tous les autres paramètres.
 */

/** Les segments de chemin qui précèdent un shortcode chez Instagram. */
const TYPES_PUBLICATION = new Set(["p", "reel", "reels", "tv"]);

/** Un shortcode : base64url, 5 à 30 caractères (contrainte reprise en base). */
const SHORTCODE = /^[A-Za-z0-9_-]{5,30}$/;

export interface PermalienInstagram {
	/** L'identifiant de la publication chez Instagram — la clé de déduplication. */
	shortcode: string;
	/** Le permalien CANONIQUE, sans pseudo ni paramètre de traçage. */
	permalien: string;
	/** Le pseudo lu dans l'URL quand elle en porte un, sinon `null`. */
	pseudo: string | null;
}

/**
 * Analyse un permalien Instagram collé par un membre.
 *
 * Rend `null` sur tout ce qui n'est pas une publication : profil, story,
 * autre domaine, texte quelconque. Ne devine JAMAIS — mieux vaut refuser un
 * lien exotique que d'enregistrer un shortcode inventé qui donnera un 400 à la
 * vérification, puis une carte vide dans la galerie.
 */
export function analyserPermalien(brut: string): PermalienInstagram | null {
	const texte = (brut || "").trim();
	if (!texte) return null;

	let url: URL;
	try {
		// Un lien collé sans protocole reste un lien valide pour un humain.
		url = new URL(/^https?:\/\//i.test(texte) ? texte : `https://${texte}`);
	} catch {
		return null;
	}

	const hote = url.hostname.toLowerCase().replace(/^www\./, "");
	if (hote !== "instagram.com" && !hote.endsWith(".instagram.com")) return null;

	const segments = url.pathname.split("/").filter(Boolean);
	// `p/<code>` ou `<pseudo>/p/<code>` : on cherche le marqueur de type, où
	// qu'il soit, plutôt que de tester deux gabarits de longueur.
	const position = segments.findIndex((s) => TYPES_PUBLICATION.has(s.toLowerCase()));
	if (position === -1) return null;

	const shortcode = segments[position + 1];
	if (!shortcode || !SHORTCODE.test(shortcode)) return null;

	const pseudo = position > 0 ? (segments[position - 1] ?? null) : null;

	return {
		permalien: `https://www.instagram.com/p/${shortcode}/`,
		pseudo: pseudo && /^[A-Za-z0-9._]{1,30}$/.test(pseudo) ? pseudo : null,
		shortcode,
	};
}

/**
 * Normalise un pseudo Instagram saisi à la main.
 *
 * Le membre écrit « @rose_griffonfr », « rose_griffonfr » ou colle l'URL de son
 * profil ; les trois désignent le même compte. Rend `null` si rien
 * d'exploitable n'en sort — un pseudo vide vaut mieux qu'un pseudo faux, la
 * galerie sait afficher « auteur inconnu ».
 */
export function normaliserPseudo(brut: string | null | undefined): string | null {
	if (typeof brut !== "string") return null;
	const propre = brut
		.trim()
		.replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
		.replace(/\/.*$/, "")
		.replace(/^@+/, "");
	return /^[A-Za-z0-9._]{1,30}$/.test(propre) ? propre : null;
}

/**
 * Le hashtag de la campagne écrit dans une légende ?
 *
 * On réutilise volontairement la MÊME tolérance aux fautes que la récolte X :
 * un participant qui écrit `#IERGDya` sur Instagram fait la même faute que sur
 * X, et rien ne justifierait de l'accepter d'un côté et pas de l'autre. La
 * fonction est ici pour éviter d'importer le module cron dans l'app Next — elle
 * en reprend la règle, pas le code, et se limite à l'appariement EXACT après
 * normalisation. La tolérance fine reste côté récolte, là où elle est testée.
 */
export function hashtagDansLegende(
	legende: string,
	hashtags: readonly string[]
): string | null {
	const normalise = (v: string) =>
		v
			.replace(/^#+/, "")
			.normalize("NFD")
			.replace(/\p{Diacritic}/gu, "")
			.toLowerCase()
			.replace(/[^a-z0-9]/g, "");

	const ecrits = new Set(
		[...(legende || "").matchAll(/#([\p{L}\p{N}_]+)/gu)].map((m) => normalise(m[1] ?? ""))
	);
	for (const h of hashtags) {
		const cible = normalise(h);
		if (cible && ecrits.has(cible)) return h;
	}
	return null;
}
