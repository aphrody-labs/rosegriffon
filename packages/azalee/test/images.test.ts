import { describe, expect, test } from "bun:test";

import {
	extractKeshinModelCode,
	GALLERY_VARIANT_WIDTHS,
	galleryVariantUrl,
	getArmureModelGlbUrl,
	getAuraImageUrl,
	getCharacterFaceUrl,
	getCharacterImageUrl,
	getCharacterModelFullGlbUrl,
	getCharacterModelGlbUrl,
	getEmblemImageUrl,
	getGalleryImageUrl,
	getGenderIconUrl,
	getItemImageUrl,
	getKeshinModelGlbUrl,
	getMiximaxIconUrl,
	getOptimizedImageUrl,
	getRarityIconUrl,
	getSkillCategoryIconUrl,
	getSkillElementIconUrl,
	hasCharacterModelGlb,
	itemIconFileBase,
	listServedArmureCodes,
	listServedKeshinCodes,
	PLACEHOLDERS,
	resolveAssetUrl,
} from "../src/images/utils";

const CDN = "https://cdn.rosegriffon.fr/dx11/menu/icon_chr";
const ITEM_CDN = "https://cdn.rosegriffon.fr/dx11/menu/200_icon/02_icon_item";

describe("getAuraImageUrl — routage dossier + base famille", () => {
	test("keshins wk* → aura_fs/k{N}", () => {
		expect(getAuraImageUrl("wks00020")).toBe(`${CDN}/aura_fs/k000020_l_k000020_l00.png`);
		expect(getAuraImageUrl("wkk00110")).toBe(`${CDN}/aura_fs/k000110_l_k000110_l00.png`);
		expect(getAuraImageUrl("wkt00010")).toBe(`${CDN}/aura_fs/k000010_l_k000010_l00.png`);
	});

	test("keshin-armé wak/wao/wad → aura_fs/k{N} (PAS aura_soul)", () => {
		expect(getAuraImageUrl("wak00110")).toBe(`${CDN}/aura_fs/k000110_l_k000110_l00.png`);
		expect(getAuraImageUrl("wao00010")).toBe(`${CDN}/aura_fs/k000010_l_k000010_l00.png`);
		expect(getAuraImageUrl("wad00060")).toBe(`${CDN}/aura_fs/k000060_l_k000060_l00.png`);
	});

	test("souls ws* → aura_soul/a{N}", () => {
		expect(getAuraImageUrl("wss00010")).toBe(`${CDN}/aura_soul/a000010_l_a000010_l00.png`);
		expect(getAuraImageUrl("wsk00010")).toBe(`${CDN}/aura_soul/a000010_l_a000010_l00.png`);
	});

	test("formes évoluées (…721/…651/…2025) → arrondi à la famille ×10 existante", () => {
		// Le dump dx11 ne contient que les icônes ×10 ; les formes éveillées
		// retombent sur l'icône de famille au lieu d'un 404.
		expect(getAuraImageUrl("wak00721")).toBe(`${CDN}/aura_fs/k000720_l_k000720_l00.png`);
		expect(getAuraImageUrl("wad00651")).toBe(`${CDN}/aura_fs/k000650_l_k000650_l00.png`);
		expect(getAuraImageUrl("wad00672")).toBe(`${CDN}/aura_fs/k000670_l_k000670_l00.png`);
		expect(getAuraImageUrl("wko02025")).toBe(`${CDN}/aura_fs/k002020_l_k002020_l00.png`);
	});

	test("suffixe de variante (_st0701, _1, _b1) ignoré, base conservée", () => {
		expect(getAuraImageUrl("wks02060_st0901")).toBe(`${CDN}/aura_fs/k002060_l_k002060_l00.png`);
		expect(getAuraImageUrl("wad00720_1")).toBe(`${CDN}/aura_fs/k000720_l_k000720_l00.png`);
	});

	test("was* non dérivable côté code → \"\" (déféré à image_url DB)", () => {
		expect(getAuraImageUrl("was00020")).toBe("");
		expect(getAuraImageUrl("was00610")).toBe("");
	});

	test("entrée vide → \"\"", () => {
		expect(getAuraImageUrl(null)).toBe("");
		expect(getAuraImageUrl(undefined)).toBe("");
		expect(getAuraImageUrl("")).toBe("");
	});
});

