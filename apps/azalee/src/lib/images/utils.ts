/**
 * Utilitaires légers pour la génération d'URLs d'images de jeu.
 * Fonctionne côté client et serveur.
 */
import characterFaceManifest from "@/data/character-face-manifest.json";
import characterModelManifest from "@/data/character-model-manifest.json";
import itemImageManifest from "@/data/item-image-manifest.json";
import miximaxIconManifest from "@/data/miximax-icon-manifest.json";

const ITEM_IMAGE_MANIFEST = itemImageManifest as Record<string, string>;

/**
 * Correspondance code Miximax (`icon_code` `c05028XXX` ou `asset_code` base `wmm00XXX`)
 * → code d'icône RÉEL du dump dx11 (`ca/cn/cp/iau`). Généré par
 * `scripts/build-miximax-icon-manifest.ts` (cf. ce fichier pour la dérivation
 * `config.skillId2` → `inagle_chara_menu_resource` → fichier disque).
 *
 * `inagle_miximax.icon_code` vaut `c05028XXX` (dérivé du code perso) mais AUCUN fichier
 * `c05028XXX_l_..._l00.png` n'existe : les 17 vrais fichiers portent des codes
 * hétérogènes non dérivables par règle. Seules les entrées présentes ici ont un fichier
 * sur disque — un code absent → placeholder (le caller bascule sur telop/image_url), pas
 * un 404 forgé.
 */
const MIXIMAX_ICON_MANIFEST = miximaxIconManifest as Record<string, string>;

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

/**
 * Set EXHAUSTIF des codes uniforme `u<NNNNNNNN>` (8 chiffres) qui possèdent réellement
 * un fichier d'icône dans le dump dx11 `menu/icon_chr/uniform/`. Vérité terrain : scan
 * des 24966 PNG du dossier (db-5, 2026-06-04). Sur 5677 personnages, seuls **303**
 * uniformes existent en forme `u<8>_l_u<8>_{1,2}.png` (front+back).
 *
 * Le code uniforme dérive du code perso par swap de préfixe `c<NNNNNNNN>` → `u<NNNNNNNN>`
 * (vérifié : 295/303 des `u<8>` ont un perso `c<8>` correspondant). MAIS la dérivation
 * `c→u` ne suffit PAS comme garde-fou : ~5380 persos n'ont AUCUN fichier uniforme et le
 * swap produisait une URL `u<8>_l_u<8>_1.png` en 404 garanti (mesuré 0/10 avant gate).
 *
 * Donc : gate POSITIF (allowlist) — tout perso dont le `u<8>` n'est pas listé renvoie une
 * chaîne vide (le caller affiche le portrait/placeholder au lieu d'un 404 silencieux).
 * Aligné sur le même garde-fou que `CHARACTER_FACE_CODES` / `CHARACTER_MODEL_CODES`.
 */
