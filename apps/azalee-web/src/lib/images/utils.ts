/**
 * Utilitaires légers pour la génération d'URLs d'images de jeu.
 * Fonctionne côté client et serveur.
 */
import itemImageManifest from "@/data/item-image-manifest.json";

const ITEM_IMAGE_MANIFEST = itemImageManifest as Record<string, string>;

// Constantes globales
export const CDN_URL = process.env.NEXT_PUBLIC_ASSET_URL || "https://azalee.rosegriffon.fr";
export const CDN_ASSETS = CDN_URL; // Alias pour compatibilité
// Dump PNG dx11 brut (alias nginx → /home/.../inazuma/data/dx11/menu/).
// Tout le contenu menu vit ici : 200_icon/ 220_img/ icon_chr/ … (cf. cdn-2).
const MENU_DUMP_BASE = "https://cdn.rosegriffon.fr/dx11/menu";

// L'ancien CDN cdn.rosegriffon.fr/static/azalee/menu/ est vide (404, cf. cdn-2).
// Fallback de resolveAssetUrl et export public pointent désormais sur le dump dx11.
const MENU_BASE = MENU_DUMP_BASE;
export const MENU_BUCKET_URL = MENU_DUMP_BASE;

// Prefixe Supabase Storage legacy stocke en DB (cf. inagle_skills.image_url
// — ~1010 lignes, 2026-04). Rewrite transparent vers le CDN local.
const LEGACY_STORAGE_PREFIX = "/storage/v1/object/public/menu/";

/**
 * Mappe un path legacy `200_icon/10_icon_chr/<folder>/<file>.webp` (DB Supabase)
 * vers le dump PNG dx11 quand un mapping est connu.
 */
function mapLegacyMenuPath(menuPath: string): string | null {
	const chrMatch = menuPath.match(/^200_icon\/10_icon_chr\/([^/]+)\/([^/]+?)_l(?:_[^.]+)?\.webp$/);
	if (chrMatch) {
		const folder = chrMatch[1];
		const base = chrMatch[2];
		if (folder.startsWith("aura_")) {
			return `${MENU_DUMP_BASE}/icon_chr/${folder}/${base}_l_${base}_l00.png`;
		}
		if (folder === "face") {
			return `${MENU_DUMP_BASE}/icon_chr/face/${base}_l_${base}_1_l00.png`;
		}
		if (folder === "uniform") {
			return `${MENU_DUMP_BASE}/icon_chr/uniform/${base}_l_${base}_1.png`;
		}
		return null;
	}
	const emMatch = menuPath.match(/^200_icon\/01_icon_emblem\/(em[0-9]+)\.webp$/);
	if (emMatch) {
		const code = emMatch[1];
		return `${MENU_DUMP_BASE}/200_icon/01_icon_emblem/${code}_${code}.png`;
	}
	const itemMatch = menuPath.match(/^200_icon\/02_icon_item\/(.+)\.webp$/);
	if (itemMatch) {
		return `${MENU_DUMP_BASE}/200_icon/02_icon_item/${itemMatch[1]}.png`;
	}
	const telopMatch = menuPath.match(/^220_img\/telop_waza\/(fr|en)\/([^/]+)\.webp$/);
	if (telopMatch) {
		const lang = telopMatch[1];
		const raw = telopMatch[2];
		const dupMatch = raw.match(/^(.+)_\1$/);
		const filename = dupMatch
			? `${dupMatch[1]}_${dupMatch[1]}`
			: ((c) => `${c}_${c}`)(raw.replace(/_0$/, ""));
		return `${MENU_DUMP_BASE}/220_img/telop_waza/${lang}/${filename}.png`;
	}
	return null;
}

