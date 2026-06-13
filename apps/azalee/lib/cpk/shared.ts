/**
 * Types + helpers PURS de l'index CPK, client-safe.
 *
 * Ce module ne touche NI sqlite, NI Node, NI le réseau → importable depuis un
 * composant `"use client"` comme depuis une page serveur (cf. frontière stricte
 * azalee : un `"use client"` ne doit jamais importer une valeur d'une lib qui
 * touche sqlite/supabase-server/Node). Le data-fetch SQLite vit dans
 * `lib/cpk/index.ts` (`import "server-only"`).
 *
 * `cpkAssetUrl()` mappe un `(path, ext)` de l'index vers l'URL CDN qui sert le
 * CONTENU décodé du fichier — le CDN `cdn.rosegriffon.fr` décode déjà tout
 * fichier CPK live. Mapping validé par probe HTTP (vérité terrain) :
 *   - g4tx (100 % sous `data/dx11/`) → `/dx11/<path-après-data/dx11/>.png`
 *     (décodage g4tx→png live ; 200 image/png mesuré).
 *   - g4md/g4mg → `/model/<code>.glb` (assemblage glTF live ; 200 mesuré).
 *   - autre → `/g4tx/<path>` (route raw-decode CDN ; peut 404 si non couvert).
 */

/** Une ligne de l'index CPK (forme exposée par l'API/lib). */
export interface CpkFile {
	/** Nom de fichier, ex. `c05021090_l.g4tx`. */
	name: string;
	/** Extension sans point, ex. `g4tx` | `bin` | `g4md`. */
	ext: string;
	/** Archive CPK contenant le fichier, ex. `<hash>.cpk`. */
	cpk: string;
	/** Chemin complet, ex. `data/dx11/menu/.../c05021090_l.g4tx`. */
	path: string;
}

/** Un sous-dossier d'un répertoire de l'index, avec son nombre de descendants. */
export interface CpkDir {
	/** Nom du segment, ex. `face` | `menu` | `_uniform`. */
	name: string;
	/** Nombre total de fichiers sous ce sous-dossier (récursif). */
	count: number;
}

/** Résultat d'un listing de répertoire (`listDir`). */
export interface CpkListing {
	/** Le répertoire listé (chemin normalisé, sans slash final). */
	dir: string;
	/** Sous-dossiers directs, triés par nom. */
	dirs: CpkDir[];
	/** Fichiers directs du répertoire, triés par nom. */
	files: CpkFile[];
}

/** Type de contenu CDN dérivé de l'extension. */
export type CpkAssetKind = "image" | "model" | "raw";

const CDN_BASE = "https://cdn.rosegriffon.fr";

/** Extensions décodées en image (g4tx → png live par le CDN). */
const IMAGE_EXTS = new Set(["g4tx"]);
/** Extensions de modèle 3D (assemblées en glb live par le CDN `/model/`). */
const MODEL_EXTS = new Set(["g4md", "g4mg"]);

/** Catégorise une extension d'index en famille de contenu CDN. */
export function cpkAssetKind(ext: string): CpkAssetKind {
	const e = ext.toLowerCase();
	if (IMAGE_EXTS.has(e)) return "image";
	if (MODEL_EXTS.has(e)) return "model";
	return "raw";
}

/** Retire le préfixe racine `data/` d'un chemin index. */
function stripDataPrefix(path: string): string {
	return path.startsWith("data/") ? path.slice("data/".length) : path;
}

/**
 * URL CDN du CONTENU d'un fichier de l'index.
 *
 * @param path chemin complet de l'index (avec préfixe `data/`).
 * @param ext  extension sans point (si omis, dérivée du `path`).
 * @returns l'URL CDN, ou `null` si aucun mapping fiable (le caller fallback).
 */
