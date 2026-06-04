/**
 * Test RÉEL (pas de mock) de l'export des EN-TÊTES de textures G4TX via IECODE.Core :
 * loadIecode + new IEVRGame(install réel) + ExportTextureHeadersNdjson(game, 5) →
 * vérifie >0 lignes au format `path\twidth\theight\tformat\tmips` avec des dimensions
 * plausibles (width/height > 0). AUCUN pixel décodé : seul l'en-tête est lu.
 *
 * Skippe proprement si l'install n'existe pas (data/cpk_list.cfg.bin absent). Ici elle
 * existe : /home/ubuntu/.local/share/Steam/iecode/inazuma.
 */
import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { iecodeCore, loadIecode } from "@rose-griffon/iecode-core";

const ROOT = Bun.env.IECODE_GAME_PATH ?? "/home/ubuntu/.local/share/Steam/iecode/inazuma";
const HAS_INSTALL = existsSync(join(ROOT, "data", "cpk_list.cfg.bin"));

describe("TextureManifestExport.ExportTextureHeadersNdjson (install réel)", () => {
	test.skipIf(!HAS_INSTALL)(
		"produit un NDJSON path\\twidth\\theight\\tformat\\tmips plausible (5 conteneurs)",
		() => {
			loadIecode();
			const core = iecodeCore() as any;

			const game = new core.IEVRGame(ROOT);
			expect(game.IsValid).toBe(true);

			const ndjson: string = core.Cdn.TextureManifestExport.ExportTextureHeadersNdjson(game, 5);
			expect(typeof ndjson).toBe("string");
			expect(ndjson.length).toBeGreaterThan(0);

			const lines = ndjson.split("\n").filter((l) => l.length > 0);
			// 5 conteneurs .g4tx → au moins 5 textures (souvent plus avec les atlas).
			expect(lines.length).toBeGreaterThan(0);

			let withDims = 0;
			for (const line of lines) {
				const cols = line.split("\t");
				expect(cols.length).toBe(5);
				const [path, w, h, fmt, mips] = cols;
				expect(path!.length).toBeGreaterThan(0);
				// Chemin .g4tx (conteneur).
				expect(path!.toLowerCase().endsWith(".g4tx")).toBe(true);
				expect(Number.isInteger(Number(w))).toBe(true);
				expect(Number.isInteger(Number(h))).toBe(true);
				expect(Number.isInteger(Number(fmt))).toBe(true);
				expect(Number.isInteger(Number(mips))).toBe(true);
				if (Number(w) > 0 && Number(h) > 0) withDims++;
			}
			// Au moins une texture décodée avec des dimensions réelles non nulles.
			expect(withDims).toBeGreaterThan(0);
		},
		120_000,
	);
});
