#!/usr/bin/env bun
/**
 * index-game-to-redis — pousse l'arbre RÉSOLU du jeu IEVR (fichier → CPK) dans Redis.
 *
 * Chaîne : IECODE.Core (.NET) via node-api-dotnet → NDJSON (UN seul franchissement du
 * pont) → parsing Bun → pipeline Redis (auto-pipelining, batch). Répond vite à :
 *   - « quel CPK contient X »      : HGET iev:file:index <path>            → cpkName  (O(1))
 *   - « liste des fichiers de CPK » : HGETALL iev:cpk:<name>               → {path:size}
 *   - « taille de X »              : HGET iev:cpk:<cpkName> <path>
 *   - « tous les CPK »             : SMEMBERS iev:cpk:index
 *
 * Isolation : db DÉDIÉ (défaut db3) + préfixe `iev:` — ne touche JAMAIS db0 (niers) ni
 * db1 (bot). Le db se choisit UNIQUEMENT via le numéro en fin d'URL (jamais SELECT, qui
 * désactive l'auto-pipelining). Idempotent : HSET/SADD écrasent/dédupliquent.
 *
 * Sortie = UNE ligne terse `clé=val` (convention CLI agent).
 *
 *   bun scripts/index-game-to-redis.ts [--root <dir>] [--redis-url <url>]
 *       [--toc] [--concurrency N] [--limit N] [--dry-run]
 */
import { RedisClient } from "bun";
import { parseArgs } from "node:util";
import { iecodeCore, loadIecode } from "@rose-griffon/iecode-core";

const t0 = performance.now();

const { values } = parseArgs({
	args: Bun.argv.slice(2),
	allowPositionals: true,
	options: {
		root: { type: "string" },
		"redis-url": { type: "string" },
		toc: { type: "boolean", default: false },
		concurrency: { type: "string" },
		limit: { type: "string" },
		"dry-run": { type: "boolean", default: false },
	},
});

const ROOT = values.root ?? "/home/ubuntu/.local/share/Steam/iecode/inazuma";
// db DÉDIÉ db3 par défaut (REDIS_URL global = db0 → on NE le réutilise PAS tel quel).
const REDIS_URL = values["redis-url"] ?? Bun.env.IEV_REDIS_URL ?? "redis://127.0.0.1:6379/3";
const WITH_TOC = values.toc === true;
const DRY_RUN = values["dry-run"] === true;
const TOC_CONCURRENCY = Math.max(1, Number.parseInt(values.concurrency ?? "4", 10) || 4);
const LIMIT = values.limit ? Math.max(0, Number.parseInt(values.limit, 10) || 0) : 0;
const BATCH = 2000; // 1000–5000 ok ; 2000 = bon compromis latence/mémoire process.
const KP = "iev:"; // préfixe de clés (double isolation avec le db dédié).

/** Décode l'échappement appliqué côté C# (AppendEscaped) : \\ \t \n \r. */
function unescapeField(s: string): string {
	if (!s.includes("\\")) return s;
	let out = "";
	for (let i = 0; i < s.length; i++) {
		const c = s[i];
		if (c === "\\" && i + 1 < s.length) {
			const n = s[++i];
			if (n === "t") out += "\t";
			else if (n === "n") out += "\n";
			else if (n === "r") out += "\r";
			else out += n; // "\\" → "\" et tout le reste : caractère littéral.
		} else {
			out += c;
		}
	}
	return out;
}

/** Un fichier servable résolu : chemin logique, CPK porteur, taille décompressée. */
interface TreeFile {
	path: string;
	cpk: string;
	size: number;
}

/**
 * Franchit le pont .NET UNE fois : ExportTreeNdjson(game) → string NDJSON tabulé,
 * parsé en lignes `path\tcpkName\tsize`. Regroupe par CPK pour l'écriture Redis dense.
 */
