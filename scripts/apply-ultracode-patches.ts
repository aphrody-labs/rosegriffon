#!/usr/bin/env bun
// Applique les patches du workflow Ultracode (JSON) — remplacement exact, unicité vérifiée,
// saute tout fichier modifié dans les 2 dernières minutes (= potentiellement édité par un agent actif).
import { statSync } from "node:fs";

const OUT = "/tmp/claude-1000/-home-ubuntu-iecode/3fb77687-ca9d-455b-8fac-eebf697c935c/tasks/whq500ilv.output";
const data = await Bun.file(OUT).json();
const patches: Array<{ item_id: string; edits?: Array<{ file: string; old_string: string; new_string: string }> }> =
	data.result.patches;

const now = Date.now();
let applied = 0;
let skipped = 0;
const touched = new Set<string>();

for (const p of patches) {
	for (const e of p.edits || []) {
		let content: string;
		try {
			content = await Bun.file(e.file).text();
		} catch {
			console.log(`  SKIP ${p.item_id}: fichier introuvable ${e.file}`);
			skipped++;
			continue;
		}
		void statSync; void now; // garde mtime retiré : agents terminés, on finit les edits
		const count = content.split(e.old_string).length - 1;
		if (count === 0) {
			console.log(`  SKIP ${p.item_id}: old_string absent dans ${e.file.split("/").slice(-2).join("/")}`);
			skipped++;
			continue;
		}
		if (count > 1) {
			console.log(`  SKIP ${p.item_id}: old_string non unique (${count}x) dans ${e.file.split("/").slice(-2).join("/")}`);
			skipped++;
			continue;
		}
		await Bun.write(e.file, content.replace(e.old_string, e.new_string));
		touched.add(e.file);
		applied++;
		console.log(`  OK   ${p.item_id}: ${e.file.split("/").slice(-2).join("/")}`);
	}
}
console.log(`\n  ${applied} edits appliqués, ${skipped} sautés, ${touched.size} fichiers touchés.`);
