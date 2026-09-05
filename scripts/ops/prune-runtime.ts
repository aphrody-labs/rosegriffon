#!/usr/bin/env bun
/**
 * Libère de l'espace uniquement dans les caches explicitement régénérables.
 *
 * Par défaut le serveur modèle doit être arrêté : supprimer un GLB pendant
 * qu'il est assemblé rendrait le résultat non déterministe. Le chemin accepté
 * est volontairement borné à niers/var/model-cache. La cible debug de Cargo est
 * également admise, mais uniquement avec --prune-debug-target et après une
 * vérification des exécutables actifs.
 */

import { readdir, readlink, rm, stat } from "node:fs/promises";
import { resolve } from "node:path";

const NIERS_ROOT = "/home/ubuntu/niers";
const MODEL_CACHE = `${NIERS_ROOT}/var/model-cache`;
const DEBUG_TARGET = `${NIERS_ROOT}/target/debug`;
const MODEL_SERVICE = "nie-model-serve.service";

interface Candidate {
	path: string;
	bytes: number;
	mtimeMs: number;
}

interface Options {
	cacheDir: string;
	maxBytes: number;
	minAgeMs: number;
	dryRun: boolean;
	allowActive: boolean;
	pruneDebugTarget: boolean;
}

function fail(message: string): never {
	throw new Error(message);
}

async function command(args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
	const child = Bun.spawn(args, { stdout: "pipe", stderr: "pipe" });
	const [stdout, stderr] = await Promise.all([
		new Response(child.stdout).text(),
		new Response(child.stderr).text(),
	]);
	return { code: await child.exited, stdout, stderr };
}

async function serviceActive(): Promise<boolean> {
	const result = await command(["systemctl", "is-active", "--quiet", MODEL_SERVICE]);
	return result.code === 0;
}

function parsePositive(value: string, label: string): number {
	const parsed = Number(value);
	if (!Number.isFinite(parsed) || parsed < 0) fail(`${label} invalide : ${value}`);
	return parsed;
}

function parseArgs(argv: string[]): Options {
	const options: Options = {
		cacheDir: MODEL_CACHE,
		maxBytes: 6 * 1024 ** 3,
		minAgeMs: 24 * 60 * 60 * 1000,
		dryRun: false,
		allowActive: false,
		pruneDebugTarget: false,
	};
	for (let index = 0; index < argv.length; index += 1) {
		const argument = argv[index] as string;
		const value = (name: string): string => {
			const prefix = `--${name}=`;
			if (argument.startsWith(prefix)) return argument.slice(prefix.length);
			const next = argv[index + 1];
			if (!next || next.startsWith("--")) fail(`valeur manquante pour --${name}`);
			index += 1;
			return next;
		};
		if (argument === "--dry-run") options.dryRun = true;
		else if (argument === "--allow-active") options.allowActive = true;
		else if (argument === "--prune-debug-target") options.pruneDebugTarget = true;
		else if (argument === "--cache-dir" || argument.startsWith("--cache-dir=")) {
			options.cacheDir = resolve(value("cache-dir"));
		} else if (argument === "--max-gib" || argument.startsWith("--max-gib=")) {
			options.maxBytes = parsePositive(value("max-gib"), "--max-gib") * 1024 ** 3;
		} else if (argument === "--min-age-hours" || argument.startsWith("--min-age-hours=")) {
			options.minAgeMs = parsePositive(value("min-age-hours"), "--min-age-hours") * 60 * 60 * 1000;
		} else if (argument === "--help" || argument === "-h") {
			process.stdout.write(USAGE);
			process.exit(0);
		} else fail(`option inconnue : ${argument}`);
	}
	if (options.cacheDir !== MODEL_CACHE) {
		fail(`cache refusé : seul ${MODEL_CACHE} est régénérable`);
	}
	return options;
}