const CHARACTER_UNIFORM_CODES = new Set<string>([
	"u01000310", "u01002610", "u02024500", "u02024700", "u02024720", "u02024730", "u02024740", "u02024750",
	"u02029500", "u03030080", "u03039500", "u04000100", "u04000360", "u04000370", "u04000380", "u05020110",
	"u05020120", "u05020270", "u05020280", "u05020290", "u05020320", "u05020321", "u05020330", "u05020340",
	"u05020350", "u05020380", "u05020390", "u05024610", "u05024620", "u05024670", "u05024671", "u05026520",
	"u05026530", "u05026550", "u05026570", "u05026580", "u05026590", "u05026710", "u05026730", "u05026740",
	"u05026750", "u05026760", "u05029510", "u05029520", "u05029710", "u05029720", "u06030210", "u06030220",
	"u06030221", "u06030230", "u06030240", "u06031520", "u06031720", "u06031920", "u06037390", "u06037410",
	"u06037420", "u06037430", "u06039010", "u06039011", "u06039020", "u06039030", "u06039050", "u06039060",
	"u06039090", "u06039100", "u06039110", "u06039130", "u06039140", "u06039150", "u06039180", "u06039190",
	"u06039200", "u06039210", "u06039220", "u06039230", "u06039290", "u06039291", "u06039300", "u06039320",
	"u07160500", "u08060090", "u11010010", "u11010011", "u11010020", "u11010030", "u11010040", "u11010050",
	"u11010051", "u11010060", "u11010070", "u11010072", "u11010090", "u11010100", "u11010110", "u11010120",
	"u11010170", "u11010190", "u11010510", "u11020010", "u11020020", "u11020500", "u11020510", "u11020520",
	"u11030010", "u11030011", "u11030020", "u11030021", "u11030030", "u11030040", "u11030140", "u11030150",
	"u11030500", "u11030510", "u11040010", "u11040020", "u11040040", "u11040050", "u11040060", "u11040070",
	"u11040090", "u11050500", "u11050510", "u11060500", "u11060510", "u11070500", "u11070510", "u11080500",
	"u11090500", "u11090510", "u11100500", "u11100510", "u11110500", "u11110510", "u11120040", "u11120510",
	"u11130010", "u11130060", "u11130090", "u11130110", "u11130510", "u11140500", "u11140510", "u11140520",
	"u11140530", "u11150500", "u11150510", "u11160500", "u11170500", "u11180500", "u11180510", "u11190500",
	"u11200500", "u11210510", "u11220500", "u11220510", "u11230010", "u11500010", "u11500011", "u11500040",
	"u11500050", "u11500060", "u11500061", "u11500070", "u11500080", "u11500090", "u11500110", "u11500120",
	"u11500130", "u11500140", "u11500150", "u11500170", "u11500180", "u11500190", "u11500200", "u11500210",
	"u11500240", "u11500500", "u11500501", "u11500510", "u11500520", "u11500530", "u11500540", "u11500680",
	"u11500690", "u11500860", "u11500870", "u11500890", "u11600010", "u11600020", "u11600021", "u11600030",
	"u11600050", "u11600060", "u11600110", "u11600120", "u11700150", "u11801010", "u11801020", "u11801030",
	"u11801040", "u11801060", "u11801070", "u11801080", "u11801090", "u11801100", "u11801110", "u11801120",
	"u11801130", "u11802010", "u11802020", "u11802030", "u11802040", "u11802050", "u11802060", "u11802070",
	"u11803010", "u11803020", "u11803030", "u11803040", "u11803050", "u11803060", "u11803070", "u11803080",
	"u11803090", "u11804010", "u11804020", "u11804030", "u11804040", "u11804050", "u11804060", "u11804070",
	"u11804080", "u11805010", "u11806010", "u11806020", "u11806030", "u11806040", "u11806050", "u11806060",
	"u11806070", "u11806080", "u11806090", "u11807010", "u11807030", "u11807040", "u11807050", "u11807060",
	"u11807070", "u11807080", "u11807090", "u11807100", "u11807110", "u11807120", "u11807130", "u11807140",
	"u11807150", "u11807160", "u11807170", "u11807180", "u11807190", "u11807200", "u11807210", "u11807220",
	"u11807240", "u11807260", "u11808010", "u11808020", "u11808030", "u11808040", "u11808050", "u11808060",
	"u11808070", "u11808080", "u11808090", "u11808100", "u11808110", "u11808120", "u11808130", "u11808140",
	"u11808150", "u11808160", "u11808170", "u11901080", "u11901090", "u11902060", "u11902070", "u11902080",
	"u11903020", "u11903040", "u11904030", "u11905030", "u11907050", "u11907060", "u11907070", "u11907080",
	"u11908020", "u11908030", "u11908040", "u11908050", "u11908060", "u11908120", "u11908130",
]);

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
 * Trous de données (data-gaps) PROUVÉS de la famille chaussures `eq_sh` : `internal_code`
 * présents en DB (`inagle_items`) dont AUCUN fichier `icon_item03_<code>.png` n'existe
 * dans le dump dx11 (db-5, 2026-06-04 — scan des 203 PNG `eq_sh` du dossier
 * `200_icon/02_icon_item/`). Toutes les variantes voisines de la série `eq_sh11<NNN>01`
 * existent ; seules ces 24 variantes-là n'ont pas été extraites (vérifié : 0 fichier sous
 * AUCUNE forme, pas de transform récupérable).
 *
 * Le préfixe `eq_sh` matche `icon_item03` (cf. `ITEM_ICON_PREFIXES`) et le nom de fichier
 * = `icon_item03_<internal_code>.png` (la règle de suffixe est DÉJÀ correcte : le code DB
 * porte le `01` final, le fichier aussi). Donc il ne s'agit pas d'un mapping à corriger
 * mais d'un gap : on renvoie `null` (→ placeholder propre) au lieu d'un 404 forgé.
 */