describe("resolveAssetUrl — mapping image_url legacy webp → dump PNG", () => {
	test("aura webp → PNG dump (base conservée)", () => {
		expect(resolveAssetUrl("200_icon/10_icon_chr/aura_fs/k000020_l_00020_l00.webp")).toBe(
			`${CDN}/aura_fs/k000020_l_k000020_l00.png`
		);
		expect(resolveAssetUrl("200_icon/10_icon_chr/aura_soul/a000240_l_00240_l00.webp")).toBe(
			`${CDN}/aura_soul/a000240_l_a000240_l00.png`
		);
	});

	test("aura webp d'une forme évoluée → arrondi famille ×10", () => {
		expect(resolveAssetUrl("200_icon/10_icon_chr/aura_fs/k000721_l_00721_l00.webp")).toBe(
			`${CDN}/aura_fs/k000720_l_k000720_l00.png`
		);
		expect(resolveAssetUrl("200_icon/10_icon_chr/aura_fs/k002025_l_02025_l00.webp")).toBe(
			`${CDN}/aura_fs/k002020_l_k002020_l00.png`
		);
	});


	test("forme legacy /menu/…webp (emblèmes em*) → PNG dump", () => {
		expect(resolveAssetUrl("/menu/200_icon/01_icon_emblem/em0001.webp")).toBe(
			`${CDN.replace("/icon_chr", "")}/200_icon/01_icon_emblem/em0001_em0001.png`
		);
	});

	test("URL absolue ou racine inchangée", () => {
		expect(resolveAssetUrl("https://example.com/x.png")).toBe("https://example.com/x.png");
		expect(resolveAssetUrl("/local.png")).toBe("/local.png");
		expect(resolveAssetUrl(null)).toBeNull();
	});
});

describe("getMiximaxIconUrl — icon_code/asset_code → code icône réel (ca/cn/cp/iau)", () => {
	const MIXI = `${CDN}/aura_mixi`;

	test("icon_code c05028XXX → vrai code via manifeste (pas c05028XXX_l_…)", () => {
		expect(getMiximaxIconUrl("c05028010")).toBe(`${MIXI}/ca0201_l_ca0201_l00.png`);
		expect(getMiximaxIconUrl("c05028110")).toBe(`${MIXI}/cn0231_l_cn0231_l00.png`);
		expect(getMiximaxIconUrl("c05028130")).toBe(`${MIXI}/cp1811_l_cp1811_l00.png`);
		expect(getMiximaxIconUrl("c05028120")).toBe(`${MIXI}/iau0010a_l_iau0010a_l00.png`);
	});

	test("asset_code wmm00XXX (et variante _h1/_b1) → même vrai code", () => {
		expect(getMiximaxIconUrl("wmm00010")).toBe(`${MIXI}/ca0201_l_ca0201_l00.png`);
		expect(getMiximaxIconUrl("wmm00010_h1")).toBe(`${MIXI}/ca0201_l_ca0201_l00.png`);
		expect(getMiximaxIconUrl("wmm00130")).toBe(`${MIXI}/cp1811_l_cp1811_l00.png`);
	});

	test("Miximax sans icône réelle dans le dump → \"\" (pas de 404 forgé)", () => {
		// wmm00220 pointe vers un hash de ressource absent du dump → data-gap.
		expect(getMiximaxIconUrl("wmm00220")).toBe("");
		expect(getMiximaxIconUrl("c05028220")).toBe("");
		expect(getMiximaxIconUrl("wmm99999")).toBe("");
	});

	test("entrée vide → \"\"", () => {
		expect(getMiximaxIconUrl(null)).toBe("");
		expect(getMiximaxIconUrl(undefined)).toBe("");
		expect(getMiximaxIconUrl("")).toBe("");
	});
});

describe("items « important » gd120* — seul gd120001 a une icône réelle (CPK)", () => {
	test("gd120001 garde son icône réelle", () => {
		expect(itemIconFileBase("gd120001")).toBe("icon_item01_gd120001");
		expect(getItemImageUrl("gd120001")).toBe(`${ITEM_CDN}/icon_item01_gd120001.png`);
		expect(resolveAssetUrl("200_icon/02_icon_item/gd120001.webp")).toBe(
			`${ITEM_CDN}/icon_item01_gd120001.png`
		);
	});

	test("gd120002..091 sans icône → placeholder (pas de 404 forgé)", () => {
		for (const code of ["gd120002", "gd120030", "gd120059", "gd120066", "gd120091"]) {
			expect(itemIconFileBase(code)).toBeNull();
			expect(getItemImageUrl(code)).toBe(PLACEHOLDERS.item);
			expect(resolveAssetUrl(`200_icon/02_icon_item/${code}.webp`)).toBe(PLACEHOLDERS.item);
		}
	});

	test("autres familles d'items inchangées (pas de régression)", () => {
		expect(getItemImageUrl("eq_ac0105001")).toBe(`${ITEM_CDN}/icon_item05_eq_ac0105001.png`);
		expect(getItemImageUrl("ke000033")).toBe(`${ITEM_CDN}/icon_item02_ke000033.png`);
	});
});

