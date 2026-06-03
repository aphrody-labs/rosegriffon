/**
 * Utilitaires légers pour la génération d'URLs d'images de jeu.
 * Fonctionne côté client et serveur.
 */
import characterFaceManifest from "@/data/character-face-manifest.json";
import characterModelManifest from "@/data/character-model-manifest.json";
import itemImageManifest from "@/data/item-image-manifest.json";

const ITEM_IMAGE_MANIFEST = itemImageManifest as Record<string, string>;

/**
 * Set EXHAUSTIF des codes de base `c<NNNNNNNN>` qui possèdent réellement un visage
 * variant-1 dans le dump dx11, d'après `inagle_game_assets` (table-of-truth des URL
 * servies, 40471 lignes ; 5677 faces variant-1). Régénéré par
 * `scripts/build-character-face-manifest.ts`. Sert de gate à `getCharacterFaceUrl`
 * pour éviter les 404 silencieux → placeholder des persos sans face (azalee-3).
 */
const CHARACTER_FACE_CODES = new Set(characterFaceManifest as string[]);

/**
 * Set EXHAUSTIF des basenames `c<NNNNNNNN>` (et autres) qui possèdent un modèle 3D GLB
 * réellement servi sur `cdn.rosegriffon.fr/model/<base>.glb`. Généré par
 * `iecode cdn export-glb` (g4mg+g4md → GLB) puis listé depuis le dossier servi par nginx.
 * 5502 personnages ont un modèle (intersection avec les faces). Sert de gate à
 * `getCharacterModelGlbUrl` pour ne monter le viewer 3D que quand le GLB existe (sinon
 * fallback image) — même garde-fou anti-404 que CHARACTER_FACE_CODES.
 */
const CHARACTER_MODEL_CODES = new Set(characterModelManifest as string[]);

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

/**
 * Table famille `internal_code` → préfixe `icon_itemNN_` réel des PNG dans le dump
 * dx11 `200_icon/02_icon_item/`. Vérité terrain : le nom de fichier disque n'est PAS
 * `<internal_code>.png` mais `icon_item<NN>_<internal_code>.png`, où `<NN>` est
 * déterministe par famille (db-4, 2026-06-03 — scan exhaustif des 828 PNG).
 *
 * Ex. : `eq_ac0105001` → `icon_item05_eq_ac0105001.png`.
 *
 * Ordonné préfixe-le-plus-long-d'abord pour éviter les collisions (`eq_sh` avant `eq`,
 * `tk_*` avant `tr`). Les familles ABSENTES du dump (`ht`/`ti`/`ss_ps`/`ds`/`coi_*`/`nm`/
 * `fm`/`st`/`em` côté item) renvoient `null` → pas d'URL 404 forgée, le caller bascule
 * sur le placeholder. (`em` = emblème : son vrai fichier vit dans `01_icon_emblem`, pas
 * ici ; `ht`/`ss_ps` = tactiques/special_skill sans icône d'item dédiée.)
 */
const ITEM_ICON_PREFIXES: ReadonlyArray<readonly [string, string]> = [
	["performance_type_", "icon_item01"],
	["icon_item_nameplate", "icon_item90"],
	["eq_sh", "icon_item03"],
	["eq_mi", "icon_item04"],
	["eq_ac", "icon_item05"],
	["eq_sp", "icon_item08"],
	["uni_u", "icon_item07"],
	["cos_u", "icon_item09"],
	["btl_re", "icon_item02"],
	["test_tk", "icon_item10"],
	["tk_bb", "icon_item10"],
	["tk_hr", "icon_item10"],
	["tk_ki", "icon_item10"],
	["tk_si", "icon_item10"],
	["tk_st", "icon_item10"],
	["tk_tr", "icon_item10"],
	["tk_vi", "icon_item10"],
	["abl_", "icon_item01"],
	["abl", "icon_item01"],
	["ke", "icon_item02"],
	["gd", "icon_item01"],
	["ex", "icon_item01"],
	["tr", "icon_item10"],
];

/**
 * Résout le vrai nom de fichier PNG (sans extension) d'un `internal_code` d'item, ou
 * `null` si aucune famille connue ne correspond (= pas d'icône d'item dans le dump).
 */
export function itemIconFileBase(internalCode: string): string | null {
	for (const [fam, prefix] of ITEM_ICON_PREFIXES) {
		if (internalCode.startsWith(fam)) {
			return `${prefix}_${internalCode}`;
		}
	}
	return null;
}

