#!/usr/bin/env bun
/**
 * index-textures-to-redis — pousse un manifeste d'EN-TÊTES de textures G4TX du jeu IEVR
 * dans Redis (dimensions/format/mips), SANS jamais décoder un pixel.
 *
 * Chaîne : IECODE.Core (.NET) via node-api-dotnet → ExportTextureHeadersNdjson (UN seul
 * franchissement du pont : octets extraits EN MÉMOIRE par CdnFileService, en-tête G4TX lu
 * par G4txParser sans décompression) → NDJSON `path\twidth\theight\tformat\tmips` →
 * parsing Bun → pipeline Redis (auto-pipelining, batch ~2000).
 *
 * Modèle de clés (préfixe `iev:`, identique à index-game-to-redis) :
 *   - iev:tex:<path>              hash {width,height,format,mips}   (1 conteneur .g4tx)
 *   - iev:tex:index              set des chemins .g4tx indexés
 *   - iev:tex:meta               hash méta du scan (root, build, compteurs, date)
 * Un conteneur atlas multi-textures : on indexe la texture principale (index 0) dans le
 * hash du chemin, et on stocke le nombre total de textures décodées dans `textures` ;
 * c'est l'en-tête servable pour ce `.g4tx` (mêmes dimensions de mip-0 pleine résolution).
 *
 * Isolation : db DÉDIÉ (défaut db3) + préfixe `iev:` — ne touche JAMAIS db0 (niers) ni
 * db1 (bot). Le db se choisit UNIQUEMENT via le numéro en fin d'URL (jamais SELECT, qui
 * désactive l'auto-pipelining). Idempotent : HSET/SADD écrasent/dédupliquent. On ne fait
 * PAS de FLUSHDB ici (le manifeste textures coexiste avec l'index arbre/CPK déjà poussé) ;
 * on supprime seulement nos propres clés `iev:tex:*` avant ré-écriture.
 *
 * Sortie = UNE ligne terse `clé=val` (convention CLI agent).
 *
 *   bun scripts/index-textures-to-redis.ts [--root <dir>] [--redis-url <url>]
 *       [--limit N] [--dry-run]
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
		limit: { type: "string" },
		"dry-run": { type: "boolean", default: false },
	},
});

const ROOT = values.root ?? "/home/ubuntu/.local/share/Steam/iecode/inazuma";
// db DÉDIÉ db3 par défaut (REDIS_URL global = db0 → on NE le réutilise PAS tel quel).
const REDIS_URL = values["redis-url"] ?? Bun.env.IEV_REDIS_URL ?? "redis://127.0.0.1:6379/3";
const DRY_RUN = values["dry-run"] === true;
// limit = nombre de conteneurs .g4tx traités (-1 = illimité côté C#).
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

/** En-tête d'une texture G4TX : conteneur + dimensions + format + mips. */
interface TexHeader {
	path: string;
	width: number;
	height: number;
	format: number;
	mips: number;
}

/** Manifeste agrégé par conteneur .g4tx (texture principale + compte total). */
interface TexEntry {
	path: string;
	width: number;
	height: number;
	format: number;
	mips: number;
	textures: number; // nb de textures décodées dans ce conteneur (>=1)
}

/**
 * Franchit le pont .NET UNE fois : ExportTextureHeadersNdjson(game, limit) → string NDJSON
 * tabulé, parsé en lignes `path\twidth\theight\tformat\tmips`. Agrège par conteneur :
 * la 1re ligne d'un chemin = texture principale (mip-0 pleine résolution) ; les lignes
 * suivantes du même chemin incrémentent juste le compteur `textures`.
 */
function acquireHeaders(game: unknown): { byPath: Map<string, TexEntry>; rows: number } {
	const core = iecodeCore() as any;
	const ndjson: string = core.Cdn.TextureManifestExport.ExportTextureHeadersNdjson(game, LIMIT > 0 ? LIMIT : -1);

	const byPath = new Map<string, TexEntry>();
	let rows = 0;
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
		const t3 = line.indexOf("\t", t2 + 1);
		const t4 = line.indexOf("\t", t3 + 1);
		if (t1 === -1 || t2 === -1 || t3 === -1 || t4 === -1) continue;

		const h: TexHeader = {
			path: unescapeField(line.slice(0, t1)),
			width: Number.parseInt(line.slice(t1 + 1, t2), 10) || 0,
			height: Number.parseInt(line.slice(t2 + 1, t3), 10) || 0,
			format: Number.parseInt(line.slice(t3 + 1, t4), 10) || 0,
			mips: Number.parseInt(line.slice(t4 + 1), 10) || 0,
		};
		rows++;

		const existing = byPath.get(h.path);
		if (!existing) {
			byPath.set(h.path, {
				path: h.path,
				width: h.width,
				height: h.height,
				format: h.format,
				mips: h.mips,
				textures: 1,
			});
		} else {
			existing.textures++; // atlas multi-textures : on garde la principale, on compte le reste.
		}
	}
	return { byPath, rows };
}

