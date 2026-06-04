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
import * as path from "node:path";
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

	let redis: RedisClient | null = null;
	let redis2: RedisClient | null = null;
	let closing1 = false;
	let closing2 = false;
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
			if (err && !closing1) console.warn(`[iev-index] redis closed: ${err.message ?? err}`);
		};

		await redis.connect();

		// Reset propre : seul sur db dédié → FLUSHDB ne touche PAS db0/db1.
		// (JAMAIS FLUSHALL : purgerait niers + bot.)
		await redis.send("FLUSHDB", []);

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

		for (const cpk of cpks) {
			const files = byCpk.get(cpk)!;
			const disk = diskInfo.get(cpk);

			// 1) set de tous les CPK
			await pushTask(() => redis!.send("SADD", [`${KP}cpk:index`, cpk]));
			redisKeys++; // iev:cpk:index (compté une fois suffit, mais terse)

			// 2) hash du CPK : path → size, chunké pour borner la taille de commande.
			const flat: string[] = [];
			for (const f of files) flat.push(f.path, String(f.size));
			for (let i = 0; i < flat.length; i += 4000) {
				const c = flat.slice(i, i + 4000);
				await pushTask(() => redis!.send("HMSET", [`${KP}cpk:${cpk}`, ...c]));
			}

			// 3) index inverse global path → cpkName (O(1) pour « quel CPK contient X »).
			const inv: string[] = [];
			for (const f of files) inv.push(f.path, cpk);
			for (let i = 0; i < inv.length; i += 4000) {
				const c = inv.slice(i, i + 4000);
				await pushTask(() => redis!.send("HMSET", [`${KP}file:index`, ...c]));
			}

			// 4) méta du CPK
			await pushTask(() =>
				redis!.send("HMSET", [
					`${KP}cpk:${cpk}:meta`,
					"disk_path",
					disk?.path ?? "",
					"file_count",
					String(files.length),
					"size",
					String(disk?.size ?? 0),
				]),
			);
		}
		await flushTasks();

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
							tocTasks.push(() => redis!.send("HMSET", [`${KP}cpk:${name}:toc`, ...c]));
						}
						await pflush(tocTasks);
					}),
				);
			}
		}

		closing1 = true;
		redis.close();

		// === INDEXATION 3D INTÉLLIGENTE ET RÉCURSIVE ===
		console.info("▸ Indexation 3D et Avatar...");
		const toHex = (n: number) => "0x" + (n >>> 0).toString(16).toUpperCase().padStart(8, "0");
		const resolveGamedataFile = (baseName: string): string => {
			const dir = "/home/ubuntu/niers/data/common/gamedata/character";
			const fs = require("node:fs");
			const files = fs.readdirSync(dir);
			const versionedRe = new RegExp("^" + baseName + "_\\d[\\d.]*\\.cfg\\.bin\\.json$");
			const matches = files.filter((f: string) => versionedRe.test(f));
			if (matches.length === 0) {
				// Repli : sans version
				const exact = baseName + ".cfg.bin.json";
				if (files.includes(exact)) {
					return path.join(dir, exact);
				}
				throw new Error(`Fichier gamedata introuvable pour ${baseName}`);
			}
			matches.sort();
			return path.join(dir, matches[matches.length - 1]);
		};

		// Fonction récursive pour traverser l'arbre cfg.bin.json
		const walkNodes = (nodes: any[], namePrefix: string, cb: (node: any) => void) => {
			for (const node of nodes || []) {
				if (node.name && node.name.startsWith(namePrefix)) {
					cb(node);
				}
				if (node.children && node.children.length > 0) {
					walkNodes(node.children, namePrefix, cb);
				}
			}
		};

		// 1. Lire chara_base pour lier charaId -> internalCode
		const charaBaseFilePath = resolveGamedataFile("chara_base");
		const charaBaseData = JSON.parse(await Bun.file(charaBaseFilePath).text());
		console.info(`[debug] chara_base file: ${charaBaseFilePath}, entries: ${charaBaseData.entries?.length}`);
		const charaIdToCode = new Map<string, string>();
		walkNodes(charaBaseData.entries, "CHARA_BASE_", (entry) => {
			if (entry.name.startsWith("CHARA_BASE_INFO_") || entry.name.startsWith("CHARA_BASE_BATTLE_")) {
				const idVar = entry.variables[0];
				const codeVar = entry.variables[1];
				if (idVar && codeVar && idVar.type === "Int" && codeVar.type === "String") {
					const charaId = toHex(parseInt(idVar.value, 10));
					charaIdToCode.set(charaId, codeVar.value);
				}
			}
		});
		console.info(`[debug] charaIdToCode size: ${charaIdToCode.size}`);

		// 2. Indexer les fichiers 3D (G4MD/G4MG/G4TX) par code de personnage
		const allTreeFiles = cpks.flatMap(c => byCpk.get(c)!);
		const g4mdPaths = allTreeFiles.filter(f => f.path.toLowerCase().endsWith(".g4md"));
		const g4txPaths = allTreeFiles.filter(f => f.path.toLowerCase().endsWith(".g4tx"));
		const allPaths = new Set(allTreeFiles.map(f => f.path));

		// Pré-grouper les textures par leur dossier parent
		const texturesByDir = new Map<string, string[]>();
		for (const tx of g4txPaths) {
			const p = tx.path.toLowerCase();
			const idx = p.lastIndexOf("/");
			if (idx !== -1) {
				const dir = p.substring(0, idx);
				let arr = texturesByDir.get(dir);
				if (!arr) {
					arr = [];
					texturesByDir.set(dir, arr);
				}
				arr.push(tx.path);
			}
		}

		// 3. Lire chara_model pour lier charaId -> modèles 3D (visage, uniforme, etc.)
		const charaModelFilePath = resolveGamedataFile("chara_model");
		const charaModelData = JSON.parse(await Bun.file(charaModelFilePath).text());
		console.info(`[debug] chara_model file: ${charaModelFilePath}, entries: ${charaModelData.entries?.length}`);
		console.info("[debug] chara_model roots:", charaModelData.entries?.map((e: any) => e.name));
		let modelCount = 0;
		const charaModelTasks: (() => Promise<unknown>)[] = [];
		walkNodes(charaModelData.entries, "CHARA_MODEL_INFO_", (entry) => {
			modelCount++;
			const idVar = entry.variables[0];
			const faceVar = entry.variables[1];
			if (idVar && idVar.type === "Int") {
				const charaId = toHex(parseInt(idVar.value, 10));
				const code = charaIdToCode.get(charaId) || "";

				const faceRelPath = faceVar && faceVar.type === "String" ? faceVar.value : "";
				let faceG4mdPath = "";
				let faceG4mgPath = "";

				if (faceRelPath) {
					faceG4mdPath = ("data/common/chr/" + faceRelPath.replace(".objbin", ".g4md")).toLowerCase();
					faceG4mgPath = faceG4mdPath.replace(".g4md", ".g4mg");
				}

				const faceG4mdExists = faceG4mdPath ? allPaths.has(faceG4mdPath) : false;
				const faceG4mgExists = faceG4mgPath ? allPaths.has(faceG4mgPath) : false;

				// Trouver les textures du visage associées (dossier parent commun)
				const faceDir = faceG4mdPath ? faceG4mdPath.substring(0, faceG4mdPath.lastIndexOf("/")) : "";
				const associatedTextures = faceDir ? (texturesByDir.get(faceDir) || []) : [];

				const modelInfo = [
					"internal_code", code,
					"face_g4md", faceG4mdExists ? faceG4mdPath : "",
					"face_g4mg", faceG4mgExists ? faceG4mgPath : "",
				];

				charaModelTasks.push(() => redis2!.send("HMSET", [`${KP}chara:${charaId}:model`, ...modelInfo]));
				if (associatedTextures.length > 0) {
					const chunkedTextures = associatedTextures.slice(0, 1000); // Éviter des commandes Redis trop grandes
					charaModelTasks.push(() => redis2!.send("SADD", [`${KP}chara:${charaId}:textures`, ...chunkedTextures]));
				}
			}
		});
		console.info(`[debug] walkNodes chara_model count: ${modelCount}`);

		// Initialiser la seconde connexion Redis pour la phase 3D/Avatar
		redis2 = new RedisClient(REDIS_URL, {
			connectionTimeout: 5000,
			idleTimeout: 300_000,
			autoReconnect: true,
			maxRetries: 10,
			enableOfflineQueue: true,
			enableAutoPipelining: true,
		});
		redis2.onclose = (err?: Error) => {
			if (err && !closing2) console.warn(`[iev-index] redis2 closed: ${err.message ?? err}`);
		};
		await redis2.connect();

		let batchTasks2: (() => Promise<unknown>)[] = [];
		const pushTask2 = async (task: () => Promise<unknown>) => {
			batchTasks2.push(task);
			if (batchTasks2.length >= BATCH) {
				await Promise.all(batchTasks2.map((t) => t()));
				batchTasks2.length = 0;
			}
		};
		const flushTasks2 = async () => {
			if (batchTasks2.length > 0) {
				await Promise.all(batchTasks2.map((t) => t()));
				batchTasks2.length = 0;
			}
		};

		for (const task of charaModelTasks) {
			await pushTask2(task);
		}

		// 4. Indexer la Création d'Avatar (chara_edit et chara_edit_parts_type_config)
		const charaEditFilePath = resolveGamedataFile("chara_edit");
		const charaEditData = JSON.parse(await Bun.file(charaEditFilePath).text());
		console.info(`[debug] chara_edit file: ${charaEditFilePath}, lists: ${charaEditData.lists?.length}`);
		const partsDataList = charaEditData.lists.find((l: any) => l.name === "m_CharaEditPartsDataList")?.values || [];
		console.info(`[debug] partsDataList count: ${partsDataList.length}`);

		for (const part of partsDataList) {
			const partId = part.id;
			const resName1 = part.resourceNameStr1 || "";
			const resName2 = part.resourceNameStr2 || "";

			let g4mdPath = "";
			let g4mgPath = "";
			if (resName1) {
				const found = g4mdPaths.find(f => f.path.toLowerCase().endsWith(`/${resName1.toLowerCase()}.g4md`));
				if (found) {
					g4mdPath = found.path;
					g4mgPath = g4mdPath.replace(".g4md", ".g4mg");
				}
			}

			let textures: string[] = [];
			if (g4mdPath) {
				const partDir = g4mdPath.substring(0, g4mdPath.lastIndexOf("/"));
				textures = texturesByDir.get(partDir) || [];
			}

			const partInfo = {
				id: partId,
				gender: part.gender,
				resourceName1: resName1,
				resourceName2: resName2,
				g4md: g4mdPath,
				g4mg: g4mgPath,
				textures,
			};
			await pushTask2(() => redis2!.send("HSET", [`${KP}avatar:parts`, partId, JSON.stringify(partInfo)]));
		}
		await flushTasks2();

		// 5. Indexer les catégories d'UI d'édition
		const partsInfoList = charaEditData.lists.find((l: any) => l.name === "m_CharaEditPartsInfoList")?.values || [];
		await redis2!.send("SET", [`${KP}avatar:configs:parts_info`, JSON.stringify(partsInfoList)]);

		const partsTypeFilePath = resolveGamedataFile("chara_edit_parts_type_config");
		const partsTypeData = JSON.parse(await Bun.file(partsTypeFilePath).text());
		await redis2!.send("SET", [`${KP}avatar:configs:parts_type`, JSON.stringify(partsTypeData.lists)]);

		// 6. Indexer les scripts Lua d'avatar
		const fs = require("node:fs");
		const luaDir = "/home/ubuntu/niers/data/lua_scripts/decompiled/p0-critical";
		if (fs.existsSync(luaDir)) {
			const luaFiles = fs.readdirSync(luaDir).filter((f: string) => f.startsWith("chara_edit_parts_menu_") && f.endsWith(".lua"));
			for (const f of luaFiles) {
				const content = await Bun.file(path.join(luaDir, f)).text();
				await redis2!.send("HSET", [`${KP}avatar:lua`, f, content]);
			}
		}

		// 7) méta du scan
		const buildId = String(game.Info?.["buildId"] ?? "");
		await redis2!.send("HMSET", [
			`${KP}scan:meta`,
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
		const dbsize = await redis2!.send("DBSIZE", []);
		redisKeys = Number.parseInt(String(dbsize), 10) || redisKeys;
	} finally {
		closing1 = true;
		closing2 = true;
		if (redis) redis.close();
		if (redis2) redis2.close();
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