// ---------------------------------------------------------------------------
// Résolution d'URLs CDN — les gates de manifeste évitent les 404 forgés.
// ---------------------------------------------------------------------------

describe("URLs CDN — visages, emblèmes, illustrations", () => {
	test("getCharacterFaceUrl : code servi → PNG dump, sinon placeholder", () => {
		expect(getCharacterFaceUrl("c01000010")).toBe(`${CDN}/face/c01000010_l_c01000010_1_l00.png`);
		// Le suffixe de variante (_5000/_5100…) est retiré : le dump n'a que la base.
		expect(getCharacterFaceUrl("c01000010_5000")).toBe(getCharacterFaceUrl("c01000010"));
		// Code absent du manifeste des faces servies → placeholder, pas un 404 forgé.
		expect(getCharacterFaceUrl("c99999999")).toBe(PLACEHOLDERS.character);
		expect(getCharacterFaceUrl(null)).toBe(PLACEHOLDERS.character);
		expect(getCharacterFaceUrl("")).toBe(PLACEHOLDERS.character);
		expect(getCharacterImageUrl).toBe(getCharacterFaceUrl);
	});

	test("getEmblemImageUrl : `emNNNN` direct, entier zéro-paddé, vide sinon", () => {
		const EMBLEM = "https://cdn.rosegriffon.fr/dx11/menu/200_icon/01_icon_emblem";
		expect(getEmblemImageUrl("em110002")).toBe(`${EMBLEM}/em110002_em110002.png`);
		expect(getEmblemImageUrl(1)).toBe(`${EMBLEM}/em0001_em0001.png`);
		expect(getEmblemImageUrl(null)).toBe("");
		expect(getEmblemImageUrl(undefined)).toBe("");
		expect(getEmblemImageUrl("pas-un-emblème")).toBe("");
	});

	test("getGalleryImageUrl double le img_path (pattern réel du dump)", () => {
		expect(getGalleryImageUrl("img_story_ev01_main_0010")).toBe(
			"https://cdn.rosegriffon.fr/dx11/menu/220_img/gallery_img2/img_story_ev01_main_0010_img_story_ev01_main_0010.png"
		);
		expect(getGalleryImageUrl(null)).toBeNull();
		expect(getGalleryImageUrl("")).toBeNull();
	});

	test("galleryVariantUrl : idempotent hors sources CDN raster", () => {
		expect(galleryVariantUrl("https://cdn.rosegriffon.fr/dx11/menu/x.png", 400)).toBe(
			"https://cdn.rosegriffon.fr/dx11/menu/x.png?w=400&format=webp"
		);
		expect(galleryVariantUrl("https://cdn.rosegriffon.fr/g4tx/y.jpg", 1600)).toBe(
			"https://cdn.rosegriffon.fr/g4tx/y.jpg?w=1600&format=webp"
		);
		// Un webp est déjà léger, un chemin local n'a pas de décodeur derrière nginx.
		expect(galleryVariantUrl("https://cdn.rosegriffon.fr/dx11/menu/x.webp", 400)).toBe(
			"https://cdn.rosegriffon.fr/dx11/menu/x.webp"
		);
		expect(galleryVariantUrl("/local.png", 400)).toBe("/local.png");
		expect(galleryVariantUrl(null, 400)).toBeNull();
		// Toutes les largeurs whitelistées produisent une variante distincte.
		const urls = GALLERY_VARIANT_WIDTHS.map((w) =>
			galleryVariantUrl("https://cdn.rosegriffon.fr/dx11/a.png", w)
		);
		expect(new Set(urls).size).toBe(GALLERY_VARIANT_WIDTHS.length);
	});
});

