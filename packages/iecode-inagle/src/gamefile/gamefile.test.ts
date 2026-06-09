/**
 * Conformité de l'union discriminée `GameFile` :
 *   1. détection par magic bytes — chaque magic RE'd (REPORT §6) mappe au bon `kind` ;
 *   2. détection sur de VRAIS fichiers du jeu (`/home/ubuntu/niers/data`) — magic (lua), footer T2B,
 *      et extension (cfg.bin/objbin/usm chiffrés → fallback extension correct).
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "bun:test";
import {
	detectGameFile,
	detectGameFileFromData,
	detectGameFilePath,
	fromExtension,
	gameFileInfo,
	KNOWN_GAME_FILE_TYPES,
	type GameFileKind,
} from "./index.ts";

const DATA = process.env["DATA_PATH"] ?? "/home/ubuntu/niers/data";

/** Construit un header à partir d'une chaîne ASCII (magic) + octets optionnels. */
function header(ascii: string, ...extra: number[]): Uint8Array {
	const a = [...ascii].map((c) => c.charCodeAt(0));
	return new Uint8Array([...a, ...extra]);
}

describe("GameFile — détection par magic (REPORT §6)", () => {
	const cases: ReadonlyArray<readonly [Uint8Array, GameFileKind]> = [
		[header("G4TX"), "texture"],
		[header("G4PK", 0x40), "package"], // G4PK@
		[header("G4PK", 0x4d), "package-menu"], // G4PKM
		[header("G4SK", 0x40), "skeleton"],
		[header("G4MD", 0x50), "model"], // G4MDP
		[header("G4MG"), "model-group"],
		[header("G4MT"), "material"],
		[header("G4MA"), "motion"],
		[header("G4RA", 0x60), "resource-archive"], // G4RA`
		[header("RDBN"), "config"],
		[header("CPK "), "archive"],
		[header("AFS2"), "audio-archive"],
		[header("@UTF"), "utf"],
		[header("CRILAYLA"), "compressed"],
		[new Uint8Array([0x1b, 0x4c, 0x75, 0x61]), "lua"], // \x1bLua
		[header("objb"), "objbin"],
		[header("PXCL"), "pxcl"],
		[header("XFSA"), "xfsa"],
		[header("XPCK"), "xpck"],
		[new Uint8Array([0x2e, 0x49, 0x47, 0x41]), "agi"], // ".AGI" magic 0x4147492E (octets disque)
		[new Uint8Array([0x48, 0x43, 0x41, 0x00]), "audio-hca"], // HCA\0
		[header("CRID"), "video"],
		[new Uint8Array([0, 0, 0]), "unknown"], // < 4 octets
		[header("ZZZZ"), "unknown"],
	];
	for (const [bytes, expected] of cases) {
		it(`${expected} ← magic`, () => {
			expect(detectGameFile(bytes)).toBe(expected);
			if (expected !== "unknown") expect(gameFileInfo(expected)?.kind).toBe(expected);
		});
	}

	it("T2B (footer 01 74 32 62) détecté via le buffer complet", () => {
		const body = new Uint8Array(32);
		body.set([0x01, 0x74, 0x32, 0x62], body.length - 4);
		expect(detectGameFileFromData(body)).toBe("config");
	});
});

describe("GameFile — détection par extension", () => {
	it("gère les doubles extensions et les variantes", () => {
		expect(fromExtension("a/b/x.lua.bin")).toBe("lua");
		expect(fromExtension("a/x.cfg.bin")).toBe("config");
		expect(fromExtension("x.g4tx")).toBe("texture");
		expect(fromExtension("x.acb")).toBe("audio-bundle");
		expect(fromExtension("x.awb")).toBe("audio-awb");
		expect(fromExtension("x.adx")).toBe("audio-adx");
		expect(fromExtension("x.usm")).toBe("video");
		expect(fromExtension("x.unknownext")).toBe("unknown");
	});
});

describe("GameFile — table complète", () => {
	it("chaque kind connu a une variante GameFile complète", () => {
		for (const t of KNOWN_GAME_FILE_TYPES) {
			const info = gameFileInfo(t.kind);
			expect(info).toBeDefined();
			expect(info?.magic).toBe(t.magic);
			expect(info?.extension).toBe(t.extension);
		}
	});
});

describe("GameFile — VRAIS fichiers du jeu", () => {
	const luaBin = join(DATA, "lua_scripts/qsb030400_trigger_0.04.78.lua.bin");
	const objbin = join(DATA, "common/gamedata/menu/obj/soccer20_12_tactics_information.objbin");
	const cfgbin = join(DATA, "common/gamedata/craft/craft_theme_config_0.00.00.cfg.bin");

	it.skipIf(!existsSync(luaBin))("lua.bin détecté par magic \\x1bLua", async () => {
		const file = await detectGameFilePath(luaBin);
		expect(file.kind).toBe("lua");
		const buf = new Uint8Array(await Bun.file(luaBin).slice(0, 4).arrayBuffer());
		expect(detectGameFile(buf)).toBe("lua");
	});

	it.skipIf(!existsSync(objbin))("objbin réel détecté (footer/extension)", async () => {
		expect((await detectGameFilePath(objbin)).kind).toBe("objbin");
	});

	it.skipIf(!existsSync(cfgbin))("cfg.bin chiffré → fallback extension config", async () => {
		expect((await detectGameFilePath(cfgbin)).kind).toBe("config");
	});
});
