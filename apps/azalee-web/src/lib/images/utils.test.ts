import { describe, expect, test } from "bun:test";

import {
	getAuraImageUrl,
	getItemImageUrl,
	getMiximaxIconUrl,
	itemIconFileBase,
	PLACEHOLDERS,
	resolveAssetUrl,
} from "./utils";

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