function acquireTree(game: any): { byCpk: Map<string, TreeFile[]>; total: number } {
	// GameTreeExport peut ne pas être typé selon le typedef projeté → cast défensif.
	const core = iecodeCore() as any;
	const ndjson: string = core.Cdn.GameTreeExport.ExportTreeNdjson(game);

	const byCpk = new Map<string, TreeFile[]>();
	let total = 0;
	let start = 0;
	const len = ndjson.length;
	while (start < len) {
		let nl = ndjson.indexOf("\n", start);
		if (nl === -1) nl = len;
		const line = ndjson.slice(start, nl);
		start = nl + 1;
		if (!line) continue;

		const t1 = line.indexOf("\t");
		const t2 = line.indexOf("\t", t1 + 1);
		if (t1 === -1 || t2 === -1) continue;
		const path = unescapeField(line.slice(0, t1));
		const cpk = unescapeField(line.slice(t1 + 1, t2));
		const size = Number.parseInt(line.slice(t2 + 1), 10) || 0;

		let arr = byCpk.get(cpk);
		if (!arr) byCpk.set(cpk, (arr = []));
		arr.push({ path, cpk, size });
		total++;

		if (LIMIT > 0 && total >= LIMIT) break;
	}
	return { byCpk, total };
}

/** Exécute des tâches Redis (closures → Promise) par lots de BATCH (1 flush pipeline/lot). */
async function pflush(tasks: (() => Promise<unknown>)[]): Promise<void> {
	for (let i = 0; i < tasks.length; i += BATCH) {
		await Promise.all(tasks.slice(i, i + BATCH).map((task) => task()));
	}
}