export function cpkAssetUrl(path: string, ext?: string): string | null {
	const segments = path.split("/");
	const name = segments[segments.length - 1] ?? path;
	const dot = name.lastIndexOf(".");
	const e = (ext ?? (dot > 0 ? name.slice(dot + 1) : "")).toLowerCase();
	const kind = cpkAssetKind(e);

	if (kind === "image") {
		// g4tx vivent 100 % sous `data/dx11/` → `/dx11/<reste>.png` (g4tx→png live).
		const rel = path.startsWith("data/dx11/")
			? path.slice("data/dx11/".length)
			: stripDataPrefix(path);
		const noExt = rel.replace(/\.g4tx$/i, "");
		return `${CDN_BASE}/dx11/${noExt}.png`;
	}

	if (kind === "model") {
		// `/model-full/<code>.glb` — assemblage glTF live (corps+visage+uniforme) par
		// nie-model-serve. `code` = basename sans extension (ex. `n031708`). L'ancienne
		// route `/model/` n'existe pas côté serveur (404) ; `/model-full/` est la vraie.
		const base = name.replace(/\.(g4md|g4mg)$/i, "");
		return `${CDN_BASE}/model-full/${base}.glb`;
	}

	// raw : bytes décompressés/déchiffrés bruts du CPK (nie-model-serve /raw, texte/download).
	return `${CDN_BASE}/raw/${path}`;
}

/**
 * URL du décodage JSON natif d'un `cfg.bin`/`objbin`/`fxbin`/`mevbin` (RDBN ou T2B)
 * par nie-model-serve (`/cfg/<vfs-path>.json`). `path` = chemin d'index (préfixe `data/`).
 */
export function cpkCfgUrl(path: string): string {
	return `${CDN_BASE}/cfg/${path}.json`;
}

/**
 * URL du décodage **typé** d'un `cfg.bin` (`/typed/<vfs-path>.json`) — nie-model-serve
 * dispatche vers le parseur de famille `nie-data` (formation, skill, item, mission…) et
 * renvoie `{ family, data }` (structures de jeu nommées), ou `{ family: null, key, generic }`
 * si aucune famille typée ne correspond (le caller bascule sur l'arbre JSON brut).
 */
export function cpkTypedUrl(path: string): string {
	return `${CDN_BASE}/typed/${path}.json`;
}

/** Réponse de `/typed` : soit une famille reconnue + données typées, soit un repli générique. */
export interface CpkTypedResponse {
	/** Nom de la famille de jeu (`"formation"`, `"item"`…) ou `null` si non typée. */
	family: string | null;
	/** Données typées de la famille (présent si `family` non nul). */
	data?: unknown;
	/** Clé de fichier dérivée (présent si `family` nul) — aide au diagnostic. */
	key?: string;
	/** RDBN/T2B brut (forme iecode) si aucune famille typée. */
	generic?: unknown;
}

/** URL des bytes bruts décompressés du CPK (`/raw/<vfs-path>`) — texte, download, lecteurs. */
export function cpkRawUrl(path: string): string {
	return `${CDN_BASE}/raw/${path}`;
}

/**
 * URL du décodage audio CRI (`/audio/<vfs-path>`) → WAV PCM 16-bit décodé live par
 * nie-model-serve (HCA/ADX, conteneurs ACB/AWB). Lisible directement par `<audio>`.
 */
export function cpkAudioUrl(path: string): string {
	return `${CDN_BASE}/audio/${path}`;
}

/**
 * URL du décodage vidéo CRI (`/video/<vfs-path>`) → MP4 fragmenté (démux USM Sofdec2
 * + remux H.264) décodé live par nie-model-serve. Lisible directement par `<video>`.
 */
export function cpkVideoUrl(path: string): string {
	return `${CDN_BASE}/video/${path}`;
}

/**
 * Variante WebP redimensionnée pour les vignettes d'images (g4tx → webp `?w=`).
 * Sert la galerie/arbre en léger ; `null` si l'extension n'est pas une image.
 */
export function cpkThumbUrl(path: string, ext?: string, width = 400): string | null {
	const url = cpkAssetUrl(path, ext);
	if (!url || cpkAssetKind(ext ?? path.split(".").pop() ?? "") !== "image") return null;
	// `/dx11/...png` accepte `?w=&format=webp` (cdn-variants resize+webp).
	return `${url}?w=${width}&format=webp`;
}

/** Libellé humain d'un segment top-level (pour l'UI de l'arbre). */
export function topLabel(top: string): string {
	const labels: Record<string, string> = {
		common: "Commun",
		dx11: "DX11 (PC)",
		movie: "Vidéos",
		font: "Polices",
	};
	return labels[top] ?? top;
}

/**
 * Libellé humain d'un segment de chemin connu (sous-dossiers récurrents de
 * l'index). Sert le fil d'Ariane et les en-têtes de répertoire. Repli : le
 * segment brut (les noms techniques restent lisibles : `_face`, `c05021090`…).
 */