function mapLegacyMenuPath(menuPath: string): string | null {
	const chrMatch = menuPath.match(/^200_icon\/10_icon_chr\/([^/]+)\/([^/]+?)_l(?:_[^.]+)?\.webp$/);
	if (chrMatch) {
		const folder = chrMatch[1];
		const base = chrMatch[2];
		if (folder.startsWith("aura_")) {
			// Même contrainte que getAuraImageUrl : le dump n'a que les icônes ×10.
			// On arrondit le numéro du base (`k000721` → `k000720`) à la famille
			// existante, sinon les formes évoluées (…721/…2025) renvoient un 404.
			const auraBase = base.replace(/^([ka])(\d+)$/, (_m, p, n) => `${p}${auraFamilyBase(n)}`);
			return `${MENU_DUMP_BASE}/icon_chr/${folder}/${auraBase}_l_${auraBase}_l00.png`;
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
		// Le DB stocke `image_url = 200_icon/02_icon_item/<internal_code>.webp`, mais le
		// fichier disque est `icon_item<NN>_<internal_code>.png` (db-4). On mappe via la
		// table des familles ; sans correspondance → null (placeholder, pas de 404 forgé).
		const fileBase = itemIconFileBase(itemMatch[1]);
		return fileBase ? `${MENU_DUMP_BASE}/200_icon/02_icon_item/${fileBase}.png` : null;
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

/**
 * Résout un path de dump déjà débarrassé de son préfixe (`200_icon/…webp`).
 * Pour une icône d'item d'une famille INCONNUE (pas de fichier `icon_item<NN>_…` sur
 * disque), on renvoie le placeholder au lieu de re-forger le `.webp` brut (qui serait un
 * 404 garanti — le dump ne sert que des PNG `icon_item<NN>_`). Sinon, fallback dump brut.
 */
function mapStrippedMenuPath(stripped: string): string {
	const mapped = mapLegacyMenuPath(stripped);
	if (mapped) {
		return mapped;
	}
	if (/^200_icon\/02_icon_item\/.+\.webp$/.test(stripped)) {
		return PLACEHOLDERS.item;
	}
	return `${MENU_BASE}/${stripped}`;
}

/** Resolve a potentially relative asset path to a full URL. */
export function resolveAssetUrl(path: string | null | undefined): string | null {
	if (!path) {
		return null;
	}
	if (path.startsWith(LEGACY_STORAGE_PREFIX)) {
		return mapStrippedMenuPath(path.slice(LEGACY_STORAGE_PREFIX.length));
	}
	// Forme legacy DB raccourcie `/menu/200_icon/…​.webp` (sans le préfixe storage
	// complet) : c'est un chemin de dump, pas une route locale. On retire `/menu/`
	// et on route vers le mapper dump comme les autres webp — sinon le `startsWith("/")`
	// ci-dessous le renverrait tel quel vers une route azalee inexistante (404).
	// Cas réel : 42 keshins sans `asset_code` pointant vers les emblèmes em0001-em0004.
	if (path.startsWith("/menu/")) {
		return mapStrippedMenuPath(path.slice("/menu/".length));
	}
	if (path.startsWith("http") || path.startsWith("/")) {
		return path;
	}
	return mapStrippedMenuPath(path);
}

/**
 * URL d'un visage de personnage depuis le dump dx11 brut.
 * Pattern fichier : `icon_chr/face/{base}_l_{base}_1_l00.png` (variant 1 par défaut).
 *
 * Gate sur `inagle_game_assets` (azalee-3) : si le code de base n'a pas de face
 * variant-1 dans la table-of-truth des assets servis (`CHARACTER_FACE_CODES`), on
 * renvoie directement `PLACEHOLDERS.character` au lieu de produire une URL qui
 * déclencherait un 404 silencieux résorbé par le `<Image onError>` côté client.
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
	if (!CHARACTER_FACE_CODES.has(baseCode)) {
		return PLACEHOLDERS.character;
	}
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
 * Allowlist EXHAUSTIVE des codes de techniques qui possèdent réellement un fichier
 * telop dans le dump dx11 `220_img/telop_waza/fr/{code}_{code}.png` (db-3, 2026-06-03).
 *
 * Cross-référence fichier-par-fichier du dump complet (310 PNG telop) contre les 1002
 * `internal_code` de `inagle_skills` : seuls **16** codes ont un telop. Les fichiers
 * `wht*` du dump (67) sont un autre jeu (titres romanisés, hors `internal_code`) → exclus.
 * Les 986 autres skills (la majorité des `whs*`/`whd*`, tous les `rh[dkos]*` et
 * `swap_skill_waza_*`) n'ont AUCUN telop → l'URL `{code}_{code}.png` serait un 404 garanti.
 *
 * Donc : gate POSITIF (allowlist) — tout code hors liste renvoie le placeholder, jamais
 * une URL 404. Aligné sur `inagle_skills.has_telop` (16 true / 986 false / 1002 total)
 * et `image_url` (NULL = sans telop). Cf. docs/asset-audit/azalee-tables-gaps.md §7.
 */
const SKILLS_WITH_TELOP = new Set([
	"whk00050",
	"whk00080",
	"whk00090",
	"whk00100",
	"whk00110",
	"who00010",
	"who00020",
	"who00030",
	"who00040",
	"who00060",
	"who00070",
	"who00080",
	"who00090",
	"who00100",
	"who00110",
	"who00190",
]);

/**
 * URL d'une technique (image telop) — dump dx11 brut.
 * Pattern fichier : `220_img/telop_waza/fr/{code}_{code}.png`.
 * Renvoie le placeholder pour tout code sans telop dans le dump (db-3) afin que
 * l'UI affiche un visuel propre au lieu d'un 404.
 */
export function getSkillImageUrl(
	skillId: string | undefined | null,
	_unused?: string | null
): string {
	if (!skillId) {
		return "";
	}
	// Normalisation : retire le suffixe variant `_<lettres>` (ex. `who00060_or` → `who00060`).
	const baseCode = skillId.replace(/_[a-z]+$/i, "");
	if (!SKILLS_WITH_TELOP.has(baseCode)) {
		return PLACEHOLDERS.skill;
	}
	return `${MENU_DUMP_BASE}/220_img/telop_waza/fr/${baseCode}_${baseCode}.png`;
}

/**
 * URL d'un objet — dump dx11 brut.
 *
 * Le nom de fichier disque est `icon_item<NN>_<internal_code>.png` (db-4), résolu via
 * `itemIconFileBase`. On attend donc un `internal_code` (`eq_ac0105001`, `ke000033`…),
 * pas un id hex (`0x002B6B38`) : un id hex ne matche aucune famille → placeholder, ce
 * qui est le comportement voulu côté fallback (l'icône réelle vient de `image_url` via
 * `resolveAssetUrl`). Un mapping explicite optionnel via `item-image-manifest.json`
 * reste prioritaire.
 */
export function getItemImageUrl(itemId: string): string {
	if (!itemId) {
		return "";
	}
	const mapped = ITEM_IMAGE_MANIFEST[itemId];
	if (mapped) {
		return `${MENU_DUMP_BASE}/${mapped}.png`;
	}
	const fileBase = itemIconFileBase(itemId);
	if (fileBase) {
		return `${MENU_DUMP_BASE}/200_icon/02_icon_item/${fileBase}.png`;
	}
	return PLACEHOLDERS.item;
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
 * Le miroir `zukan-assets-mirror` (modèles 3D 360° + vidéos de techniques) n'existe
 * NULLE PART en prod (azalee-1) : `{CDN_URL}/zukan-assets-mirror/...` renvoie 404, et
 * la source amont `zukan.inazuma.jp/3d/...` est elle aussi morte (404 vérifié 2026-06).
 * Tant que ce flag reste `false`, les résolveurs 3D/vidéo renvoient une chaîne vide /
 * un placeholder au lieu d'une URL 404, et le bouton 360° n'est pas monté dans l'UI
 * (cf. CharacterTable). Repasser à `true` uniquement quand un vrai miroir est en place.
 */
export const ZUKAN_3D_MIRROR_AVAILABLE = false;

/**
 * URL pour les vidéos de techniques.
 * Gaté sur `ZUKAN_3D_MIRROR_AVAILABLE` (azalee-1) : renvoie une chaîne vide tant que le
 * miroir est absent, ce qui évite un `<video src>` en 404.
 */
export function getSkillVideoUrl(skillId: string | undefined | null): string {
	if (!skillId || !ZUKAN_3D_MIRROR_AVAILABLE) {
		return "";
	}
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

/**
 * Le dump dx11 ne contient que les icônes d'aura « famille » : tous les fichiers
 * de `aura_fs/`/`aura_soul/` portent un numéro **multiple de 10** (vérifié dump :
 * 98 + 56 fichiers, 0 numéro non-×10). Les formes évoluées / éveillées / armées
 * (…721, …651, …672, …2025) n'ont PAS d'icône propre : l'icône réutilisée est
 * celle de la famille. On arrondit donc le numéro à la dizaine inférieure, ce qui
 * garantit un fichier existant (sinon 404 garanti — c'était le cas de 25 keshins
 * de la plage 700-725/2025 dont l'`image_url` DB `.webp` est elle aussi morte).
 */
function auraFamilyBase(num: string): string {
	const n = Number.parseInt(num, 10);
	const family = Number.isFinite(n) ? Math.floor(n / 10) * 10 : 0;
	return String(family).padStart(6, "0");
}

export function getAuraImageUrl(assetCode: string | undefined | null, _subType?: string): string {
	if (!assetCode) {
		return "";
	}

	const buildAuraUrl = (folder: string, base: string): string =>
		`${AURA_DUMP_BASE}/${folder}/${base}_l_${base}_l00.png`;

	// Keshins : tous les `wk*` (wks/wkk/wkd/wko/wkt) + les variantes Keshin-armé
	// `wak/wao/wad` vivent dans `aura_fs/k{N}` (vérifié sur dump + image_url DB :
	// 70 lignes wak/wao/wad → 0 aura_soul). Seuls les Souls/Soul-armé `ws*`/`was*`
	// vivent dans `aura_soul/a{N}`. L'ancien code routait TOUT `wa*` (sauf wap) vers
	// aura_soul → 404 garanti pour wak/wao/wad (db-1, corrigé 2026-06).
	if (assetCode.startsWith("wk") || /^wa[kod]/.test(assetCode)) {
		const num = auraBaseNum(assetCode, /^w[ka][a-z]/);
		if (num) {
			return buildAuraUrl("aura_fs", `k${auraFamilyBase(num)}`);
		}
	}
	// Souls `ws*` (wss/wso/wsd/wsk) → aura_soul/a{N} (cohérent sur tout le dump).
	// MAIS les Soul-armé `was*` (Warrior Armed Spirit, 66 keshins) sont répartis sans
	// règle dérivable entre aura_fs/k{N} (12 codes) et aura_soul/a{N} (18 codes) : on
	// NE dérive donc PAS `was*` ici — on renvoie "" pour laisser `image_url` (DB,
	// chemin vérifié HTTP 200 par le backfill) faire foi. L'ancienne dérivation
	// `was*` → aura_soul produisait un 404 pour ~40% des formes armées (db-1).
	if (assetCode.startsWith("ws")) {
		const num = auraBaseNum(assetCode, /^ws[a-z]/);
		if (num) {
			return buildAuraUrl("aura_soul", `a${auraFamilyBase(num)}`);
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
 * URL pour les modèles 3D (360°).
 * Gaté sur `ZUKAN_3D_MIRROR_AVAILABLE` (azalee-1) : tant que le miroir est absent,
 * renvoie le placeholder `PLACEHOLDERS.character` au lieu d'une URL 404. Le bouton 360°
 * étant lui aussi gaté côté UI, ce résolveur n'est plus appelé pour produire une frame
 * en prod, mais le garde-fou évite tout 404 si quelqu'un l'invoque directement.
 */
export function getCharacterModel360Url(
	hash: string,
	frame: number,
	full: boolean = false
): string {
	if (!ZUKAN_3D_MIRROR_AVAILABLE) {
		return PLACEHOLDERS.character;
	}
	// Format Zukan: https://zukan.inazuma.jp/3d/{hash}/{type}/{frame}.webp
	// Notre miroir: /zukan-assets-mirror/3d/{hash}/{type}/{frame}.webp
	// Frame est souvent 0-7 ou 0-15
	const type = full ? "full" : "face";
	return `${CDN_URL}/zukan-assets-mirror/3d/${hash}/${type}/${frame}.webp`;
}

/**
 * Base nginx des modèles 3D GLB (alias → /home/.../inazuma/data/dx11/model/).
 * Servis par `iecode cdn export-glb` (g4mg+g4md → glTF binary) ; content-type
 * `model/gltf-binary`, cache immutable 1 an.
 */
const MODEL_GLB_BASE = "https://cdn.rosegriffon.fr/model";

/**
 * Résout l'URL du modèle 3D GLB d'un personnage à partir de son code interne
 * (`internalCode`/`charaParamId`, ex `c01000010`). Le basename du GLB = basename du
 * .g4mg `_face` du dump = ce code. Gate sur `CHARACTER_MODEL_CODES` (manifeste des GLB
 * réellement exportés) : renvoie `null` si aucun modèle n'existe → le caller garde le
 * fallback image et ne monte pas le viewer 3D (évite tout 404).
 */
export function getCharacterModelGlbUrl(code: string | undefined | null): string | null {
	if (!code) {
		return null;
	}
	// Strip suffixe de variante éventuel (_5000/_5100…) — le dump n'a que le code de base.
	const base = code.replace(/_\d{4}$/, "");
	if (!CHARACTER_MODEL_CODES.has(base)) {
		return null;
	}
	return `${MODEL_GLB_BASE}/${base}.glb`;
}

/** Indique si un personnage possède un modèle 3D GLB servi (gate viewer). */
export function hasCharacterModelGlb(code: string | undefined | null): boolean {
	return getCharacterModelGlbUrl(code) !== null;
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
