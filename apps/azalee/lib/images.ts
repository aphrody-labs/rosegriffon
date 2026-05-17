import itemImageManifest from "@/data/item-image-manifest.json";
import { SKILL_IMAGE_MAP } from "./skill-image-map";

const ITEM_IMAGE_MANIFEST = itemImageManifest as Record<string, string>;

/**
 * Utility functions for handling Inazuma Eleven: Victory Road images.
 * Images served from Supabase Storage bucket "menu".
 */

// CDN local cdn.rosegriffon.fr/static/azalee/menu/ (Phase 2026-05) — sert les
// 47k webp extraits de IECODE. URL publique fixe : pas d'env (le prerender Next
// peut ne pas voir NEXT_PUBLIC_CDN_URL et retomberait sur le legacy Supabase).
export const MENU_BUCKET_URL = "https://cdn.rosegriffon.fr/static/azalee/menu";

// Dump PNG dx11 brut (alias nginx → /home/.../inazuma/data/dx11/menu/).
// Coverage 2026-05 : icon_chr/aura_*, icon_chr/face, icon_chr/uniform,
// 200_icon/01_icon_emblem, 200_icon/02_icon_item, 220_img/telop_waza/{fr,en}.
export const MENU_DUMP_BASE = "https://cdn.rosegriffon.fr/dx11/menu";

export const CDN_BASE_URL = "https://azalee.rosegriffon.fr/zukan-assets-mirror";

// Prefixe Supabase Storage legacy stocke en DB (cf. inagle_skills.image_url
// — ~1010 lignes, 2026-04). Rewrite transparent vers le CDN local.
const LEGACY_STORAGE_PREFIX = "/storage/v1/object/public/menu/";

/**
 * Mappe un path stocke en DB Supabase (legacy `200_icon/10_icon_chr/<folder>/<file>_l_*_l00.webp`)
 * vers une URL servable du dump PNG dx11 (`cdn.rosegriffon.fr/dx11/menu/icon_chr/<folder>/...png`).
 *
 * Coverage :
 *   - `aura_fs|aura_soul|aura_armed|aura_mixi`  → `{base}_l_{base}_l00.png`
 *   - `face`                                    → `{base}_l_{base}_1_l00.png`  (variant 1, défaut)
 *   - `uniform`                                 → `{base}_l_{base}_1.png`      (variant 1, vue de face)
 *
 * Non couvert (retourne null) :
 *   - `200_icon/02_icon_item/...`, `200_icon/01_icon_emblem/...`, `220_img/...`  : à voir.
 *   - folders inconnus.
 *
 * Le suffix `_NNNNN_l00.webp` etait un artefact d'extraction Supabase Storage.
 */