/** Resolve a potentially relative asset path to a full URL. */
export function resolveAssetUrl(path: string | null | undefined): string | null {
	if (!path) {
		return null;
	}
	if (path.startsWith(LEGACY_STORAGE_PREFIX)) {
		const stripped = path.slice(LEGACY_STORAGE_PREFIX.length);
		return mapLegacyMenuPath(stripped) || `${MENU_BASE}/${stripped}`;
	}
	if (path.startsWith("http") || path.startsWith("/")) {
		return path;
	}
	return mapLegacyMenuPath(path) || `${MENU_BASE}/${path}`;
}

/**
 * URL d'un visage de personnage depuis le dump dx11 brut.
 * Pattern fichier : `icon_chr/face/{base}_l_{base}_1_l00.png` (variant 1 par défaut).
 */
const CHR_DUMP_BASE = "https://cdn.rosegriffon.fr/dx11/menu/icon_chr";

export function getCharacterFaceUrl(
	charaId: string | undefined | null,
	_unused?: string | null
): string {
	if (!charaId) {
		return PLACEHOLDERS.character;
	}
	// Strip _5000/_5100/etc. suffix — dump only has base code face icons
	const baseCode = charaId.replace(/_\d{4}$/, "");
	return `${CHR_DUMP_BASE}/face/${baseCode}_l_${baseCode}_1_l00.png`;
}
// Alias pour compatibilité
export const getCharacterImageUrl = getCharacterFaceUrl;

/**
 * URL d'un uniforme de personnage (vue de face).
 * Pattern fichier : `icon_chr/uniform/u{NNN}_l_u{NNN}_1.png` (préfixe `c` → `u`).
 */
export function getCharacterUniformUrl(charaId: string | undefined | null): string {
	if (!charaId) {
		return "";
	}
	const baseCode = charaId.replace(/_\d{4}$/, "");
	const uniformCode = baseCode.startsWith("c") ? `u${baseCode.slice(1)}` : baseCode;
	return `${CHR_DUMP_BASE}/uniform/${uniformCode}_l_${uniformCode}_1.png`;
}

/**
 * URL du dos de l'uniforme (variant 2).
 */
export function getCharacterUniformBackUrl(charaId: string | undefined | null): string {
	if (!charaId) {
		return "";
	}
	const baseCode = charaId.replace(/_\d{4}$/, "");
	const uniformCode = baseCode.startsWith("c") ? `u${baseCode.slice(1)}` : baseCode;
	return `${CHR_DUMP_BASE}/uniform/${uniformCode}_l_${uniformCode}_2.png`;
}

/**
 * URL d'une technique (image telop) — dump dx11 brut.
 * Pattern fichier : `220_img/telop_waza/fr/{code}_{code}.png`.
 */
export function getSkillImageUrl(
	skillId: string | undefined | null,
	_unused?: string | null
): string {
	if (!skillId) {
		return "";
	}
	const baseCode = skillId.replace(/_[a-z]+$/i, "");
	return `${MENU_DUMP_BASE}/220_img/telop_waza/fr/${baseCode}_${baseCode}.png`;
}

/**
 * URL d'un objet — dump dx11 brut.
 * Mapping `internalCode → path relatif` via `data/item-image-manifest.json`.
 * Fallback : `200_icon/02_icon_item/{itemId}.png`.
 */
export function getItemImageUrl(itemId: string): string {
	if (!itemId) {
		return "";
	}
	const mapped = ITEM_IMAGE_MANIFEST[itemId];
	if (mapped) {
		return `${MENU_DUMP_BASE}/${mapped}.png`;
	}
	return `${MENU_DUMP_BASE}/200_icon/02_icon_item/${itemId}.png`;
}
// Alias
export const getItemIconUrl = getItemImageUrl;

/**
 * URL d'un emblème d'équipe — dump dx11 brut.
 * Pattern : `200_icon/01_icon_emblem/em{N}_em{N}.png`.
 */