describe("URLs CDN — modèles 3D (gate manifeste + cache-buster)", () => {
	test("getCharacterModelFullGlbUrl gate les persos c* sur le manifeste", () => {
		const url = getCharacterModelFullGlbUrl("c01000010");
		expect(url).toStartWith("https://cdn.rosegriffon.fr/model-full/c01000010.glb?v=");
		// Cache-buster obligatoire : les GLB sont servis `immutable`.
		expect(url).toMatch(/\?v=\d+$/);
		expect(getCharacterModelFullGlbUrl("c99999999")).toBeNull();
		expect(getCharacterModelFullGlbUrl(null)).toBeNull();
		// Keshins/armures ne sont pas gatés sur le manifeste des faces.
		expect(getCharacterModelFullGlbUrl("k000010")).toStartWith(
			"https://cdn.rosegriffon.fr/model-full/k000010.glb?v="
		);
	});

	test("getCharacterModelGlbUrl / hasCharacterModelGlb sont cohérents", () => {
		expect(getCharacterModelGlbUrl("c01000010")).toBe("https://cdn.rosegriffon.fr/model/c01000010.glb");
		expect(hasCharacterModelGlb("c01000010")).toBe(true);
		expect(getCharacterModelGlbUrl("c99999999")).toBeNull();
		expect(hasCharacterModelGlb("c99999999")).toBe(false);
	});

	test("les codes keshin/armure servis résolvent tous vers une URL", () => {
		const keshins = listServedKeshinCodes();
		const armures = listServedArmureCodes();
		expect(keshins.length).toBeGreaterThan(0);
		expect(armures.length).toBeGreaterThan(0);
		// Listes triées et sans doublon.
		expect([...keshins].sort()).toEqual(keshins);
		expect(new Set(armures).size).toBe(armures.length);
		for (const code of keshins) {
			expect(getKeshinModelGlbUrl(code)).toStartWith(`https://cdn.rosegriffon.fr/model-full/${code}.glb?v=`);
		}
		for (const code of armures) {
			expect(getArmureModelGlbUrl(code)).toStartWith(`https://cdn.rosegriffon.fr/model-full/${code}.glb?v=`);
		}
		expect(getKeshinModelGlbUrl("k999999")).toBeNull();
		expect(getArmureModelGlbUrl("ka999999")).toBeNull();
	});

	test("extractKeshinModelCode retrouve `kNNNNNN` dans un chemin d'icône", () => {
		expect(extractKeshinModelCode("200_icon/10_icon_chr/aura_fs/k000010_l_k000010_l00.png")).toBe("k000010");
		expect(extractKeshinModelCode(null, undefined, "aura_fs/k002020_l")).toBe("k002020");
		expect(extractKeshinModelCode("aucun-code-ici")).toBeNull();
		expect(extractKeshinModelCode()).toBeNull();
	});
});

describe("Icônes UI locales (élément / catégorie / rareté / genre)", () => {
	test("getSkillElementIconUrl accepte FR, EN et code numérique", () => {
		expect(getSkillElementIconUrl("Feu")).toBe("/spirit_type/fire.webp");
		expect(getSkillElementIconUrl("Fire")).toBe("/spirit_type/fire.webp");
		expect(getSkillElementIconUrl(1)).toBe("/spirit_type/fire.webp");
		expect(getSkillElementIconUrl("Forêt")).toBe("/spirit_type/forest.webp");
		expect(getSkillElementIconUrl("Montagne")).toBe("/spirit_type/mountain.webp");
		expect(getSkillElementIconUrl("Vent")).toBe("/spirit_type/wind.webp");
		// Élément inconnu → chaîne vide (l'UI n'affiche pas d'icône cassée).
		expect(getSkillElementIconUrl("inconnu")).toBe("");
		expect(getSkillElementIconUrl("")).toBe("");
	});

	test("getSkillCategoryIconUrl mappe les catégories de technique", () => {
		expect(getSkillCategoryIconUrl("Shoot")).toBe("/move/tir.webp");
		expect(getSkillCategoryIconUrl("Tir")).toBe("/move/tir.webp");
		expect(getSkillCategoryIconUrl("gk")).toBe("/move/gardien.webp");
		expect(getSkillCategoryIconUrl("inconnue")).toBe("");
	});

	test("getRarityIconUrl mappe les raretés du jeu", () => {
		expect(getRarityIconUrl("Normal")).toBe("/rarity/normal.webp");
		expect(getRarityIconUrl(4)).toBe("/rarity/heros.webp");
		expect(getRarityIconUrl("BASARA")).toBe("/rarity/basara.webp");
		expect(getRarityIconUrl(null)).toBe("");
		expect(getRarityIconUrl("inconnue")).toBe("");
	});

	test("getGenderIconUrl retombe sur le masculin par défaut", () => {
		expect(getGenderIconUrl(1)).toBe("/move/girl.webp");
		expect(getGenderIconUrl("F")).toBe("/move/girl.webp");
		expect(getGenderIconUrl(0)).toBe("/move/boy.webp");
		expect(getGenderIconUrl("M")).toBe("/move/boy.webp");
		expect(getGenderIconUrl(null)).toBe("");
	});

	test("getOptimizedImageUrl encode l'URL source et passe les data: telles quelles", () => {
		expect(getOptimizedImageUrl("https://x/y.png", 400, 70)).toBe(
			"/_next/image?url=https%3A%2F%2Fx%2Fy.png&w=400&q=70"
		);
		expect(getOptimizedImageUrl("data:image/png;base64,AA")).toBe("data:image/png;base64,AA");
		expect(getOptimizedImageUrl(null)).toBe("");
	});
});
