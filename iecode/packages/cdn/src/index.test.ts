import { existsSync } from "node:fs";
import { expect, test } from "bun:test";
import { IECODE_CORE_DLL, iecodeCore } from "@rose-griffon/iecode-core";
import { openMenuCdn } from "./index.ts";

// Ces tests touchent l'install IEVR réel + l'assembly .NET. On les saute proprement si l'un ou
// l'autre manque (CI sans jeu / sans build Release), ou si le DLL Release n'a pas encore été
// reconstruit avec la façade MenuCdnBridge (le rebuild de IECODE.Core est piloté par une phase
// d'orchestration ultérieure ; cf. wiringNeeded).
const GAME = `${process.env["HOME"]}/.local/share/Steam/iecode/inazuma`;
function bridgeAvailable(): boolean {
	try {
		return existsSync(IECODE_CORE_DLL) && iecodeCore().Cdn?.MenuCdnBridge != null;
	} catch {
		return false;
	}
}
const READY = existsSync(`${GAME}/data/packs`) && bridgeAvailable();
const maybe = READY ? test : test.skip;

// Couples (chemin azalee → conteneur attendu, texture attendue) vérifiés sur l'install réel.
const CASES: Array<[string, string, string]> = [
	[
		"dx11/menu/200_icon/10_icon_chr/face/c01001640_l_c01001640_1_l00.png",
		"data/dx11/menu/200_icon/10_icon_chr/face/c01001640_l.g4tx",
		"c01001640_1_l00",
	],
	[
		"dx11/menu/200_icon/10_icon_chr/uniform/u020653_10_00_l_u020653_10_00_2.png",
		"data/dx11/menu/200_icon/10_icon_chr/uniform/u020653_10_00_l.g4tx",
		"u020653_10_00_2",
	],
	[
		"dx11/menu/200_icon/01_icon_emblem/em040017_em040017.png",
		"data/dx11/menu/200_icon/01_icon_emblem/em040017.g4tx",
		"em040017",
	],
	[
		"dx11/menu/200_icon/02_icon_item/icon_item04_eq_mi0105501.png",
		"data/dx11/menu/200_icon/02_icon_item/icon_item04.g4tx",
		"eq_mi0105501",
	],
];

maybe("resolve mappe les chemins azalee vers conteneur + sous-texture", () => {
	const cdn = openMenuCdn(GAME);
	try {
		for (const [azalee, container, tex] of CASES) {
			const r = cdn.resolve(azalee);
			expect(r).not.toBeNull();
			expect(r!.containerPath).toBe(container);
			expect(r!.textureName).toBe(tex);
		}
	} finally {
		cdn.dispose();
	}
});

maybe("render décode des PNG lossless aux dimensions natives", async () => {
	const cdn = openMenuCdn(GAME);
	try {
		const face = await cdn.render(CASES[0]![0]);
		expect(face).not.toBeNull();
		expect(face!.width).toBe(256);
		expect(face!.height).toBe(256);
		// signature PNG
		expect([face!.bytes[0], face!.bytes[1], face!.bytes[2], face!.bytes[3]]).toEqual([0x89, 0x50, 0x4e, 0x47]);

		const telop = await cdn.render("dx11/menu/220_img/telop_waza/whd01320_whd01320.png");
		expect(telop).not.toBeNull();
		expect(telop!.width).toBe(1728);
		expect(telop!.height).toBe(352);
	} finally {
		cdn.dispose();
	}
});

maybe("export matérialise l'arbre dx11/menu/**.png", async () => {
	const cdn = openMenuCdn(GAME);
	const out = `${process.env["TMPDIR"] ?? "/tmp"}/iecode-cdn-test-${Date.now()}`;
	try {
		const report = await cdn.exportTree(out, { filter: "aura_fs/k0006", overwrite: true });
		expect(report.containers).toBeGreaterThan(0);
		expect(report.pngWritten).toBeGreaterThanOrEqual(report.containers);
		expect(report.failed).toBe(0);
	} finally {
		cdn.dispose();
		await Bun.$`rm -rf ${out}`.quiet().nothrow();
	}
});