export function getEmblemImageUrl(emblemId: string | number | undefined | null): string {
	if (!emblemId && emblemId !== 0) {
		return "";
	}
	const s = emblemId.toString();
	let emCode: string | null = null;
	if (s.startsWith("em")) {
		emCode = s;
	} else {
		const num = Number.parseInt(s, 10);
		if (!Number.isNaN(num) && num > 0) {
			emCode = `em${String(num).padStart(4, "0")}`;
		}
	}
	if (!emCode) {
		return "";
	}
	return `${MENU_DUMP_BASE}/200_icon/01_icon_emblem/${emCode}_${emCode}.png`;
}
// Alias
export const getTeamEmblemUrl = getEmblemImageUrl;

/**
 * Helpers pour les icônes UI (Genre, Élément, Rareté, Catégorie)
 */

export function getGenderIconUrl(gender: number | string | undefined | null): string {
	if (gender === undefined || gender === null) {
		return "";
	}
	const g = gender.toString().toLowerCase();
	const isFemale = g === "1" || g === "2" || g === "f" || g === "female";
	return isFemale ? "/move/girl.webp" : "/move/boy.webp";
}

export function getSkillElementIconUrl(element: string | number): string {
	if (!element) {
		return "";
	}
	const el = element.toString().toLowerCase();
	const map: Record<string, string> = {
		"1": "fire",
		"2": "wind",
		"3": "forest",
		"4": "mountain",
		air: "wind",
		bois: "forest",
		earth: "mountain",
		feu: "fire",
		fire: "fire",
		forest: "forest",
		foret: "forest",
		forêt: "forest",
		montagne: "mountain",
		mountain: "mountain",
		vent: "wind",
		wind: "wind",
		wood: "forest",
	};
	const filename = map[el];
	if (!filename) {
		return "";
	}
	return `/spirit_type/${filename}.webp`;
}
// Parfois appelé getSkillIconUrl pour l'élément (contexte dépendant)
// Dans le doute, on alias vers l'élément si c'est utilisé pour des petites icônes
export const getSkillIconUrl = getSkillElementIconUrl;

export function getSkillCategoryIconUrl(category: string | number): string {
	if (!category) {
		return "";
	}
	const cat = category.toString().toLowerCase();
	const map: Record<string, string> = {
		"1": "tir",
		"2": "dribble",
		"3": "defense",
		"4": "gardien",
		arret: "gardien",
		arrêt: "gardien",
		block: "defense",
		catch: "gardien",
		def: "defense",
		defense: "defense",
		dribble: "dribble",
		défense: "defense",
		gardien: "gardien",
		gk: "gardien",
		keeper: "gardien",
		save: "gardien",
		shoot: "tir",
		shot: "tir",
		tir: "tir",
	};
	const filename = map[cat];
	if (!filename) {
		return "";
	}
	return `/move/${filename}.webp`;
}

export function getRarityIconUrl(rarity: string | number | undefined | null): string {
	if (rarity === undefined || rarity === null) {
		return "";
	}
	const r = rarity.toString().toLowerCase();
	const map: Record<string, string> = {
		"1": "normal.webp",
		"2": "experimente.webp",
		"20": "basara.webp",
		"3": "emerite.webp",
		"4": "heros.webp",
		"5": "legendaire.webp",
		basara: "basara.webp",
		legendaire: "legendaire.webp",
		légendaire: "legendaire.webp",
		n: "normal.webp",
		normal: "normal.webp",
		r: "experimente.webp",
		rare: "experimente.webp",
		sr: "emerite.webp",
		ssr: "heros.webp",
		super: "emerite.webp",
		ur: "legendaire.webp",
	};
	const file = map[r];
	if (!file) {
		return "";
	}
	return `/rarity/${file}`;
}

/**
 * URL pour les vidéos de techniques
 */
export function getSkillVideoUrl(skillId: string | undefined | null): string {
	if (!skillId) {
		return "";
	}
	// Les vidéos sont généralement hébergées ailleurs ou dans un dossier spécifique
	// Pour l'instant, on pointe vers le CDN mirror si disponible
	return `${CDN_URL}/zukan-assets-mirror/movies/${skillId}.mp4`;
}

