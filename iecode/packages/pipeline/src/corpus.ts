/**
 * Export du corpus complet IEVR depuis inagle : tous les domaines (personnages,
 * skills, auras, passifs, basara, items, équipes, formations, quêtes, drops…) +
 * les parsers bas niveau, vers un dossier de JSON + un manifeste.
 *
 * C'est l'étape « accumule le plus de data possible » : on laisse inagle (parsing
 * complet de ~50 fichiers cfg.bin) produire les données, et on les fige.
 */
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { getInagle } from "@rose-griffon/iecode-inagle";
import type { CorpusManifest, CorpusOptions } from "./types.ts";

/** Sérialise une Map en objet (les domaines drops renvoient des Map). */
function mapToObject(m: unknown): unknown {
	return m instanceof Map ? Object.fromEntries(m) : m;
}

function count(data: unknown): number {
	if (Array.isArray(data)) return data.length;
	if (data instanceof Map) return data.size;
	if (data && typeof data === "object") return Object.keys(data).length;
	return data == null ? 0 : 1;
}

export async function exportCorpus(opts: CorpusOptions): Promise<CorpusManifest> {
	if (opts.dataPath) process.env["DATA_PATH"] = opts.dataPath;
	const log = opts.onLog ?? (() => {});
	const out = opts.outDir;
	await mkdir(out, { recursive: true });

	const inagle = await getInagle();
	const counts: Record<string, number> = {};
	const skipped: Record<string, string> = {};
	const indent = opts.pretty ? 2 : undefined;
	// Bun.write utilise les syscalls les plus rapides et les écritures se
	// chevauchent : on lance toutes les écritures en parallèle (Promise.all).
	const writes: Promise<number>[] = [];

	// Domaines synchrones (nom de fichier → producteur).
	const domains: Record<string, () => unknown> = {
		characters: () => inagle.characters.all(),
		"characters-base": () => inagle.characters.baseCharacters(),
		skills: () => inagle.skills.all(),
		auras: () => inagle.skills.auraAll(),
		passives: () => inagle.skills.passiveAll(),
		"team-passives": () => inagle.skills.teamPassives(),
		basara: () => inagle.basara.all(),
		items: () => inagle.items.allItems(),
		capsules: () => inagle.items.allCapsules(),
		gallery: () => inagle.items.allGallery(),
		teams: () => inagle.teams.allTeams(),
		formations: () => inagle.teams.allFormations(),
		uniforms: () => inagle.teams.allUniforms(),
		series: () => inagle.teams.allSeries(),
		quests: () => inagle.quests.all(),
		"drops-tables": () => mapToObject(inagle.drops.getAllTables()),
		"drops-battles": () => mapToObject(inagle.drops.getAllBattles()),
		"drops-treasures": () => inagle.drops.getAllTreasures(),
	};

	for (const [name, produce] of Object.entries(domains)) {
		try {
			const data = produce();
			writes.push(Bun.write(join(out, `${name}.json`), JSON.stringify(data, null, indent)));
			counts[name] = count(data);
			log(`  ${name}: ${counts[name]}`);
		} catch (error) {
			skipped[name] = (error as Error).message;
			log(`  ${name}: ignoré (${(error as Error).message})`);
		}
	}

	// Parsers bas niveau (async), exécutés en parallèle.
	const parsers = [
		"costumes",
		"expTable",
		"growthTable",
		"tricks",
		"opponents",
		"ctrlChara",
	] as const;
	// NB : les parsers de `inagle.parsers` (lazyParsers) sont des méthodes qui
	// référencent `this._<cache>` — il faut les appeler SUR l'objet (`bag[p]()`),
	// pas via une fonction détachée, sinon `this` est perdu → "undefined is not an object".
	const parsersBag = inagle.parsers as unknown as Record<string, () => Promise<unknown>>;
	await Promise.all(
		parsers.map(async (p) => {
			try {
				if (typeof parsersBag[p] !== "function") {
					skipped[`parser-${p}`] = "méthode absente";
					return;
				}
				const data = await parsersBag[p]();
				writes.push(Bun.write(join(out, `parser-${p}.json`), JSON.stringify(data, null, indent)));
				counts[`parser-${p}`] = count(data);
				log(`  parser-${p}: ${counts[`parser-${p}`]}`);
			} catch (error) {
				skipped[`parser-${p}`] = (error as Error).message;
			}
		})
	);

	// Attend la fin de toutes les écritures (chevauchées) avant le manifeste.
	await Promise.all(writes);

	const total = Object.values(counts).reduce((a, b) => a + b, 0);
	const manifest: CorpusManifest = {
		generatedAt: new Date().toISOString(),
		buildId: opts.buildId,
		counts,
		total,
		skipped,
	};
	await Bun.write(join(out, "corpus.json"), `${JSON.stringify(manifest, null, 2)}\n`);
	log(`✓ corpus: ${total} entrées sur ${Object.keys(counts).length} domaines → ${out}`);
	return manifest;
}
