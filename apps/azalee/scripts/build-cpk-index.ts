#!/usr/bin/env bun
/**
 * Génère l'index CPK d'IEVR consommé par le navigateur/arbre de fichiers d'azalee
 * (`/cpk`, `lib/cpk/index.ts`, `app/api/cpk`).
 *
 * Source de vérité = index Redis db3 `iev:file:index` (HASH `path -> cpk`,
 * ~250 800 entrées, ex. `data/dx11/chr/_face/.../c.g4tx -> <hash>.cpk`).
 *
 * STRATÉGIE D'ARTEFACT (build standalone fresh-checkout) :
 * Un `.sqlite` plein (8 colonnes + index sur 250 k lignes) pèse ~93 Mo — trop
 * lourd à tracker en git. À l'inverse, `*.sqlite` est gitignoré globalement.
 * On tracke donc un NDJSON gzippé compact `data/cpk-index.ndjson.gz` (~7 Mo, une
 * ligne `[path, cpk]` par fichier) et la lib runtime (`lib/cpk/index.ts`)
 * MATÉRIALISE la table `cpk_index(path, top, sub, dir, name, ext, cpk, depth)`
 * dans un SQLite de cache au premier accès (singleton process-local). Robuste :
 * pas de binaire 93 Mo en git, pas de symlink (piège Turbopack hors-racine), et
 * l'artefact survit au fresh-checkout.
 *
 * Run : `bun scripts/build-cpk-index.ts`
 *   --out=<path>    sortie NDJSON gz (défaut: data/cpk-index.ndjson.gz)
 *   --redis-db=<n>  base Redis (défaut: 3, ou $IEV_REDIS_DB)
 *   --sqlite        écrit AUSSI un .sqlite plein (debug ; data/cpk-index.sqlite)
 */
import { Database } from "bun:sqlite";
import { gzipSync } from "node:zlib";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { $ } from "bun";
import { buildSqliteFromEntries, type CpkEntry } from "@/lib/cpk/materialize";

interface Args {
	outPath: string;
	redisDb: string;
	sqlite: boolean;
}

function parseArgs(argv: string[]): Args {
	const get = (flag: string): string | undefined => {
		const hit = argv.find((a) => a.startsWith(`${flag}=`));
		return hit?.slice(flag.length + 1);
	};
	const scriptDir = path.dirname(new URL(import.meta.url).pathname);
	const appRoot = path.resolve(scriptDir, "..");
	return {
		outPath: path.resolve(get("--out") ?? path.join(appRoot, "data/cpk-index.ndjson.gz")),
		redisDb: get("--redis-db") ?? process.env.IEV_REDIS_DB ?? "3",
		sqlite: argv.includes("--sqlite"),
	};
}

/** Récupère l'index complet depuis Redis via `redis-cli HGETALL`. */
async function readRedisIndex(redisDb: string): Promise<CpkEntry[]> {
	const out = await $`redis-cli -n ${redisDb} HGETALL iev:file:index`.quiet().text();
	const lines = out.split("\n");
	const entries: CpkEntry[] = [];
	// HGETALL retourne field/value alternés. Les chemins IEVR ne contiennent
	// jamais de newline → split('\n') est sûr.
	for (let i = 0; i + 1 < lines.length; i += 2) {
		const field = lines[i];
		const value = lines[i + 1];
		if (field && value) entries.push([field, value]);
	}
	return entries;
}

async function main(): Promise<void> {
	const args = parseArgs(Bun.argv.slice(2));

	const entries = await readRedisIndex(args.redisDb);
	if (entries.length === 0) {
		console.error("[build-cpk-index] index Redis vide — abandon (Redis db3 down ?)");
		process.exit(1);
	}

	mkdirSync(path.dirname(args.outPath), { recursive: true });

	// NDJSON compact : une ligne `["data/...","<hash>.cpk"]` par fichier. La
	// décomposition en colonnes (top/sub/dir/name/ext/depth) est dérivée au
	// chargement (lib/cpk/materialize) → artefact minimal, source unique.
	const ndjson = entries.map((e) => JSON.stringify(e)).join("\n");
	const gz = gzipSync(Buffer.from(ndjson, "utf8"), { level: 9 });
	await Bun.write(args.outPath, gz);
	console.log(`[build-cpk-index] ndjson.gz -> ${args.outPath} (entries=${entries.length}, ${(gz.length / 1024 / 1024).toFixed(1)} Mo)`);

	if (args.sqlite) {
		const sqlitePath = args.outPath.replace(/\.ndjson\.gz$/, ".sqlite");
		const db = new Database(sqlitePath, { create: true });
		buildSqliteFromEntries(db, entries);
		const count = (db.query("SELECT COUNT(*) AS n FROM cpk_index").get() as { n: number }).n;
		db.close();
		console.log(`[build-cpk-index] sqlite (debug) -> ${sqlitePath} (rows=${count})`);
	}

	console.log("[build-cpk-index] git add data/cpk-index.ndjson.gz  # tracké (artefact source)");
}

await main();
