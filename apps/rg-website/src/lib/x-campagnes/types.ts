/*
 * Types et helpers PURS des campagnes à hashtag X — client-safe.
 *
 * Ce module est importé aussi bien par la page serveur (`app/iergday/page.tsx`)
 * que par les îlots `"use client"` de la galerie. Il ne doit donc JAMAIS :
 *   - porter `import "server-only"` ;
 *   - importer `pg`, `@/lib/db/pg`, `node:*` ou quoi que ce soit de serveur.
 * Un seul import serveur remonté ici casserait le bundle navigateur
 * (« Can't resolve 'fs'/'tls' »). Les accès base vivent dans `./queries`.
 */

/** Élément brut du tableau `tweets.media` (jsonb). Toutes les clés sont optionnelles. */
export interface MediaTweet {
	id?: string;
	type?: string;
	url?: string;
	/** Variante camelCase écrite par certaines récoltes historiques. */
	previewUrl?: string;
	preview_url?: string;
	original_url?: string;
	storage_url?: string;
	storage_path?: string;
	width?: number;
	height?: number;
}

/** Campagne éditoriale (`public.x_campagnes`), en camelCase et sérialisable. */
export interface Campagne {
	slug: string;
	titre: string;
	surTitre: string | null;
	description: string | null;
	imageCouverture: string | null;
	/** Hashtags en minuscules et SANS croisillon (contrainte en base). */
	hashtags: string[];
	debutLe: string | null;
	finLe: string | null;
	actif: boolean;
	principale: boolean;
	collecteLe: string | null;
}

/** Image affichable d'un post, déjà résolue vers sa meilleure source. */
export interface ImageCampagne {
	/** URL à donner à `next/image` (relative si servie par le Storage self-host). */
	src: string;
	largeur: number | null;
	hauteur: number | null;
	/** URL d'origine (pbs.twimg.com le plus souvent) — attribution et téléchargement. */
	source: string;
}

/** Métriques publiques d'un post X. Toutes optionnelles : X n'en renvoie pas toujours. */
export interface MetriquesPost {
	like_count?: number;
	retweet_count?: number;
	reply_count?: number;
	quote_count?: number;
	view_count?: number;
}

/** Publication rattachée à une campagne, prête à être rendue (100 % sérialisable). */
export interface PostCampagne {
	tweetId: string;
	auteurNom: string;
	auteurPseudo: string;
	texte: string;
	publieLe: string | null;
	misEnAvant: boolean;
	hashtagTrouve: string | null;
	images: ImageCampagne[];
	metriques: MetriquesPost | null;
}

/** Compteurs affichés dans l'en-tête de campagne. */
export interface StatsCampagne {
	posts: number;
	auteurs: number;
	derniere: string | null;
}

/**
 * Borne haute d'un numéro de page. Sans plafond, `?page=999999999999999999999`
 * donne un `offset` de 2,4e22 que `pg` sérialise en notation exponentielle
 * (« 2.4e+22 ») : Postgres refuse (`invalid input syntax for type bigint`), la
 * requête part en erreur et la galerie s'affiche vide — le tout en journalisant
 * une erreur à chaque visite, ce qu'un robot peut déclencher en boucle.
 */
export const PAGE_MAXIMUM = 1_000_000;

/**
 * Entier positif sûr pour un paramètre d'URL.
 *
 * ⚠ Ce helper vit ici, dans le module PUR, parce qu'il doit servir des deux côtés
 * de la frontière serveur/client : `queries.ts` s'en sert pour ne pas envoyer
 * `NaN` ni `2.4e+22` à Postgres, et `page.tsx` pour ne pas passer au widget de
 * pagination un numéro de page que les requêtes ont, elles, déjà normalisé. Deux
 * normalisations divergentes donnaient une page 1 affichée sous une pagination
 * qui se croyait ailleurs (boutons « précédent »/« suivant » inertes).
 *
 * `parseSearchParams` renvoie `Math.max(1, parseInt("abc", 10))`, c'est-à-dire
 * `NaN` : tout ce qui n'est pas un entier fini retombe sur le repli, tout ce qui
 * dépasse est plafonné.
 */
export function entierPositif(valeur: number, repli: number, maximum = PAGE_MAXIMUM): number {
	if (!Number.isFinite(valeur)) {
		return repli;
	}
	return Math.min(maximum, Math.max(1, Math.trunc(valeur)));
}

/** Segment de chemin des médias ré-hébergés dans le Storage self-host. */
const CHEMIN_STOCKAGE = "/storage/v1/object/public/tweets/";

function estChaineNonVide(valeur: unknown): valeur is string {
	return typeof valeur === "string" && valeur.trim().length > 0;
}

/** Vrai si l'URL pointe vers le bucket `tweets` du Storage self-host, quel que soit l'hôte. */
export function estUrlStockage(url: string): boolean {
	return url.includes(CHEMIN_STOCKAGE);
}

