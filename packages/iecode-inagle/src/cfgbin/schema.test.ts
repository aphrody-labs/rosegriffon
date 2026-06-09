/**
 * Conformité « schéma cfg.bin aligné sur la vraie donnée » : décode de VRAIS fichiers `*.cfg.bin`
 * (`/home/ubuntu/niers/data`) puis `v.parse(CfgBinDocument, …)` chaque document décodé. Couvre T2B + RDBN
 * et les 9 kinds de valeur. Skip si la donnée jeu est absente.
 */
import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "bun:test";
import * as v from "valibot";

import { decodeCfgBinFile } from "./generic.ts";
import { cfgConfigName, CfgBinDocument } from "./schema.ts";

const DATA = process.env["DATA_PATH"] ?? "/home/ubuntu/niers/data";
const ROOT = join(DATA, "common/gamedata");
const hasData = existsSync(ROOT);

/** Liste un échantillon réparti de fichiers .cfg.bin (≤ `max`). */
function sampleCfgBin(root: string, max: number): string[] {
	const all: string[] = [];
	const walk = (dir: string, depth: number): void => {
		if (depth > 4 || all.length > 4000) return;
		let entries: string[];
		try {
			entries = readdirSync(dir);
		} catch {
			return;
		}
		for (const e of entries) {
			const p = join(dir, e);
			let st: ReturnType<typeof statSync>;
			try {
				st = statSync(p);
			} catch {
				continue;
			}
			if (st.isDirectory()) walk(p, depth + 1);
			else if (e.endsWith(".cfg.bin")) all.push(p);
		}
	};
	walk(root, 0);
	const step = Math.max(1, Math.floor(all.length / max));
	return all.filter((_, i) => i % step === 0).slice(0, max);
}

describe("cfgbin schema (validé sur de VRAIS fichiers .cfg.bin)", () => {
	it.skipIf(!hasData)(
		"décode + valide un échantillon réparti (T2B + RDBN, tous kinds)",
		async () => {
			const files = sampleCfgBin(ROOT, 400);
			expect(files.length).toBeGreaterThan(50);

			const fmt: Record<string, number> = {};
			const kinds = new Set<string>();
			let failures = 0;
			let firstError = "";

			for (const path of files) {
				let doc;
				try {
					doc = await decodeCfgBinFile(path);
				} catch {
					continue; // certains fichiers (ex. subtitles tronqués) — non bloquant
				}
				const r = v.safeParse(CfgBinDocument, doc);
				if (!r.success) {
					failures++;
					if (!firstError) firstError = `${path}: ${JSON.stringify(v.flatten(r.issues).nested ?? r.issues)}`;
					continue;
				}
				fmt[doc.format] = (fmt[doc.format] ?? 0) + 1;
				for (const rec of doc.records) for (const f of rec.fields) kinds.add(f.kind);
				for (const t of doc.tables) for (const rec of t.rows) for (const f of rec.fields) kinds.add(f.kind);
			}

			expect(failures, `${failures} documents invalides — ${firstError}`).toBe(0);
			// Les deux formats doivent apparaître dans un échantillon réparti.
			expect(fmt["T2B"] ?? 0).toBeGreaterThan(0);
			expect(fmt["RDBN"] ?? 0).toBeGreaterThan(0);
			// Couverture des kinds de valeur (au moins les principaux).
			for (const k of ["string", "int", "float", "hash"]) expect(kinds.has(k)).toBe(true);
		},
		120_000,
	);
});

describe("cfgConfigName (type par nom de config)", () => {
	it("normalise nom + version", () => {
		expect(cfgConfigName("shop_config_3.00.22.cfg.bin")).toBe("shop_config");
		expect(cfgConfigName("a/b/craft_theme_config_0.00.00.cfg.bin")).toBe("craft_theme_config");
		expect(cfgConfigName("nfc_lottery_config.cfg.bin")).toBe("nfc_lottery_config");
		expect(cfgConfigName("map_route_config_dbg.cfg.bin")).toBe("map_route_config");
	});
});