function mapLegacyMenuPathToG4tx(
	menuPath: string,
	_width = 256,
): string | null {
	// 1. Patterns DB sous 200_icon/10_icon_chr/<folder>/<file>.webp
	const chrMatch = menuPath.match(
		/^200_icon\/10_icon_chr\/([^/]+)\/([^/]+?)_l(?:_[^.]+)?\.webp$/,
	);
	if (chrMatch) {
		const folder = chrMatch[1];
		const base = chrMatch[2];
		if (folder.startsWith("aura_")) {
			return `${AURA_BASE_URL}/${folder}/${base}_l_${base}_l00.png`;
		}
		if (folder === "face") {
			return `${AURA_BASE_URL}/face/${base}_l_${base}_1_l00.png`;
		}
		if (folder === "uniform") {
			return `${AURA_BASE_URL}/uniform/${base}_l_${base}_1.png`;
		}
		return null;
	}

	// 2. Emblems : 200_icon/01_icon_emblem/em{N}.webp → em{N}_em{N}.png
	const emMatch = menuPath.match(
		/^200_icon\/01_icon_emblem\/(em[0-9]+)\.webp$/,
	);
	if (emMatch) {
		const code = emMatch[1];
		return `${MENU_DUMP_BASE}/200_icon/01_icon_emblem/${code}_${code}.png`;
	}

	// 3. Items : 200_icon/02_icon_item/{file}.webp → {file}.png (best-effort, mapping non garanti)
	const itemMatch = menuPath.match(/^200_icon\/02_icon_item\/(.+)\.webp$/);
	if (itemMatch) {
		return `${MENU_DUMP_BASE}/200_icon/02_icon_item/${itemMatch[1]}.png`;
	}

	// 4. Telop waza : 220_img/telop_waza/{lang}/{code}.webp → {code}_{code}.png
	//    Variantes DB connues :
	//      - skills:  `whk01690_0.webp`           → strip `_0` → `whk01690_whk01690.png`
	//      - tactics: `wht20040_wht20040.webp`    → déjà dupliqué → utiliser tel quel
	//      - simple:  `whk01690.webp`             → dupliquer
	const telopMatch = menuPath.match(
		/^220_img\/telop_waza\/(fr|en)\/([^/]+)\.webp$/,
	);
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

/**
 * Extrait la portion `200_icon/.../<file>.webp` d'une URL `MENU_BUCKET_URL/...`
 * full-qualified pour permettre le rewrite vers G4TX live.
 */
function stripMenuBucketPrefix(url: string): string | null {
	const prefixes = [
		"https://cdn.rosegriffon.fr/static/azalee/menu/",
		`${MENU_BUCKET_URL}/`,
	];
	for (const p of prefixes) {
		if (url.startsWith(p)) return url.slice(p.length);
	}
	return null;
}

/** Resolve a potentially relative asset path to a full URL. */
export function resolveAssetUrl(
	path: string | null | undefined,
): string | null {
	if (!path) return null;
	if (path.startsWith(LEGACY_STORAGE_PREFIX)) {
		const stripped = path.slice(LEGACY_STORAGE_PREFIX.length);
		const g4 = mapLegacyMenuPathToG4tx(stripped);
		if (g4) return g4;
		return `${MENU_BUCKET_URL}/${stripped}`;
	}
	// URL full-qualified vers MENU_BUCKET_URL → tenter mapping G4TX
	if (path.startsWith("http")) {
		const stripped = stripMenuBucketPrefix(path);
		if (stripped) {
			const g4 = mapLegacyMenuPathToG4tx(stripped);
			if (g4) return g4;
		}
		return path;
	}
	if (path.startsWith("/")) return path;
	// Path relatif — tenter mapping G4TX, sinon fallback static bucket
	const g4 = mapLegacyMenuPathToG4tx(path);
	if (g4) return g4;
	return `${MENU_BUCKET_URL}/${path}`;
}

/**
 * Skill Image (Telop Waza) — dump dx11 brut.
 * Pattern fichier : `220_img/telop_waza/fr/{code}_{code}.png`.
 */
export function getSkillImageUrl(
	skillIdStr?: string,
	overrideUrl?: string | null,
): string | undefined {
	if (overrideUrl) return overrideUrl;
	if (!skillIdStr) return undefined;

	// SKILL_IMAGE_MAP gère les rares cas où DB stocke un alias → real filename.
	const aliasWebp = SKILL_IMAGE_MAP[`${skillIdStr}.webp`];
	const code = aliasWebp ? aliasWebp.replace(/\.webp$/, "") : skillIdStr;

	return `${MENU_DUMP_BASE}/220_img/telop_waza/fr/${code}_${code}.png`;
}

/**
 * Skill Video URL
 * Transforms: https://zukan.inazuma.jp/k/f/k/fkb9flhwhok.webm
 * To: /zukan/assets/movie/fkb9flhwhok.webm (Proxied to Supabase)
 */
export function getSkillVideoUrl(originalUrl?: string): string | undefined {
	if (!originalUrl) return undefined;

	// Transform Zukan URL to local mirror (proxied to API)
	if (originalUrl.includes("zukan.inazuma.jp")) {
		return originalUrl
			.replace("https://zukan.inazuma.jp/", "/zukan/assets/")
			.replace(".webm", ".mp4");
	}

	return originalUrl;
}

/**
 * Character Face Icon (200x200) — dump dx11 brut.
 * Pattern fichier : `icon_chr/face/{base}_l_{base}_1_l00.png`.
 */
export function getCharacterFaceUrl(
	internalCode?: string,
	overrideUrl?: string | null,
): string {
	if (overrideUrl) return overrideUrl;
	if (!internalCode) return "";
	const baseCode = internalCode.replace(/_\d+$/, "");
	return `${AURA_BASE_URL}/face/${baseCode}_l_${baseCode}_1_l00.png`;
}

/**
 * Unified function for character images, prioritizing local face icons.
 */
export function getCharacterImageUrl(
	idOrHash?: string,
	internalCode?: string,
	overrideUrl?: string | null,
): string {
	if (overrideUrl) return overrideUrl;
	const code = internalCode || idOrHash;
	if (!code || code.length < 5) return "";

	return getCharacterFaceUrl(code);
}

/**
 * Skill / Element Icon
 */
export function getSkillElementIconUrl(element: string): string {
	if (!element) return "";
	const normalized = element.toLowerCase();

	const map: Record<string, string> = {
		// English
		fire: "fire.webp",
		wind: "wind.webp",
		air: "wind.webp",
		forest: "forest.webp",
		wood: "forest.webp",
		earth: "mountain.webp",
		mountain: "mountain.webp",
		// French
		feu: "fire.webp",
		vent: "wind.webp",
		bois: "forest.webp",
		forêt: "forest.webp",
		foret: "forest.webp",
		montagne: "mountain.webp",
	};

	const file = map[normalized];
	if (!file) return "";
	return `/spirit_type/${file}`;
}

// Alias for backward compatibility
export const getSkillIconUrl = getSkillElementIconUrl;

/**
 * Skill Category Icon
 */
export function getSkillCategoryIconUrl(category: string): string {
	if (!category) return "";
	const normalized = category.toLowerCase();

	const map: Record<string, string> = {
		shoot: "tir.webp",
		shot: "tir.webp",
		tir: "tir.webp",

		dribble: "dribble.webp",

		block: "defense.webp",
		defense: "defense.webp",
		défense: "defense.webp",
		def: "defense.webp",

		catch: "gardien.webp",
		save: "gardien.webp",
		keeper: "gardien.webp",
		arrêt: "gardien.webp",
		arret: "gardien.webp",
		gardien: "gardien.webp",
		gk: "gardien.webp",
	};

	const file = map[normalized];
	if (!file) return "";

	return `/move/${file}`;
}

/**
 * Spirit (Avatar) Icon
 */
export function getSpiritIconUrl(spiritType: string): string {
	if (!spiritType) return "";
	return `/spirit_type/${spiritType.toLowerCase()}.webp`;
}

/**
 * Item Icon — dump dx11 brut.
 *
 * Mapping via `data/item-image-manifest.json` (scan disque + cross-ref Supabase) :
 *   - valeur = path relatif depuis `dx11/menu/` (ex: `200_icon/02_icon_item/icon_item10_tk_hr000007`)
 *   - couvre items dont DB image_url est tronqué (779) + items partagés avec skill telop (662)
 *   - fallback : `200_icon/02_icon_item/{internalCode}.png` (peut être 404 pour items sans icône extraite)
 */
export function getItemIconUrl(
	internalCode: string,
	overrideUrl?: string | null,
): string {
	if (overrideUrl) return overrideUrl;
	if (!internalCode) return "";
	const mapped = ITEM_IMAGE_MANIFEST[internalCode];
	if (mapped) return `${MENU_DUMP_BASE}/${mapped}.png`;
	return `${MENU_DUMP_BASE}/200_icon/02_icon_item/${internalCode}.png`;
}

/**
 * Team Emblem — dump dx11 brut.
 * Pattern fichier : `200_icon/01_icon_emblem/em{N}_em{N}.png`.
 */
export function getTeamEmblemUrl(
	id?: string,
	internalCode?: string,
	overrideUrl?: string | null,
): string {
	if (overrideUrl) return overrideUrl;
	const code = internalCode || id;
	if (!code) return "";
	const emCode = code.startsWith("em") ? code : `em${code}`;
	return `${MENU_DUMP_BASE}/200_icon/01_icon_emblem/${emCode}_${emCode}.png`;
}

export const CDN_ASSETS = {
	characterModel360: (hash: string, frame: number, full: boolean) =>
		`${CDN_BASE_URL}/character/model/${hash}/${full ? "full" : "face"}/${frame}.webp`,
};

/**
 * Rarity Icon
 */
export function getRarityIconUrl(rarity: string): string {
	if (!rarity) return "";
	const map: Record<string, string> = {
		n: "normal.webp",
		normal: "normal.webp",
		r: "experimente.webp",
		rare: "experimente.webp",
		sr: "emerite.webp",
		super: "emerite.webp",
		ssr: "heros.webp",
		ur: "legendaire.webp",
		ultra: "legendaire.webp",
		legend: "legendaire.webp",
		légendaire: "legendaire.webp",
		basara: "heros4.webp",
	};
	const file = map[rarity.toLowerCase()];
	if (!file) return "";

	return `/rarity/${file}`;
}

/**
 * Gender Icon
 */
export function getGenderIconUrl(gender: number | string): string {
	const g = gender.toString().toUpperCase();
	// M / 0: Male, F / 1: Female
	const isFemale = g === "F" || g === "1";
	const file = isFemale ? "girl.webp" : "boy.webp";
	return `/move/${file}`;
}

/**
 * Génère l'URL pour une Aura (Keshin, Soul, etc.) depuis le dump dx11 brut
 * servi par cdn.rosegriffon.fr (alias nginx → /home/.../inazuma/data/dx11/).
 *
 * Pattern fichier réel sur disque (PNG natifs, vérifiés 2026-05) :
 *   - Keshins : `aura_fs/k{padded6}_l_k{padded6}_l00.png`     (98 entrées)
 *   - Souls   : `aura_soul/a{padded6}_l_a{padded6}_l00.png`   (56 entrées)
 *   - Armed   : `aura_armed/c{8}_5000_l_c{8}_5000_l00.png`    (160 entrées, mapping wa→c non fiable)
 *   - Miximax : `aura_mixi/ca{4}_l_ca{4}_l00.png`             (17 entrées)
 *
 * URL emise : `cdn.rosegriffon.fr/dx11/menu/icon_chr/<folder>/<file>.png`
 * → fichier statique direct (cache nginx immutable 1y).
 */
const AURA_BASE_URL = "https://cdn.rosegriffon.fr/dx11/menu/icon_chr";

export function getAuraImageUrl(
	assetCode: string | undefined | null,
	subType: string = "Keshin",
): string {
	if (!assetCode) return "";

	// Helper : pattern fichier `{base}_l_{base}_l00.png` où base = ex. "k000040".
	const buildAuraUrl = (folder: string, base: string): string => {
		return `${AURA_BASE_URL}/${folder}/${base}_l_${base}_l00.png`;
	};

	// 1. Keshin : wk[a-z]{N} → aura_fs/k{padded6}
	if (assetCode.startsWith("wk")) {
		const num = assetCode.replace(/^wk[a-z]/, "").replace(/_\d+$/, "");
		if (num && /^\d+$/.test(num)) {
			const padded = num.padStart(6, "0");
			return buildAuraUrl("aura_fs", `k${padded}`);
		}
	}

	// 2. Soul : ws[a-z]{N} → aura_soul/a{padded6}
	if (assetCode.startsWith("ws")) {
		const num = assetCode.replace(/^ws[a-z]/, "").replace(/_\d+$/, "");
		if (num && /^\d+$/.test(num)) {
			const padded = num.padStart(6, "0");
			return buildAuraUrl("aura_soul", `a${padded}`);
		}
	}

	// 3. Armed : wa[a-z]{N} (mais pas wap*) — format c{8}_5000.
	//    Pas de mapping reliable du wa-code vers le c-code → on tente
	//    a000{N} dans aura_soul comme fallback (legacy code path).
	if (assetCode.startsWith("wa") && !assetCode.startsWith("wap")) {
		const num = assetCode.replace(/^wa[a-z]/, "").replace(/_\d+$/, "");
		if (num && /^\d+$/.test(num)) {
			const padded = num.padStart(6, "0");
			return buildAuraUrl("aura_soul", `a${padded}`);
		}
	}

	// 4. Fallback par subType pour les codes hors pattern
	const type = (subType || "").toLowerCase();
	if (type.includes("soul") || type.includes("totem")) {
		const num = assetCode.replace(/^ws[a-z]?/, "");
		if (num && /^\d+$/.test(num)) {
			const padded = num.padStart(6, "0");
			return buildAuraUrl("aura_soul", `a${padded}`);
		}
	}
	if (type.includes("keshin") || type.includes("esprit")) {
		const num = assetCode.replace(/^w[ka][a-z]?/, "");
		if (num && /^\d+$/.test(num)) {
			const padded = num.padStart(6, "0");
			return buildAuraUrl("aura_fs", `k${padded}`);
		}
	}

	// Pas de mapping : wap*, mode_change*, awakening*, wmm* → vide → fallback caller
	return "";
}

/**
 * Résout l'URL telop (grande image) d'une aura à partir de son asset_code.
 * Archive IECODE 2026-05 : pattern simple {code}.webp.
 *
 * Mapping :
 * - Keshins:  wks{N} -> k{N padded 6 digits}
 * - Souls:    wss{N} -> a{N padded 6 digits}
 * - Mode changes: mode_change_{X} -> tel quel
 * - Miximax wap: wap{N} -> aura_power_wap{N}
 */
export function resolveAuraTelopUrl(
	assetCode: string | undefined | null,
): string | null {
	if (!assetCode) return null;

	let bucketCode: string | null = null;

	if (assetCode.startsWith("wks")) {
		const num = assetCode.replace(/^wks/, "");
		bucketCode = `k${num.padStart(6, "0")}`;
	} else if (assetCode.startsWith("wss")) {
		const num = assetCode.replace(/^wss/, "");
		bucketCode = `a${num.padStart(6, "0")}`;
	} else if (assetCode.startsWith("wmm")) {
		// Miximax : strip wmm + suffix variant (`_h1`, `_b1`...).
		const numStr = assetCode.replace(/^wmm/, "").replace(/_.*$/, "");
		const num = parseInt(numStr, 10);
		if (!Number.isNaN(num)) {
			if (numStr.length > 5) {
				// Long code = direct character ID (ex: wmm11010230 → c11010230)
				bucketCode = `aura_mixi_c${numStr}`;
			} else {
				// Short code = c05028 prefix (ex: wmm00010 → c05028010)
				bucketCode = `aura_mixi_c05028${String(num).padStart(3, "0")}`;
			}
		}
	} else if (assetCode.startsWith("mode_change_")) {
		bucketCode = assetCode;
	} else if (assetCode.startsWith("wap")) {
		bucketCode = `aura_power_${assetCode}`;
	} else if (assetCode.includes("awakening")) {
		// Awakenings : pas de telop dédié dans le dump → placeholder générique
		// `aura_power01` (icône fallback du jeu pour la classe parent).
		bucketCode = "aura_power01";
	}

	if (!bucketCode) return null;

	// Dump PNG dx11 brut. Pattern : `220_img/telop_waza/fr/{code}_{code}.png`.
	return `${MENU_DUMP_BASE}/220_img/telop_waza/fr/${bucketCode}_${bucketCode}.png`;
}

/**
 * Image Optimization Helper
 * Uses Next.js optimization endpoint
 */
export function getOptimizedImageUrl(
	url: string | null | undefined,
	width = 640,
	quality = 80,
): string {
	if (!url) return "";
	if (url.startsWith("data:")) return url;

	// Use Next.js image optimization endpoint
	return `/_next/image?url=${encodeURIComponent(url)}&w=${width}&q=${quality}`;
}