async function main(): Promise<void> {
	loadIecode();
	const core = iecodeCore() as any;

	const game = new core.IEVRGame(ROOT);
	if (!game.IsValid) {
		console.log(`iev_tex ok=0 error=invalid_game root=${ROOT}`);
		process.exitCode = 2;
		return;
	}

	const { byPath, rows } = acquireHeaders(game);
	const entries = [...byPath.values()];

	if (DRY_RUN) {
		const sample = entries
			.slice(0, 3)
			.map((e) => `${e.path.split("/").pop()}:${e.width}x${e.height}`)
			.join(",");
		console.log(
			`iev_tex dry_run=1 textures_decoded=${rows} g4tx_total=${entries.length} ` +
				`sample=${sample || "-"} ms=${Math.round(performance.now() - t0)}`,
		);
		return;
	}

	let redis: RedisClient | null = null;
	let closing = false;
	let redisKeys = 0;

	try {
		redis = new RedisClient(REDIS_URL, {
			connectionTimeout: 5000,
			idleTimeout: 300_000,
			autoReconnect: true,
			maxRetries: 10,
			enableOfflineQueue: true,
			enableAutoPipelining: true,
		});
		redis.onclose = (err?: Error) => {
			if (err && !closing) console.warn(`[iev-tex] redis closed: ${err.message ?? err}`);
		};

		await redis.connect();

		// Réinitialisation CIBLÉE de nos propres clés (jamais FLUSHDB : le manifeste textures
		// coexiste avec l'index arbre/CPK dans le même db dédié). On supprime l'ancien set/méta
		// et tous les iev:tex:<path> de l'index précédent avant ré-écriture idempotente.
		const oldPaths = (await redis.send("SMEMBERS", [`${KP}tex:index`])) as string[] | null;
		if (oldPaths && oldPaths.length > 0) {
			for (let i = 0; i < oldPaths.length; i += BATCH) {
				const c = oldPaths.slice(i, i + BATCH).map((p) => `${KP}tex:${p}`);
				await redis.send("DEL", c);
			}
		}
		await redis.send("DEL", [`${KP}tex:index`, `${KP}tex:meta`]);

		let batchTasks: (() => Promise<unknown>)[] = [];
		const pushTask = async (task: () => Promise<unknown>) => {
			batchTasks.push(task);
			if (batchTasks.length >= BATCH) {
				await Promise.all(batchTasks.map((t) => t()));
				batchTasks.length = 0;
			}
		};
		const flushTasks = async () => {
			if (batchTasks.length > 0) {
				await Promise.all(batchTasks.map((t) => t()));
				batchTasks.length = 0;
			}
		};

		// Le set index : ajouté par lots pour borner la taille de commande SADD.
		const indexBatch: string[] = [];
		const flushIndex = async () => {
			if (indexBatch.length > 0) {
				const c = indexBatch.splice(0, indexBatch.length);
				await redis!.send("SADD", [`${KP}tex:index`, ...c]);
			}
		};

		for (const e of entries) {
			// 1) hash de l'en-tête de la texture par conteneur .g4tx.
			await pushTask(() =>
				redis!.send("HMSET", [
					`${KP}tex:${e.path}`,
					"width",
					String(e.width),
					"height",
					String(e.height),
					"format",
					String(e.format),
					"mips",
					String(e.mips),
					"textures",
					String(e.textures),
				]),
			);
			// 2) set des chemins indexés.
			indexBatch.push(e.path);
			if (indexBatch.length >= 4000) await flushIndex();
		}
		await flushTasks();
		await flushIndex();

		// 3) méta du scan textures.
		const buildId = String(game.Info?.["buildId"] ?? "");
		await redis.send("HMSET", [
			`${KP}tex:meta`,
			"root",
			game.GamePath,
			"gamePath",
			game.GamePath,
			"buildId",
			buildId,
			"textures_decoded",
			String(rows),
			"g4tx_total",
			String(entries.length),
			"limit",
			String(LIMIT),
			"scanned_at",
			new Date().toISOString(),
			"source",
			"nodeapi-dotnet:G4txParser",
		]);

		// Nombre réel de clés top-level de notre namespace tex (set + meta + 1 hash/conteneur).
		redisKeys = entries.length + 2;
	} finally {
		closing = true;
		if (redis) redis.close();
	}

	console.log(
		`iev_tex ok=1 textures_decoded=${rows} g4tx_total=${entries.length} ` +
			`redis_keys=${redisKeys} ms=${Math.round(performance.now() - t0)}`,
	);
}

try {
	await main();
} catch (error) {
	const msg = error instanceof Error ? error.message : String(error);
	console.log(`iev_tex ok=0 error=${msg.replace(/\s+/g, "_").slice(0, 120)}`);
	process.exitCode = 1;
}
