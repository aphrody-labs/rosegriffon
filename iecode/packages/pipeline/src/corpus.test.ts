import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { afterAll, describe, expect, test } from "bun:test";
import { exportCorpus } from "./corpus.ts";

const DATA = process.env["DATA_PATH"] ?? "/home/ubuntu/niers/data";
const hasData = existsSync(DATA);
const OUT = join(import.meta.dir, "..", ".test-corpus");

afterAll(async () => {
	await rm(OUT, { recursive: true, force: true });
});

describe("exportCorpus (réel via inagle)", () => {
	test.skipIf(!hasData)(
		"exporte les domaines majeurs en JSON + manifeste",
		async () => {
			const manifest = await exportCorpus({ dataPath: DATA, outDir: OUT });

			// Domaines clés présents et non vides.
			expect(manifest.counts.characters ?? 0).toBeGreaterThan(1000);
			expect(manifest.counts.skills ?? 0).toBeGreaterThan(1000);
			expect(manifest.total).toBeGreaterThan(5000);

			// Les fichiers existent sur disque.
			expect(existsSync(join(OUT, "characters.json"))).toBe(true);
			expect(existsSync(join(OUT, "skills.json"))).toBe(true);
			expect(existsSync(join(OUT, "corpus.json"))).toBe(true);

			// Le JSON exporté est valide et compte autant que le manifeste.
			const chars = (await Bun.file(join(OUT, "characters.json")).json()) as unknown[];
			expect(chars.length).toBe(manifest.counts.characters ?? 0);
		},
		120_000
	);
});
