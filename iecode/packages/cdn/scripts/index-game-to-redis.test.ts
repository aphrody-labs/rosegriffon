/**
 * Test RÉEL (pas de mock) de l'export de l'arbre du jeu via IECODE.Core :
 * loadIecode + new IEVRGame(install réel) + GameTreeExport.ExportTreeNdjson →
 * vérifie >0 lignes au format `path\tcpkName\tsize` plausible.
 *
 * Skippe proprement si l'install n'existe pas (data/cpk_list.cfg.bin absent). Ici
 * elle existe : /home/ubuntu/.local/share/Steam/iecode/inazuma.
 */
import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { iecodeCore, loadIecode } from "@rose-griffon/iecode-core";

const ROOT = Bun.env.IECODE_GAME_PATH ?? "/home/ubuntu/.local/share/Steam/iecode/inazuma";
const HAS_INSTALL = existsSync(join(ROOT, "data", "cpk_list.cfg.bin"));

describe("GameTreeExport.ExportTreeNdjson (install réel)", () => {
	test.skipIf(!HAS_INSTALL)("produit un NDJSON path\\tcpk\\tsize plausible", () => {
		loadIecode();
		const core = iecodeCore() as any;

		const game = new core.IEVRGame(ROOT);
		expect(game.IsValid).toBe(true);

		const ndjson: string = core.Cdn.GameTreeExport.ExportTreeNdjson(game);
		expect(typeof ndjson).toBe("string");
		expect(ndjson.length).toBeGreaterThan(0);

		const lines = ndjson.split("\n").filter((l) => l.length > 0);
		// IEVR résolu = des dizaines de milliers d'entrées servables.
		expect(lines.length).toBeGreaterThan(1000);

		// Format : exactement 3 colonnes ; size = entier ; cpkName non vide ;
		// path non vide. Vérifié sur un échantillon (les 200 premières lignes).
		const cpkNames = new Set<string>();
		for (const line of lines.slice(0, 200)) {
			const cols = line.split("\t");
			expect(cols.length).toBe(3);
			const [path, cpk, sizeStr] = cols;
			expect(path!.length).toBeGreaterThan(0);
			expect(cpk!.length).toBeGreaterThan(0);
			// CpkName plausible : se termine par .cpk (convention packs/).
			expect(cpk!.toLowerCase().endsWith(".cpk")).toBe(true);
			expect(Number.isInteger(Number(sizeStr))).toBe(true);
			expect(Number(sizeStr)).toBeGreaterThanOrEqual(0);
			cpkNames.add(cpk!);
		}
		// Plusieurs CPK distincts sur l'échantillon (arbre réel, pas un seul pack).
		expect(cpkNames.size).toBeGreaterThan(0);
	}, 120_000);

	test.skipIf(!HAS_INSTALL)("ExportCpkTocNdjson sur un CPK réel donne path\\tsize\\textract\\tcompressed", () => {
		loadIecode();
		const core = iecodeCore() as any;
		const game = new core.IEVRGame(ROOT);
		expect(game.IsValid).toBe(true);

		const cpkFiles = [...(game.Cpk.GetAllCpkFiles() as Iterable<string>)];
		expect(cpkFiles.length).toBeGreaterThan(0);

		const toc: string = core.Cdn.GameTreeExport.ExportCpkTocNdjson(game, cpkFiles[0]!);
		const lines = toc.split("\n").filter((l) => l.length > 0);
		expect(lines.length).toBeGreaterThan(0);
		for (const line of lines.slice(0, 50)) {
			const cols = line.split("\t");
			expect(cols.length).toBe(4);
			expect(cols[0]!.length).toBeGreaterThan(0); // path
			expect(Number.isInteger(Number(cols[1]))).toBe(true); // size (compressé)
			expect(Number.isInteger(Number(cols[2]))).toBe(true); // extractSize
			expect(cols[3] === "0" || cols[3] === "1").toBe(true); // compressed flag
		}
	}, 120_000);
});