const ITEM_ICON_GAPS = new Set<string>([
	"eq_sh1100101", "eq_sh1100201", "eq_sh1100501", "eq_sh1100601", "eq_sh1101001", "eq_sh1101101",
	"eq_sh1101501", "eq_sh1101601", "eq_sh1101701", "eq_sh1102201", "eq_sh1102301", "eq_sh1102801",
	"eq_sh1103001", "eq_sh1103701", "eq_sh1104101", "eq_sh1104401", "eq_sh1104501", "eq_sh1104701",
	"eq_sh1104801", "eq_sh1105201", "eq_sh1105301", "eq_sh1106301", "eq_sh1106601", "eq_sh1106701",
]);

/**
 * Items « important » `gd120<NNN>` : sur les 89 codes en DB (`inagle_items`), seul
 * `gd120001` possède une icône réelle dans le CPK (vérité terrain : scan via le décodeur
 * live `iecode-cdn:8788` lisant directement le CPK, 2026-06-05 — 1 existe / 90 absents).
 * Les `gd120002..091` n'ont AUCUN fichier (ni dump pré-extrait, ni CPK → le fallback live
 * Stream ne les couvre pas) : forger `icon_item01_gd120<NNN>.png` = 404 garanti.
 *
 * `gd120001` n'est PAS une icône générique (carte stade « Legend » spécifique), on ne peut
 * donc PAS la réutiliser pour les autres important. Gate : tout `gd120*` ≠ `gd120001`
 * renvoie `null` → le caller bascule sur le placeholder propre (`/ievr.webp`) au lieu d'un
 * 404 silencieux. Aligné sur le même garde-fou que `ITEM_ICON_GAPS` / `eq_sh`.
 */
function isMissingImportantIcon(internalCode: string): boolean {
	return internalCode.startsWith("gd120") && internalCode !== "gd120001";
}

/**
 * Résout le vrai nom de fichier PNG (sans extension) d'un `internal_code` d'item, ou
 * `null` si aucune famille connue ne correspond (= pas d'icône d'item dans le dump) OU si
 * le code est un data-gap connu (`ITEM_ICON_GAPS` / important `gd120*` sans icône — fichier
 * absent du CPK → 404 forgé).
 */
