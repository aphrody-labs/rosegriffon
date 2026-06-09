/**
 * Tests du décodeur générique cfg.bin (@rose-griffon/iecode-inagle/cfgbin/generic.ts).
 *
 * Fichiers de référence : /home/ubuntu/niers/data/ (dump IEVR réel).
 * Chaque test commençant par un accès au FS est ignoré silencieusement si le
 * fichier est absent (CI sans données jeu).
 */

import { describe, test, expect } from "bun:test";
import {
	decodeCfgBin,
	decodeCfgBinFile,
	isRdbn,
	hasT2bFooter,
	crcKeyFromFileName,
	CfgBinDecodeError,
	type CfgBinDocument,
} from "./generic";

// ── Chemins ───────────────────────────────────────────────────────────────────

const DATA_ROOT   = "/home/ubuntu/niers/data";
const EVENT_DIR   = `${DATA_ROOT}/common/gamedata/event`;
const MENU_CFG    = `${DATA_ROOT}/common/gamedata/menu/cfg`;
const OBJ_DIR     = `${DATA_ROOT}/common/gamedata/menu/obj`;

async function maybeFile(path: string): Promise<Uint8Array | null> {
	try {
		const ab = await Bun.file(path).arrayBuffer();
		return new Uint8Array(ab);
	} catch {
		return null;
	}
}

// ── Détection de format ───────────────────────────────────────────────────────

describe("isRdbn", () => {
	test("retourne true pour le magic RDBN", () => {
		const buf = new Uint8Array([0x52, 0x44, 0x42, 0x4e, 0x00, 0x00, 0x00, 0x00]);
		expect(isRdbn(buf)).toBe(true);
	});

	test("retourne false pour T2B", () => {
		// Footer T2B en fin, pas magic RDBN au début
		const buf = new Uint8Array(32);
		buf[28] = 0x01; buf[29] = 0x74; buf[30] = 0x32; buf[31] = 0x62;
		expect(isRdbn(buf)).toBe(false);
	});

	test("retourne false pour buffer vide", () => {
		expect(isRdbn(new Uint8Array(0))).toBe(false);
	});
});

describe("hasT2bFooter", () => {
	test("retourne true pour footer 01 74 32 62 dans les 32 derniers octets", () => {
		const buf = new Uint8Array(64);
		buf[60] = 0x01; buf[61] = 0x74; buf[62] = 0x32; buf[63] = 0x62;
		expect(hasT2bFooter(buf)).toBe(true);
	});

	test("retourne false pour buffer sans footer", () => {
		expect(hasT2bFooter(new Uint8Array(32))).toBe(false);
	});

	test("retourne false pour buffer trop petit", () => {
		expect(hasT2bFooter(new Uint8Array(4))).toBe(false);
	});
});

// ── CRC key ───────────────────────────────────────────────────────────────────

describe("crcKeyFromFileName", () => {
	test("cpk_list.cfg.bin → clé connue", () => {
		// La clé 0x1717E18E est documentée dans ConfigCommand.cs
		expect(crcKeyFromFileName("cpk_list.cfg.bin")).toBe(0x1717e18e);
	});

	test("clé reproductible", () => {
		const k = crcKeyFromFileName("test_file.cfg.bin");
		expect(crcKeyFromFileName("test_file.cfg.bin")).toBe(k);
	});
});

// ── Erreurs ───────────────────────────────────────────────────────────────────

describe("decodeCfgBin — erreurs", () => {
	test("lève CfgBinDecodeError pour données invalides", () => {
		const random = new Uint8Array(128);
		crypto.getRandomValues(random);
		random[0] = 0xde; random[1] = 0xad; random[2] = 0xbe; random[3] = 0xef;
		expect(() => decodeCfgBin(random)).toThrow(CfgBinDecodeError);
	});
});

// ── T2B : event_cmnd_config ───────────────────────────────────────────────────

describe("décodeur T2B — event_cmnd_config", () => {
	test("format est T2B", async () => {
		const buf = await maybeFile(`${EVENT_DIR}/event_cmnd_config_0.00.00.cfg.bin`);
		if (!buf) return;
		const doc = decodeCfgBin(buf);
		expect(doc.format).toBe("T2B");
	});

	test("tables est vide", async () => {
		const buf = await maybeFile(`${EVENT_DIR}/event_cmnd_config_0.00.00.cfg.bin`);
		if (!buf) return;
		const doc = decodeCfgBin(buf);
		expect(doc.tables).toHaveLength(0);
	});

	test("records non vide", async () => {
		const buf = await maybeFile(`${EVENT_DIR}/event_cmnd_config_0.00.00.cfg.bin`);
		if (!buf) return;
		const doc = decodeCfgBin(buf);
		expect(doc.records.length).toBeGreaterThan(0);
	});

	test("record racine a des enfants", async () => {
		const buf = await maybeFile(`${EVENT_DIR}/event_cmnd_config_0.00.00.cfg.bin`);
		if (!buf) return;
		const doc = decodeCfgBin(buf);
		expect(doc.records[0]!.children.length).toBeGreaterThan(0);
	});

	test("record racine a des champs typés", async () => {
		const buf = await maybeFile(`${EVENT_DIR}/event_cmnd_config_0.00.00.cfg.bin`);
		if (!buf) return;
		const doc = decodeCfgBin(buf);
		const hasInt = doc.records[0]!.fields.some((f) => f.kind === "int");
		expect(hasInt).toBe(true);
	});
});

