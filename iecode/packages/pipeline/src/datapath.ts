/**
 * Export "DATA_PATH" : transforme un dump iecode brut en l'arborescence EXACTE
 * que `inagle push` (createInagleService, DATA_PATH) consomme.
 *
 * Contrat vérifié contre packages/inagle/src/core/{paths,data-loader,cfgbin-db}.ts
 * et /home/ubuntu/data :
 *
 *   1. PAS de préfixe `data/` (inagle lit DATA_ROOT/common/..., le dump iecode
 *      écrit data/common/... d'après cpk_list) → on strip `data/`.
 *   2. inagle lit des `.cfg.bin.json` PRÉ-DÉCODÉS :
 *        - T2B  → { entries: [...] }                 (loadConfig*)
 *        - RDBN → { version, lists:[{name,typeName,values}] }  (parsers spécialisés)
 *      Le décodeur iecode route automatiquement T2B/RDBN ; sortie byte-identique
 *      à /home/ubuntu/data. → pour chaque `<x>.cfg.bin`, on émet `<x>.cfg.bin.json`.
 *   3. Le `.cfg.bin` brut est conservé à côté (comme la référence ; lossless).
 *
 * Idempotent : un `.json` à jour (plus récent que sa source) est sauté.
 *
 * Le décodage est délégué au binaire iecode (`iecode config read <file>`), seul
 * détenteur du décodeur cfg.bin (T2B + RDBN). Pas de duplication de parsing en TS.
 *
 * NON couvert (par design, hors contrat cfg.bin — cf. DataPathExporter.cs) :
 *   all-gamedata/*.json (lus par cli-push depuis le package inagle, re-dérivés
 *   par le service), lua-decompiled/** (inutilisé par cli-push), images/menu
 *   (la DB ne stocke que des chemins, fallback déterministe).
 */
import { $ } from "bun";
import { resolveIecodeCli } from "@rose-griffon/iecode-steam-sync";
import { Glob } from "bun";
import { mkdir, stat } from "node:fs/promises";
import { dirname, join, relative } from "node:path";

export interface DataPathExportOptions {
	/** Dump iecode (`iecode dump -o <dir>`) ; on accepte avec ou sans préfixe data/. */
	inputDir: string;
	/** Racine DATA_PATH de sortie (ex. /tmp/iecode-data-export). */
	outDir: string;
	/** Ré-écrire les .json à jour. */
	force?: boolean;
	/** Copier le .cfg.bin brut à côté du .json (défaut true, comme /home/ubuntu/data). */
	copyRawCfgBin?: boolean;
	/** Parallélisme de décodage (défaut: 8). */
	concurrency?: number;
	/** Chemin du iecode.dll (défaut: build Release du monorepo). */
	cliDllPath?: string;
	onLog?: (msg: string) => void;
}

export interface DataPathExportResult {
	outDir: string;
	decoded: number;
	skipped: number;
	failed: number;
	rawCopied: number;
	otherCopied: number;
	failures: string[];
}

/** Strip un éventuel segment de tête `data/` du chemin relatif interne. */
export function stripDataPrefix(relativePath: string): string {
	const norm = relativePath.replaceAll("\\", "/").replace(/^\/+/, "");
	return norm.startsWith("data/") ? norm.slice("data/".length) : norm;
}

async function exists(p: string): Promise<boolean> {
	try {
		await stat(p);
		return true;
	} catch {
		return false;
	}
}

async function isFresh(dst: string, src: string): Promise<boolean> {
	try {
		const [d, s] = await Promise.all([stat(dst), stat(src)]);
		return d.size > 0 && d.mtimeMs >= s.mtimeMs;
	} catch {
		return false;
	}
}

/**
 * Découvre les racines `common/` à scanner : gère `<input>/common` (dump strippé
 * ou install /data) ET `<input>/data/common` (dump iecode brut).
 */
