/**
 * Génère `data/chr-model-manifest.json` — les codes de modèles 3D `common/chr/_<sub>/` réellement
 * servables par `cdn.rosegriffon.fr/model-chr/<sub>/<code>.glb` (gate anti-404 de la galerie
 * `/modeles` et de `getChrModelGlbUrl`).
 *
 * Vérité terrain : l'index CPK (`data/cpk-index.ndjson.gz`). Un code est servable si son dossier
 * `data/common/chr/_<sub>/<code>/` contient un maillage (`.g4mg` libre ou `.g4pkm` packé) — la route
 * `model-chr` assemble depuis ça. Validé par probe CDN (échantillon des 6 préfixes `_waza` → 200).
 *
 * ⚠ L'ancien manifeste était gravement périmé (waza=5 alors que 272 existent réellement) → la
 * galerie ne montrait qu'une poignée de techniques. Régénérer après tout rebuild de
 * `cpk-index.ndjson.gz` :  bun apps/azalee/scripts/build-chr-model-manifest.ts
 */
import { gunzipSync } from "node:zlib";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dir, "..");
const INDEX = path.join(ROOT, "data/cpk-index.ndjson.gz");
const OUT = path.join(ROOT, "data/chr-model-manifest.json");

/** Sous-domaines chr exposés par la galerie générique `/modeles` (keshin/armd ont leur manifeste). */
const SUBS = ["waza", "item", "animal"] as const;

const paths = gunzipSync(readFileSync(INDEX))
	.toString("utf8")
	.split("\n")
	.filter(Boolean)
	.map((line) => (JSON.parse(line) as [string, string])[0]);

const manifest: Record<string, string[]> = {};
for (const sub of SUBS) {
	// code → set d'extensions présentes sous common/chr/_<sub>/<code>/
	const exts = new Map<string, Set<string>>();
	const re = new RegExp(`^data/common/chr/_${sub}/([^/]+)/(.+)$`);
	for (const p of paths) {
		const m = p.match(re);
		if (!m) continue;
		if (!exts.has(m[1])) exts.set(m[1], new Set());
		exts.get(m[1])!.add(m[2].split(".").pop()!.toLowerCase());
	}
	manifest[sub] = [...exts.entries()]
		.filter(([, e]) => e.has("g4mg") || e.has("g4pkm"))
		.map(([code]) => code)
		.sort();
}

writeFileSync(OUT, `${JSON.stringify(manifest, null, 0)}\n`);
console.log(
	`chr-model-manifest → ${OUT}\n  ${SUBS.map((s) => `${s}=${manifest[s].length}`).join("  ")}`,
);