async function main(): Promise<void> {
	loadIecode();
	const core = iecodeCore() as any;

	const game = new core.IEVRGame(ROOT);
	if (!game.IsValid) {
		console.log(`iev_index ok=0 error=invalid_game root=${ROOT}`);
		process.exitCode = 2;
		return;
	}

	const { byCpk, total } = acquireTree(game);
	const cpks = [...byCpk.keys()];

	// Métadonnées disque par CPK (taille du .cpk sur disque) — best-effort.
	const diskInfo = new Map<string, { path: string; size: number }>();
	for (const cpkFile of game.Cpk.GetAllCpkFiles() as Iterable<string>) {
		const name = cpkFile.split("/").pop() ?? cpkFile;
		let size = 0;
		try {
			size = Bun.file(cpkFile).size;
		} catch {
			size = 0;
		}
		diskInfo.set(name, { path: cpkFile, size });
	}

	if (DRY_RUN) {
		const sample = cpks.slice(0, 3).map((c) => `${c}:${byCpk.get(c)!.length}`).join(",");
		console.log(
			`iev_index dry_run=1 tree_files=${total} cpk=${cpks.length} toc=${WITH_TOC ? 1 : 0} ` +
				`sample=${sample || "-"} ms=${Math.round(performance.now() - t0)}`,
		);
		return;
	}

	const redis = new RedisClient(REDIS_URL, {
		connectionTimeout: 5000,
		idleTimeout: 300_000, // crawl/acquire long → évite l'idle-close (cf. db/redis.ts).
		autoReconnect: true,
		maxRetries: 10,
		enableOfflineQueue: true,
		enableAutoPipelining: true, // ESSENTIEL : Promise.all → 1 flush réseau par lot.
	});
	let closing = false; // ferméture délibérée → ne pas logguer le "connection closed".
	redis.onclose = (err?: Error) => {
		if (err && !closing) console.warn(`[iev-index] redis closed: ${err.message ?? err}`);
	};

	let redisKeys = 0;
	try {
		await redis.connect();

		// Reset propre : seul sur db dédié → FLUSHDB ne touche PAS db0/db1.
		// (JAMAIS FLUSHALL : purgerait niers + bot.)
		await redis.send("FLUSHDB", []);

		const tasks: (() => Promise<unknown>)[] = [];
		for (const cpk of cpks) {
			const files = byCpk.get(cpk)!;
			const disk = diskInfo.get(cpk);

			// 1) set de tous les CPK
			tasks.push(() => redis.sadd(`${KP}cpk:index`, cpk));
			redisKeys++; // iev:cpk:index (compté une fois suffit, mais terse)

			// 2) hash du CPK : path → size, chunké pour borner la taille de commande.
			const flat: string[] = [];
			for (const f of files) flat.push(f.path, String(f.size));
			for (let i = 0; i < flat.length; i += 4000) {
				const c = flat.slice(i, i + 4000);
				tasks.push(() => redis.hmset(`${KP}cpk:${cpk}`, c));
			}

			// 3) index inverse global path → cpkName (O(1) pour « quel CPK contient X »).
			const inv: string[] = [];
			for (const f of files) inv.push(f.path, cpk);
			for (let i = 0; i < inv.length; i += 4000) {
				const c = inv.slice(i, i + 4000);
				tasks.push(() => redis.hmset(`${KP}file:index`, c));
			}

			// 4) méta du CPK
			tasks.push(() =>
				redis.hmset(`${KP}cpk:${cpk}:meta`, [
					"disk_path",
					disk?.path ?? "",
					"file_count",
					String(files.length),
					"size",
					String(disk?.size ?? 0),
				]),
			);
		}
		await pflush(tasks);

		// 5) TOC enrichi (optionnel) : offset ABSENT (CpkFileInfo ne l'expose pas) →
		//    on stocke size(compressé):extractSize:compressed par fichier. Borné par concurrency.
		if (WITH_TOC) {
			const allCpkFiles = [...(game.Cpk.GetAllCpkFiles() as Iterable<string>)];
			for (let i = 0; i < allCpkFiles.length; i += TOC_CONCURRENCY) {
				const slice = allCpkFiles.slice(i, i + TOC_CONCURRENCY);
				await Promise.all(
					slice.map(async (cpkFile) => {
						const name = cpkFile.split("/").pop() ?? cpkFile;
						let toc: string;
						try {
							toc = core.Cdn.GameTreeExport.ExportCpkTocNdjson(game, cpkFile) as string;
						} catch {
							return; // CPK illisible : on saute, jamais de crash global.
						}
						const pairs: string[] = [];
						for (const line of toc.split("\n")) {
							if (!line) continue;
							const cols = line.split("\t");
							if (cols.length < 4) continue;
							const p = unescapeField(cols[0]!);
							// path → size:extractSize:compressed  (pas d'offset : non émis).
							pairs.push(p, `${cols[1]}:${cols[2]}:${cols[3]}`);
						}
						const tocTasks: (() => Promise<unknown>)[] = [];
						for (let j = 0; j < pairs.length; j += 4000) {
							const c = pairs.slice(j, j + 4000);
							tocTasks.push(() => redis.hmset(`${KP}cpk:${name}:toc`, c));
						}
						await pflush(tocTasks);
					}),
				);
			}
		}

		// 6) méta du scan
		const buildId = String(game.Info?.["buildId"] ?? "");
		await redis.hmset(`${KP}scan:meta`, [
			"root",
			game.GamePath,
			"gamePath",
			game.GamePath,
			"buildId",
			buildId,
			"tree_files",
			String(total),
			"cpk_total",
			String(cpks.length),
			"scanned_at",
			new Date().toISOString(),
			"source",
			"nodeapi-dotnet",
		]);

		// Nombre réel de clés top-level écrites (pour la ligne de sortie).
		const dbsize = await redis.send("DBSIZE", []);
		redisKeys = Number.parseInt(String(dbsize), 10) || redisKeys;
	} finally {
		closing = true;
		redis.close();
	}

	console.log(
		`iev_index ok=1 tree_files=${total} cpk=${cpks.length} redis_keys=${redisKeys} ` +
			`toc=${WITH_TOC ? 1 : 0} ms=${Math.round(performance.now() - t0)}`,
	);
}

try {
	await main();
} catch (error) {
	const msg = error instanceof Error ? error.message : String(error);
	console.log(`iev_index ok=0 error=${msg.replace(/\s+/g, "_").slice(0, 120)}`);
	process.exitCode = 1;
}