/**
 * URL d'une Aura (Keshin, Soul, Armed, ...) depuis le dump dx11 brut servi
 * par cdn.rosegriffon.fr (alias nginx → /home/.../inazuma/data/dx11/).
 *
 * Pattern fichier sur disque : `{base}_l_{base}_l00.png`.
 *   - Keshins (wks/wkk/wkd/wko/wkt) → aura_fs/k{padded6}
 *   - Souls   (wss/wso/wsd/wsk)    → aura_soul/a{padded6}
 *   - Armed   (was/wak/wad/wao)    → aura_soul/a{padded6}  (mapping wa→c non fiable)
 */
const AURA_DUMP_BASE = CHR_DUMP_BASE;

/**
 * Extrait la partie numérique d'un asset_code keshin/soul/armed en retirant le
 * préfixe `w[ksad][a-z]` ET tout suffixe de variante.
 *
 * Les codes réels portent des suffixes de variante hétérogènes que le fichier
 * disque (base-only `{base}_l_{base}_l00.png`) ne reflète pas :
 *   - digits   : `was00290_1`
 *   - alpha-num : `was00240_b1`, `wad00650_h2`, `was00303_h1`
 *   - stage     : `wks02020_st0701`, `wks02060_st0901`
 * On ne garde donc que les chiffres qui suivent immédiatement le préfixe.
 * Cohérent avec db-1.
 */
function auraBaseNum(assetCode: string, prefix: RegExp): string | null {
	const m = assetCode.replace(prefix, "").match(/^\d+/);
	return m ? m[0] : null;
}

export function getAuraImageUrl(assetCode: string | undefined | null, _subType?: string): string {
	if (!assetCode) {
		return "";
	}

	const buildAuraUrl = (folder: string, base: string): string =>
		`${AURA_DUMP_BASE}/${folder}/${base}_l_${base}_l00.png`;

	if (assetCode.startsWith("wk")) {
		const num = auraBaseNum(assetCode, /^wk[a-z]/);
		if (num) {
			return buildAuraUrl("aura_fs", `k${num.padStart(6, "0")}`);
		}
	}
	if (assetCode.startsWith("ws") || (assetCode.startsWith("wa") && !assetCode.startsWith("wap"))) {
		const num = auraBaseNum(assetCode, /^w[sa][a-z]/);
		if (num) {
			return buildAuraUrl("aura_soul", `a${num.padStart(6, "0")}`);
		}
	}

	return "";
}

/**
 * URL d'une icône Miximax (visage personnage) depuis le dossier aura_mixi du dump dx11.
 * Pattern fichier : `{base}_l_{base}_l00.png`.
 */
export function getMiximaxIconUrl(iconCode: string | undefined | null): string {
	if (!iconCode) {
		return "";
	}
	return `${AURA_DUMP_BASE}/aura_mixi/${iconCode}_l_${iconCode}_l00.png`;
}

/**
 * Résout l'URL telop (grande image) d'une aura à partir de son asset_code.
 * Les fichiers du bucket utilisent le pattern {code}_{code}.webp avec des préfixes
 * différents de ceux stockés en DB.
 *
 * Mapping :
 * - Keshins (wks/wkk/wkd/wko/wkt):  wk*{N} -> k{N padded 6 digits}
 * - Souls (wss/wso/wsd/wsk):         ws*{N} -> a{N padded 6 digits}
 * - Armed (was/wak/wad/wao):         wa*{N} -> a{N padded 6 digits}
 * - Mode changes: mode_change_{X} -> tel quel
 * - Miximax wap: wap{N} -> aura_power_wap{N}
 * - Miximax wmm (short ≤5 digits): wmm000XX -> aura_mixi_c05028{XXX}
 * - Miximax wmm (long charId): wmm{charId} -> aura_mixi_c{charId}
 */