/**
 * Ramène une URL de média à la forme la plus économique pour `next/image`.
 *
 * - Média ré-hébergé (quel que soit l'hôte : `azalee.rosegriffon.fr`,
 *   `rosegriffon.fr`, `storage.rosegriffon.fr`) → chemin RELATIF. nginx sert
 *   `/storage/v1/` sur l'origine du site : zéro cross-origin, et `next/image`
 *   traite une URL relative comme locale (aucun `remotePatterns` requis).
 * - Média encore chez X (`pbs.twimg.com`) → renvoyé tel quel, l'hôte est déjà
 *   autorisé dans `next.config.ts`.
 * - Tout le reste (chaîne vide, `javascript:`, chemin bizarre) → chaîne vide,
 *   l'appelant filtre.
 */
export function normaliserUrlMedia(url: string | undefined | null): string {
	if (!estChaineNonVide(url)) {
		return "";
	}
	const propre = url.trim();
	const position = propre.indexOf(CHEMIN_STOCKAGE);
	if (position >= 0) {
		return propre.slice(position);
	}
	if (propre.startsWith("https://") || propre.startsWith("/")) {
		return propre;
	}
	return "";
}

/**
 * Extrait les IMAGES d'un `tweets.media` brut (jsonb).
 *
 * On ne garde que `type === "photo"` : les vidéos vivent sur `video.twimg.com`,
 * hôte volontairement absent de `remotePatterns` — et la page ne montre que des
 * images. Priorité de source : le Storage self-host quand le fichier y existe,
 * repli sur l'URL d'origine sinon (exigence du chantier).
 */
export function extraireImages(media: unknown): ImageCampagne[] {
	if (!Array.isArray(media)) {
		return [];
	}
	const images: ImageCampagne[] = [];
	for (const brut of media) {
		if (!brut || typeof brut !== "object") {
			continue;
		}
		const item = brut as MediaTweet;
		if (item.type !== "photo") {
			continue;
		}
		const candidats = [
			item.storage_url,
			item.url,
			item.previewUrl,
			item.preview_url,
			item.original_url,
		].filter(estChaineNonVide);
		if (candidats.length === 0) {
			continue;
		}
		// Le Storage self-host d'abord : fichier servi depuis notre origine, donc
		// pas de dépendance à la disponibilité de pbs.twimg.com.
		const preferee = candidats.find(estUrlStockage) ?? candidats[0];
		const src = normaliserUrlMedia(preferee);
		if (!src) {
			continue;
		}
		images.push({
			src,
			largeur: typeof item.width === "number" ? item.width : null,
			hauteur: typeof item.height === "number" ? item.height : null,
			source: normaliserUrlMedia(item.original_url ?? preferee) || src,
		});
	}
	return images;
}

/** Lien vers le post d'origine sur X. */
export function urlPostX(pseudo: string, tweetId: string): string {
	return `https://x.com/${pseudo}/status/${tweetId}`;
}

/** Lien vers la recherche X en direct pour un hashtag (bouton « Participer »). */
export function urlRechercheX(hashtag: string): string {
	return `https://x.com/search?q=${encodeURIComponent(`#${hashtag}`)}&f=live`;
}

/** Affichage d'un hashtag : la base le stocke sans croisillon, l'écran le remet. */
export function afficherHashtag(hashtag: string): string {
	return `#${hashtag}`;
}

/** Où en est la campagne par rapport à ses bornes éditoriales. */
export function etatCampagne(
	campagne: Pick<Campagne, "debutLe" | "finLe">,
	maintenant: Date = new Date()
): "a-venir" | "en-cours" | "terminee" {
	const debut = campagne.debutLe ? new Date(campagne.debutLe) : null;
	const fin = campagne.finLe ? new Date(campagne.finLe) : null;
	if (fin && maintenant > fin) {
		return "terminee";
	}
	if (debut && maintenant < debut) {
		return "a-venir";
	}
	return "en-cours";
}

/** Libellé français de l'état d'une campagne. */
export function libelleEtatCampagne(etat: ReturnType<typeof etatCampagne>): string {
	switch (etat) {
		case "a-venir":
			return "À venir";
		case "terminee":
			return "Terminée";
		default:
			return "En cours";
	}
}

const FORMAT_COMPACT = new Intl.NumberFormat("fr-FR", {
	maximumFractionDigits: 1,
	notation: "compact",
});

/** Nombre compact en français (1 200 → « 1,2 k »). */
export function formaterNombre(valeur: number | undefined | null): string {
	if (typeof valeur !== "number" || !Number.isFinite(valeur)) {
		return "0";
	}
	return FORMAT_COMPACT.format(valeur);
}

/**
 * Texte d'un post nettoyé pour l'affichage : les liens `t.co` de fin (ceux des
 * médias joints) n'apportent rien dans une carte et mangent la place.
 */
export function extraitTexte(texte: string, maximum = 220): string {
	const sansTco = texte.replace(/https:\/\/t\.co\/\w+/g, "").replace(/\s+\n/g, "\n").trim();
	if (sansTco.length <= maximum) {
		return sansTco;
	}
	return `${sansTco.slice(0, maximum).trimEnd()}…`;
}