async function findScanRoots(inputDir: string): Promise<string[]> {
	const roots: string[] = [];
	if (await exists(join(inputDir, "common"))) roots.push(inputDir);
	if (await exists(join(inputDir, "data", "common"))) roots.push(join(inputDir, "data"));
	return roots;
}

export async function exportDataPath(
	options: DataPathExportOptions
): Promise<DataPathExportResult> {
	const log = options.onLog ?? (() => {});
	const cli = options.cliDllPath ?? resolveIecodeCli();
	const copyRaw = options.copyRawCfgBin ?? true;
	const concurrency = Math.max(1, options.concurrency ?? 8);

	if (!(await exists(options.inputDir))) {
		throw new Error(`inputDir introuvable : ${options.inputDir}`);
	}
	await mkdir(options.outDir, { recursive: true });

	const scanRoots = await findScanRoots(options.inputDir);
	if (scanRoots.length === 0) {
		throw new Error(`Aucun dossier common/ sous ${options.inputDir} — est-ce un dump iecode ?`);
	}

	// Énumère seulement common/** (gamedata + text) : c'est tout ce que DATA_PATH expose.
	const cfgBins: string[] = [];
	const loose: string[] = [];
	for (const root of scanRoots) {
		const glob = new Glob("common/**/*");
		for await (const rel of glob.scan({ cwd: root, onlyFiles: true })) {
			const abs = join(root, rel);
			if (abs.endsWith(".cfg.bin.json")) continue; // ignore .json en entrée (régénérés)
			if (abs.endsWith(".cfg.bin")) cfgBins.push(abs);
			else loose.push(abs);
		}
	}

	const res: DataPathExportResult = {
		outDir: options.outDir,
		decoded: 0,
		skipped: 0,
		failed: 0,
		rawCopied: 0,
		otherCopied: 0,
		failures: [],
	};

	// Copie des fichiers loose (textes .lua, etc.), strip data/.
	for (const src of loose) {
		const root = scanRoots.find((r) => src.startsWith(r))!;
		const rel = stripDataPrefix(relative(root, src));
		const dst = join(options.outDir, rel);
		if (options.force || !(await isFresh(dst, src))) {
			await mkdir(dirname(dst), { recursive: true });
			await Bun.write(dst, Bun.file(src));
			res.otherCopied++;
		}
	}

	log(`▸ datapath: ${cfgBins.length} cfg.bin à décoder, ${loose.length} loose`);

	// Décodage parallèle borné.
	let idx = 0;
	async function worker(): Promise<void> {
		while (idx < cfgBins.length) {
			const myIdx = idx++;
			const src = cfgBins[myIdx]!;
			const root = scanRoots.find((r) => src.startsWith(r))!;
			const rel = stripDataPrefix(relative(root, src));
			const dstBin = join(options.outDir, rel);
			const dstJson = `${dstBin}.json`;
			await mkdir(dirname(dstJson), { recursive: true });

			if (copyRaw && (options.force || !(await isFresh(dstBin, src)))) {
				await Bun.write(dstBin, Bun.file(src));
				res.rawCopied++;
			}

			if (!options.force && (await isFresh(dstJson, src))) {
				res.skipped++;
				continue;
			}

			try {
				// Décodeur universel iecode : route T2B→{entries} / RDBN→{version,lists}.
				const out = await $`dotnet ${cli} config read ${src}`.quiet().text();
				await Bun.write(dstJson, out);
				res.decoded++;
			} catch (e) {
				res.failed++;
				res.failures.push(`${rel}: ${(e as Error).message}`);
				try {
					if (await exists(dstJson)) await Bun.file(dstJson).delete();
				} catch {
					/* ignore */
				}
			}
		}
	}

	await Promise.all(Array.from({ length: concurrency }, () => worker()));

	log(
		`✓ datapath: ${res.decoded} décodés, ${res.skipped} à jour, ${res.failed} échecs → ${options.outDir}`
	);
	return res;
}