export function segLabel(seg: string): string {
	const labels: Record<string, string> = {
		event: "Événements",
		event_cfg: "Config événements",
		text: "Textes",
		chr: "Personnages",
		sound: "Sons",
		sound_asset: "Assets sonores",
		map: "Cartes",
		gamedata: "Données de jeu",
		effect: "Effets",
		menu: "Menus",
		shader: "Shaders",
		movie: "Vidéos",
		font: "Polices",
		_face: "Visages",
		_uniform: "Uniformes",
		_hair: "Cheveux",
	};
	return labels[seg] ?? seg;
}

/** Normalise un chemin de répertoire : retire les slashs de tête/queue. */
export function normalizeDir(path: string): string {
	return path.replace(/^\/+/, "").replace(/\/+$/, "");
}

// --- Classification de PREVIEW (par extension) -----------------------------

/**
 * Famille de PREVIEW d'un fichier, plus fine que `CpkAssetKind` : pilote le
 * rendu de la fiche fichier (`<img>`, viewer 3D, player audio/vidéo, texte,
 * config binaire, ou lien brut). Purement dérivée de l'extension.
 */
export type CpkPreviewKind =
	| "image"
	| "model"
	| "text"
	| "config"
	| "sound"
	| "movie"
	| "package"
	| "raw";

const TEXT_EXTS = new Set(["txt", "json", "xml", "csv", "lua", "cfg", "ini", "yml", "yaml"]);
const CONFIG_EXTS = new Set(["bin", "objbin", "fxbin", "mevbin", "cfg.bin"]);
const SOUND_EXTS = new Set(["acb", "awb", "hca", "wav", "at9"]);
const MOVIE_EXTS = new Set(["usm", "mp4", "webm", "bk2"]);
/** Archives G4PK (paquets de sous-fichiers) — listées par le viewer paquet. */
const PACKAGE_EXTS = new Set(["g4pk", "g4pkm", "g4ra"]);

/** Détermine la famille de preview d'une extension (sans point). */
export function cpkPreviewKind(ext: string): CpkPreviewKind {
	const e = ext.toLowerCase();
	if (IMAGE_EXTS.has(e)) return "image";
	if (MODEL_EXTS.has(e)) return "model";
	if (SOUND_EXTS.has(e)) return "sound";
	if (MOVIE_EXTS.has(e)) return "movie";
	if (PACKAGE_EXTS.has(e)) return "package";
	if (TEXT_EXTS.has(e)) return "text";
	if (CONFIG_EXTS.has(e)) return "config";
	return "raw";
}

/** Libellé humain d'une famille de preview (badge de la fiche fichier). */
export function previewKindLabel(kind: CpkPreviewKind): string {
	const labels: Record<CpkPreviewKind, string> = {
		image: "Texture",
		model: "Modèle 3D",
		text: "Texte",
		config: "Config binaire",
		sound: "Audio",
		movie: "Vidéo",
		package: "Archive G4PK",
		raw: "Fichier",
	};
	return labels[kind];
}

/**
 * Code de modèle 3D (basename sans extension) éligible à un viewer
 * `/model-full/<code>.glb` (assemblage corps+visage+uniforme live par le CDN).
 *
 * Vérité terrain (préfixes des codes de l'index `common/chr/`) :
 *   - `c0xxxxxxx` → personnages jouables (face + corps).
 *   - `n0xxxxxx`  → uniformes / pièces d'armure (`common/chr/_uniform/`).
 *   - `ke/ks/wmm…`→ keshin / soul / miximax (modèles d'invocation).
 * On embarque le viewer pour ces préfixes ; sinon (props, décor map…) on se
 * contente d'un lien `/model/<code>.glb` (pas d'assemblage full pertinent).
 */
export function modelFullCode(name: string): string | null {
	const base = name.replace(/\.(g4md|g4mg|g4pkm|g4pk)$/i, "");
	if (/^c\d{8}$/i.test(base)) return base; // personnage jouable
	if (/^n\d{6,7}$/i.test(base)) return base; // uniforme / armure
	if (/^(ke|ks|wmm|wks|wss)\w+/i.test(base)) return base; // keshin / soul / miximax
	return null;
}

/** URL CDN du GLB assemblé complet (corps+visage+uniforme) pour un code perso. */
export function modelFullUrl(code: string): string {
	return `${CDN_BASE}/model-full/${code}.glb`;
}