export function resolveAuraTelopUrl(assetCode: string | undefined | null): string | null {
	if (!assetCode) {
		return null;
	}

	let bucketCode: string | null = null;

	if (assetCode.startsWith("wk")) {
		// All Keshins: wks/wkk/wkd/wko/wkt -> k{N padded 6}
		// Strip variant suffix (_b1/_h2/_st0701/_1…) → base only (cf. auraBaseNum).
		const num = auraBaseNum(assetCode, /^wk[a-z]/);
		bucketCode = num ? `k${num.padStart(6, "0")}` : null;
	} else if (assetCode.startsWith("wmm")) {
		// Miximax character-based: wmm{N} -> aura_mixi_c{charId}
		const numStr = assetCode.replace(/^wmm/, "").replace(/_.*$/, "");
		const num = Number.parseInt(numStr, 10);
		if (!Number.isNaN(num)) {
			if (numStr.length > 5) {
				// Long code = direct character ID (e.g. wmm11010230 -> c11010230)
				bucketCode = `aura_mixi_c${numStr}`;
			} else if (num <= 999) {
				// Short code = c05028 prefix (e.g. wmm00010 -> c05028010)
				bucketCode = `aura_mixi_c05028${String(num).padStart(3, "0")}`;
			}
		}
	} else if (assetCode.startsWith("ws") || assetCode.startsWith("wa")) {
		// Souls (ws*) and Armed (wa*) -> a{N padded 6}
		// Except wap which has special mapping
		if (assetCode.startsWith("wap")) {
			bucketCode = `aura_power_${assetCode}`;
		} else {
			// Strip variant suffix (_b1/_h2/_st0701/_1…) → base only (cf. auraBaseNum).
			const num = auraBaseNum(assetCode, /^w[sa][a-z]/);
			bucketCode = num ? `a${num.padStart(6, "0")}` : null;
		}
	} else if (assetCode.startsWith("mode_change_")) {
		bucketCode = assetCode;
	} else if (assetCode.includes("awakening")) {
		// Awakenings : pas de telop dédié dans le dump → placeholder `aura_power01`.
		bucketCode = "aura_power01";
	}

	if (!bucketCode) {
		return null;
	}

	// Dump PNG dx11 brut. Pattern : `220_img/telop_waza/fr/{code}_{code}.png`.
	return `${MENU_DUMP_BASE}/220_img/telop_waza/fr/${bucketCode}_${bucketCode}.png`;
}

/**
 * URL pour les modèles 3D (360°)
 */
export function getCharacterModel360Url(
	hash: string,
	frame: number,
	full: boolean = false
): string {
	// Format Zukan: https://zukan.inazuma.jp/3d/{hash}/{type}/{frame}.webp
	// Notre miroir: /zukan-assets-mirror/3d/{hash}/{type}/{frame}.webp
	// Frame est souvent 0-7 ou 0-15
	const type = full ? "full" : "face";
	return `${CDN_URL}/zukan-assets-mirror/3d/${hash}/${type}/${frame}.webp`;
}

/**
 * URL de fallback générique — pointe vers /ievr.webp qui existe en public/.
 * (Le dossier /images/placeholders/ n'a jamais été créé ; ces 3 paths
 * étaient des 404 silencieux dans les Image fallbacks de characters/skills/items.)
 */
export const PLACEHOLDERS = {
	character: "/ievr.webp",
	item: "/ievr.webp",
	skill: "/ievr.webp",
} as const;

/**
 * Image Optimization Helper
 * Uses Next.js optimization endpoint
 */
export function getOptimizedImageUrl(
	url: string | null | undefined,
	width = 640,
	quality = 80
): string {
	if (!url) {
		return "";
	}
	if (url.startsWith("data:")) {
		return url;
	}

	// Use Next.js image optimization endpoint
	return `/_next/image?url=${encodeURIComponent(url)}&w=${width}&q=${quality}`;
}