async function walk(root: string, directory = root): Promise<Candidate[]> {
	const entries = await readdir(directory, { withFileTypes: true });
	const candidates: Candidate[] = [];
	for (const entry of entries) {
		const path = `${directory}/${entry.name}`;
		if (entry.isSymbolicLink()) continue;
		if (entry.isDirectory()) {
			candidates.push(...(await walk(root, path)));
			continue;
		}
		if (!entry.isFile() || entry.name === "VERSION") continue;
		const metadata = await stat(path);
		candidates.push({ path, bytes: metadata.size, mtimeMs: metadata.mtimeMs });
	}
	return candidates;
}

async function activeExecutablesUnder(root: string): Promise<string[]> {
	const matches: string[] = [];
	for (const processEntry of await readdir("/proc", { withFileTypes: true })) {
		if (!processEntry.isDirectory() || !/^\d+$/u.test(processEntry.name)) continue;
		const executable = await readlink(`/proc/${processEntry.name}/exe`).catch(() => "");
		if (executable === root || executable.startsWith(`${root}/`)) {
			matches.push(`${processEntry.name}:${executable}`);
		}
	}
	return matches;
}

async function pruneCache(options: Options): Promise<void> {
	const info = await stat(options.cacheDir).catch(() => undefined);
	if (!info?.isDirectory()) fail(`cache absent : ${options.cacheDir}`);
	if (!options.allowActive && (await serviceActive())) {
		fail(`${MODEL_SERVICE} est actif : arrêtez-le avant la purge (ou --allow-active explicite)`);
	}
	const now = Date.now();
	const all = await walk(options.cacheDir);
	let total = all.reduce((sum, file) => sum + file.bytes, 0);
	const eligible = all
		.filter((file) => now - file.mtimeMs >= options.minAgeMs)
		.sort((left, right) => left.mtimeMs - right.mtimeMs);
	const remove: Candidate[] = [];
	for (const file of eligible) {
		if (total <= options.maxBytes) break;
		remove.push(file);
		total -= file.bytes;
	}
	for (const file of remove) {
		if (options.dryRun)
			console.log(`prévu: ${file.path} (${(file.bytes / 1024 ** 2).toFixed(1)} Mio)`);
		else await rm(file.path, { force: true });
	}
	console.log(
		`${options.dryRun ? "simulation" : "purge"}: ${remove.length} fichier(s), ` +
			`${(remove.reduce((sum, file) => sum + file.bytes, 0) / 1024 ** 3).toFixed(2)} Gio ` +
			`— reste estimé ${(total / 1024 ** 3).toFixed(2)} Gio`
	);
}

async function pruneDebug(options: Options): Promise<void> {
	if (!options.pruneDebugTarget) return;
	const info = await stat(DEBUG_TARGET).catch(() => undefined);
	if (!info?.isDirectory()) {
		console.log(`cible debug absente : ${DEBUG_TARGET}`);
		return;
	}
	const active = await activeExecutablesUnder(DEBUG_TARGET);
	if (active.length) fail(`exécutable actif sous ${DEBUG_TARGET} : ${active.join(", ")}`);
	if (options.dryRun) console.log(`simulation: suppression de ${DEBUG_TARGET}`);
	else {
		await rm(DEBUG_TARGET, { recursive: true, force: true });
		console.log(`supprimé: ${DEBUG_TARGET} (artefacts Cargo debug régénérables)`);
	}
}

const USAGE = `Usage : bun scripts/ops/prune-runtime.ts [options]

  --max-gib <n>          taille maximale du cache modèle (défaut : 6)
  --min-age-hours <n>    âge minimal des fichiers (défaut : 24)
  --cache-dir <chemin>   uniquement niers/var/model-cache
  --prune-debug-target   retire niers/target/debug après garde /proc
  --allow-active         autorise une purge pendant que nie-model-serve tourne
  --dry-run              montre les suppressions sans écrire
`;

const exitCode = await (async () => {
	try {
		const options = parseArgs(process.argv.slice(2));
		if (!options.allowActive && (await serviceActive()) && options.pruneDebugTarget) {
			fail(`${MODEL_SERVICE} est actif : la cible debug ne sera pas touchée par précaution`);
		}
		await pruneCache(options);
		await pruneDebug(options);
		return 0;
	} catch (error) {
		console.error(`✗ ${error instanceof Error ? error.message : String(error)}`);
		return 1;
	}
})();
process.exit(exitCode);