// ── RDBN : event_movie_config ─────────────────────────────────────────────────

describe("décodeur RDBN — event_movie_config", () => {
	async function getDoc(): Promise<CfgBinDocument | null> {
		const buf = await maybeFile(`${EVENT_DIR}/event_movie_config_0.00.00.cfg.bin`);
		if (!buf) return null;
		return decodeCfgBin(buf);
	}

	test("format est RDBN", async () => {
		const doc = await getDoc();
		if (!doc) return;
		expect(doc.format).toBe("RDBN");
	});

	test("records est vide", async () => {
		const doc = await getDoc();
		if (!doc) return;
		expect(doc.records).toHaveLength(0);
	});

	test("contient 3 tables", async () => {
		const doc = await getDoc();
		if (!doc) return;
		expect(doc.tables).toHaveLength(3);
	});

	test("noms de tables résolus", async () => {
		const doc = await getDoc();
		if (!doc) return;
		const names = doc.tables.map((t) => t.name);
		expect(names).toContain("m_EventMovieInfoList");
		expect(names).toContain("m_EventSubtitleMenuDataList");
		expect(names).toContain("m_EventSongCaptionDataList");
	});

	test("noms de types résolus", async () => {
		const doc = await getDoc();
		if (!doc) return;
		const typeNames = doc.tables.map((t) => t.typeName);
		expect(typeNames).toContain("EVENT_MOVIE_INFO");
		expect(typeNames).toContain("EVENT_SUBTITLE_MENU_DATA");
	});

	test("champ captionName de type string", async () => {
		const doc = await getDoc();
		if (!doc) return;
		const captionTable = doc.tables.find((t) => t.name === "m_EventSongCaptionDataList")!;
		const row = captionTable.rows[0]!;
		const nameField = row.fields.find((f) => f.name === "captionName");
		expect(nameField).toBeDefined();
		expect(nameField!.kind).toBe("string");
	});

	test("champ startFrame est scalaire numérique avec valeur 220", async () => {
		const doc = await getDoc();
		if (!doc) return;
		const captionTable = doc.tables.find((t) => t.name === "m_EventSongCaptionDataList")!;
		const row = captionTable.rows[0]!;
		const startField = row.fields.find((f) => f.name === "startFrame");
		expect(startField).toBeDefined();
		expect(["int", "float", "short"]).toContain(startField!.kind);
		expect(Number(startField!.value)).toBe(220);
	});
});

// ── T2B : menu setting (contient strings) ────────────────────────────────────

describe("décodeur T2B — menu setting", () => {
	test("contient des champs String", async () => {
		const buf = await maybeFile(`${MENU_CFG}/ability_learning_board_menu_setting.cfg.bin`);
		if (!buf) return;
		const doc = decodeCfgBin(buf);
		expect(doc.format).toBe("T2B");

		function allRecords(rs: typeof doc.records): typeof doc.records {
			return rs.flatMap((r) => [r, ...allRecords(r.children)]);
		}
		const hasString = allRecords(doc.records).some((r) =>
			r.fields.some((f) => f.kind === "string"),
		);
		expect(hasString).toBe(true);
	});

	test("a plusieurs records racines", async () => {
		const buf = await maybeFile(`${MENU_CFG}/ability_learning_board_menu_setting.cfg.bin`);
		if (!buf) return;
		const doc = decodeCfgBin(buf);
		expect(doc.records.length).toBeGreaterThanOrEqual(3);
	});
});

// ── Chiffrement : cpk_list ────────────────────────────────────────────────────

describe("décodeur T2B chiffré — cpk_list", () => {
	test("décode le cpk_list.cfg.bin chiffré", async () => {
		const buf = await maybeFile(`${DATA_ROOT}/cpk_list.cfg.bin`);
		if (!buf) return;
		const doc = decodeCfgBin(buf, "cpk_list.cfg.bin");
		expect(doc.format).toBe("T2B");
		expect(doc.records.length).toBeGreaterThan(0);
	});

	test("cpk_list a >1000 enfants", async () => {
		const buf = await maybeFile(`${DATA_ROOT}/cpk_list.cfg.bin`);
		if (!buf) return;
		const doc = decodeCfgBin(buf, "cpk_list.cfg.bin");
		expect(doc.records[0]!.children.length).toBeGreaterThan(1000);
	});
});

// ── Cohérence avec objbin ─────────────────────────────────────────────────────

describe("cohérence objbin — title00_09_version", () => {
	test("décode un .objbin comme T2B sans erreur", async () => {
		const buf = await maybeFile(`${OBJ_DIR}/title00_09_version.objbin`);
		if (!buf) return;
		const doc = decodeCfgBin(buf);
		expect(doc.format).toBe("T2B");
		expect(doc.records.length).toBeGreaterThan(0);
	});
});

// ── decodeCfgBinFile ──────────────────────────────────────────────────────────

describe("decodeCfgBinFile", () => {
	test("décode correctement par chemin", async () => {
		const path = `${EVENT_DIR}/event_movie_config_0.00.00.cfg.bin`;
		const exists = await Bun.file(path).exists();
		if (!exists) return;
		const doc = await decodeCfgBinFile(path);
		expect(doc.format).toBe("RDBN");
		expect(doc.tables.length).toBeGreaterThan(0);
	});
});
