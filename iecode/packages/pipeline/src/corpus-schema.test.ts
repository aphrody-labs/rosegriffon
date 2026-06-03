/**
 * Conformité « schémas alignés sur la vraie donnée » : exporte le corpus RÉEL via inagle
 * (`DATA_PATH`, défaut `/home/ubuntu/data`) puis valide CHAQUE entrée de chaque domaine couvert
 * contre son schéma Valibot. Toute dérive de structure casse ce test (skip si la donnée est absente).
 */
import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { afterAll, describe, expect, test } from "bun:test";
import * as v from "valibot";
import { exportCorpus } from "./corpus.ts";
import { CORPUS_SCHEMAS, hasCorpusSchema, type CorpusDomain } from "./corpus-schema.ts";

const DATA = process.env["DATA_PATH"] ?? "/home/ubuntu/data";
const hasData = existsSync(DATA);
const OUT = join(import.meta.dir, "..", ".test-corpus-schema");

let exported = false;
async function ensureCorpus(): Promise<void> {
	if (!exported) {
		await exportCorpus({ dataPath: DATA, outDir: OUT, pretty: false });
		exported = true;
	}
}

afterAll(async () => {
	await rm(OUT, { recursive: true, force: true });
});

describe("corpus-schema (validé sur le corpus RÉEL inagle)", () => {
	for (const domain of Object.keys(CORPUS_SCHEMAS) as CorpusDomain[]) {
		test.skipIf(!hasData)(
			`${domain} : toutes les entrées valident contre le schéma`,
			async () => {
				await ensureCorpus();
				const file = join(OUT, `${domain}.json`);
				if (!existsSync(file)) return; // domaine absent de ce build
				const raw = (await Bun.file(file).json()) as unknown;
				const rows = Array.isArray(raw)
					? raw
					: raw && typeof raw === "object"
						? Object.values(raw)
						: [];
				if (rows.length === 0) return;
				const schema = CORPUS_SCHEMAS[domain];
				let failures = 0;
				let firstError = "";
				for (const row of rows) {
					const r = v.safeParse(schema, row);
					if (!r.success) {
						failures++;
						if (!firstError) firstError = JSON.stringify(v.flatten(r.issues).nested ?? r.issues);
					}
				}
				expect(failures, `${domain}: ${failures}/${rows.length} échecs — ${firstError}`).toBe(0);
				expect(rows.length).toBeGreaterThan(0);
			},
			120_000,
		);
	}

	test("registre cohérent (hasCorpusSchema)", () => {
		expect(hasCorpusSchema("characters")).toBe(true);
		expect(hasCorpusSchema("inexistant")).toBe(false);
	});
});