export function itemIconFileBase(internalCode: string): string | null {
	if (ITEM_ICON_GAPS.has(internalCode) || isMissingImportantIcon(internalCode)) {
		return null;
	}
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
 * URL d'une illustration de galerie (`inagle_gallery.img_path`) depuis le dump dx11.
 *
 * Vérité terrain (`inagle_game_assets`, db-2026-06-05) : les 360 illustrations vivent
 * dans `menu/220_img/gallery_img2/` et le nom de fichier réel double le `img_path`
 * (pattern `<imgPath>_<imgPath>.png`, ex. `img_story_ev01_main_0010_img_story_ev01_main_0010.png`).
 * Couverture vérifiée 360/360 (HTTP 200 sur le CDN `cdn.rosegriffon.fr/dx11/menu/`).
 *
 * Renvoie `null` pour un `img_path` vide → le caller bascule sur le placeholder.
 */
export function getGalleryImageUrl(imgPath: string | undefined | null): string | null {
	if (!imgPath) {
		return null;
	}
	return `${MENU_DUMP_BASE}/220_img/gallery_img2/${imgPath}_${imgPath}.png`;
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
 * Dérive le code uniforme `u<8>` d'un code perso et le retourne UNIQUEMENT s'il a un
 * fichier réel dans le dump (`CHARACTER_UNIFORM_CODES`). Sinon `null` → le caller ne
 * tente pas d'URL (évite un 404 garanti : la dérivation `c→u` ne matche que 303/5677
 * persos). Le code uniforme = code perso préfixe `c` → `u` (vérité terrain db-5).
 */
function resolveUniformCode(charaId: string | undefined | null): string | null {
	if (!charaId) {
		return null;
	}
	// Strip suffixe de variante (_5000/_5100…) — le dump n'a que le code de base.
	const baseCode = charaId.replace(/_\d{4}$/, "");
	const uniformCode = baseCode.startsWith("c") ? `u${baseCode.slice(1)}` : baseCode;
	return CHARACTER_UNIFORM_CODES.has(uniformCode) ? uniformCode : null;
}

/**
 * URL d'un uniforme de personnage (vue de face).
 * Pattern fichier : `icon_chr/uniform/u{NNNNNNNN}_l_u{NNNNNNNN}_1.png` (préfixe `c` → `u`).
 * Gate sur `CHARACTER_UNIFORM_CODES` : chaîne vide si le perso n'a pas d'uniforme dans le
 * dump (au lieu d'un 404 forgé). Le caller affiche le portrait/placeholder à la place.
 */
export function getCharacterUniformUrl(charaId: string | undefined | null): string {
	const uniformCode = resolveUniformCode(charaId);
	if (!uniformCode) {
		return "";
	}
	return `${CHR_DUMP_BASE}/uniform/${uniformCode}_l_${uniformCode}_1.png`;
}

/**
 * URL du dos de l'uniforme (variant 2). Même gate que la vue de face.
 */
export function getCharacterUniformBackUrl(charaId: string | undefined | null): string {
	const uniformCode = resolveUniformCode(charaId);
	if (!uniformCode) {
		return "";
	}
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
 * URL d'une icône Miximax (visage personnage) depuis le dossier `aura_mixi` du dump dx11.
 * Pattern fichier : `{realIcon}_l_{realIcon}_l00.png`.
 *
 * L'argument est l'`icon_code` (`c05028XXX`) OU l'`asset_code` (`wmm00XXX[_variant]`) de
 * `inagle_miximax`. Aucun de ces deux codes n'est le nom de fichier réel : les 17 vrais
 * fichiers du dump portent des codes hétérogènes (`ca0201`, `cn0221`, `cp1811`,
 * `iau0010a`…) NON dérivables par règle. On traduit donc via `MIXIMAX_ICON_MANIFEST`
 * (issu de `config.skillId2` → `inagle_chara_menu_resource`). Un code absent du manifeste
 * = pas de fichier sur disque → chaîne vide (le caller bascule sur telop/image_url ou le
 * placeholder), jamais un 404 forgé. Corrige le bug `c05028XXX_l_..._l00.png` (404 garanti).
 */
export function getMiximaxIconUrl(iconCode: string | undefined | null): string {
	if (!iconCode) {
		return "";
	}
	// Normalise l'asset_code en retirant un éventuel suffixe de variante (`_h1`/`_b1`…).
	const key = iconCode.replace(/_[a-z0-9]+$/i, "");
	const realIcon = MIXIMAX_ICON_MANIFEST[iconCode] ?? MIXIMAX_ICON_MANIFEST[key];
	if (!realIcon) {
		return "";
	}
	return `${AURA_DUMP_BASE}/aura_mixi/${realIcon}_l_${realIcon}_l00.png`;
}

/**
 * Détecte un `image_url` DB de miximax issu de l'ANCIEN mapping naïf
 * `wmm00<NNN>` → `aura_mixi_c05028<NNN>.webp` (ou `aura_mixi_c<charId>.webp`). Ce path
 * pointe vers le telop d'un PERSONNAGE LÉGENDAIRE d'un autre set (c05028100 = Ryoma
 * Nishiki…), PAS vers le miximax `wmm` réel → bannière du mauvais perso. Ces lignes
 * restent en DB tant que le miroir n'a pas été repushé : on les rejette ici (au profit
 * de l'icône manifeste correcte) plutôt que d'afficher un faux nom. Cf. bug Arthur.
 */
function isStaleMiximaxTelopUrl(imageUrl: string | undefined | null): boolean {
	if (!imageUrl) {
		return false;
	}
	return /(?:^|\/)220_img\/telop_waza\/[a-z]+\/aura_mixi_c\d/.test(imageUrl);
}

/**
 * Résout l'icône d'un miximax à partir de son `icon_code`/`asset_code` (via le manifeste
 * des vrais fichiers `aura_mixi` du dump) en IGNORANT tout `image_url` DB issu de l'ancien
 * mapping naïf telop (`aura_mixi_c05028*` = bannière d'un autre perso). Retourne le
 * placeholder si aucun fichier réel n'existe — jamais le bandeau d'un perso étranger.
 *
 * Ordre : manifeste (icon_code puis asset_code) → image_url DB SI ce n'est PAS un telop
 * miximax périmé → placeholder. Sépare clairement l'ICÔNE (carrée, juste) du TELOP
 * (bandeau, supprimé pour les wmm car aucun n'est valide).
 */
export function getMiximaxImageUrl(
	iconCode: string | undefined | null,
	assetCode: string | undefined | null,
	dbImageUrl: string | undefined | null
): string {
	const fromIcon = getMiximaxIconUrl(iconCode);
	if (fromIcon) {
		return fromIcon;
	}
	const fromAsset = getMiximaxIconUrl(assetCode);
	if (fromAsset) {
		return fromAsset;
	}
	// L'image_url DB n'est utilisable QUE si ce n'est pas un telop miximax périmé.
	if (dbImageUrl && !isStaleMiximaxTelopUrl(dbImageUrl)) {
		const resolved = resolveAssetUrl(dbImageUrl);
		if (resolved) {
			return resolved;
		}
	}
	return PLACEHOLDERS.character;
}

/**
 * Résout l'URL telop (grande image) d'une aura à partir de son asset_code.
 * Les fichiers du bucket utilisent le pattern {code}_{code}.webp avec des préfixes
 * différents de ceux stockés en DB.
 *
 * Mapping :
 * - Keshins (wks/wkk/wkd/wko/wkt):  wk*{N} -> k{N padded 6 digits} (telop k{N} == numéro keshin)
 * - Souls (wss/wso/wsd/wsk):         ws*{N} -> a{N padded 6 digits} (telop a{N} == numéro soul)
 * - Armed (was/wak/wad/wao):         wa*{N} -> a{N padded 6 digits}
 * - Mode changes: mode_change_{X} -> tel quel
 * - Aura wap: wap{N} -> aura_power_wap{N} (telop == asset_code propre)
 *
 * Miximax `wmm` : AUCUN telop (retourne null). L'ancien code dérivait `wmm00<NNN>` →
 * `aura_mixi_c05028<NNN>` (ou `aura_mixi_c<charId>` pour les codes longs). Or
 * `c05028<NNN>` est l'internal_code d'un PERSONNAGE LÉGENDAIRE d'un AUTRE set
 * (c05028100 = Ryoma Nishiki…), et les telops `aura_mixi_*` du dump forment un set
 * FERMÉ tied à ces persos — ils ne correspondent PAS aux miximax `wmm` de Victory Road.
 * Conséquence : Arthur (wmm00100) affichait le bandeau de Ryoma (faux). Il n'existe
 * PAS de telop_waza valide pour un miximax `wmm` → on ne dérive plus rien (null) ;
 * l'icône miximax correcte vient du manifeste (`getMiximaxIconUrl`).
 */
export function resolveAuraTelopUrl(assetCode: string | undefined | null): string | null {
	if (!assetCode) {
		return null;
	}

	let bucketCode: string | null = null;

	if (assetCode.startsWith("wmm")) {
		// Miximax : pas de telop fiable (cf. note) — jamais de bandeau d'un autre perso.
		return null;
	}
	if (assetCode.startsWith("wk")) {
		// All Keshins: wks/wkk/wkd/wko/wkt -> k{N padded 6}
		// Strip variant suffix (_b1/_h2/_st0701/_1…) → base only (cf. auraBaseNum).
		const num = auraBaseNum(assetCode, /^wk[a-z]/);
		bucketCode = num ? `k${num.padStart(6, "0")}` : null;
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
