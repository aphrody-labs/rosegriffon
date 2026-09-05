#!/usr/bin/env bun
/**
 * Release coordonnée RG/Niers.
 *
 * Les deux dépôts restent séparés, mais une publication suit un seul ordre :
 * synchronisation Git → données/manifests → formats → WASM → serveur modèle →
 * migrations de miroir → gates Azalée → build bleu/vert → nginx/CDN → sondes.
 * Le mode par défaut est la vérification. Une mutation exige --apply (ou un
 * mode preview/deploy/promote explicite) et chaque commande est un argv séparé,
 * jamais une chaîne shell fournie par l'environnement.
 */

import { stat } from "node:fs/promises";
import { resolve } from "node:path";

type Mode = "check" | "preview" | "deploy" | "promote";

interface Options {
	mode: Mode;
	rgRoot: string;
	niersRoot: string;
	push: boolean;
	sync: boolean;
	data: boolean;
	formats: boolean;
	wasm: boolean;
	model: boolean;
	azalee: boolean;
	mirror: boolean;
	cdn: boolean;
	nginx: boolean;
	dryRun: boolean;
}

interface StepResult {
	id: string;
	ok: boolean;
	skipped?: boolean;
	durationMs: number;
	detail?: string;
}

const RG_ROOT = process.env.RG_ROOT ?? "/home/ubuntu/rg";
const NIERS_ROOT = process.env.NIERS_ROOT ?? "/home/ubuntu/niers";
const BUN = process.env.BUN_BIN ?? "/home/ubuntu/.bun/bin/bun";
const ROOT = resolve(import.meta.dir, "../..");
const SYNC_SCRIPT = `${ROOT}/scripts/ops/repo-sync.ts`;
const INVALIDATE_SCRIPT = `${ROOT}/scripts/ops/invalidate-cdn.ts`;
const CURL_PROBE = [
	"curl",
	"--fail",
	"--silent",
	"--show-error",
	"--connect-timeout",
	"2",
	"--max-time",
	"15",
	"--retry",
	"5",
	"--retry-delay",
	"2",
	"--retry-connrefused",
];
const probe = (url: string): string[] => [...CURL_PROBE, url];

function fail(message: string): never {
	throw new Error(message);
}

function value(argv: string[], index: number, name: string): [string, number] {
	const argument = argv[index] as string;
	const prefix = `--${name}=`;
	if (argument.startsWith(prefix)) return [argument.slice(prefix.length), index];
	const next = argv[index + 1];
	if (!next || next.startsWith("--")) fail(`valeur manquante pour --${name}`);
	return [next, index + 1];
}

function parseArgs(argv: string[]): Options {
	const options: Options = {
		mode: "check",
		rgRoot: process.env.RG_ROOT ?? RG_ROOT,
		niersRoot: process.env.NIERS_ROOT ?? NIERS_ROOT,
		push: false,
		sync: true,
		data: true,
		formats: true,
		wasm: true,
		model: true,
		azalee: true,
		mirror: true,
		cdn: true,
		nginx: true,
		dryRun: false,
	};
	for (let index = 0; index < argv.length; index += 1) {
		const argument = argv[index] as string;
		if (argument === "--apply") options.mode = "deploy";
		else if (argument === "--preview") options.mode = "preview";
		else if (argument === "--deploy") options.mode = "deploy";
		else if (argument === "--promote") options.mode = "promote";
		else if (argument === "--push") options.push = true;
		else if (argument === "--no-sync") options.sync = false;
		else if (argument === "--skip-data") options.data = false;
		else if (argument === "--skip-formats") options.formats = false;
		else if (argument === "--skip-wasm") options.wasm = false;
		else if (argument === "--skip-model") options.model = false;
		else if (argument === "--skip-azalee") options.azalee = false;
		else if (argument === "--skip-mirror") options.mirror = false;
		else if (argument === "--skip-cdn") options.cdn = false;
		else if (argument === "--skip-nginx") options.nginx = false;
		else if (argument === "--dry-run") options.dryRun = true;
		else if (argument === "--mode" || argument.startsWith("--mode=")) {
			const [mode, next] = value(argv, index, "mode");
			if (!["check", "preview", "deploy", "promote"].includes(mode)) fail(`mode inconnu : ${mode}`);
			options.mode = mode as Mode;
			index = next;
		} else if (argument === "--rg-root" || argument.startsWith("--rg-root=")) {
			const [root, next] = value(argv, index, "rg-root");
			options.rgRoot = resolve(root);
			index = next;
		} else if (argument === "--niers-root" || argument.startsWith("--niers-root=")) {
			const [root, next] = value(argv, index, "niers-root");
			(options as Options & { niersRoot: string }).niersRoot = resolve(root);
			index = next;
		} else if (argument === "--help" || argument === "-h") {
			process.stdout.write(USAGE);
			process.exit(0);
		} else fail(`option inconnue : ${argument}`);
	}
	return options;
}

async function command(
	cwd: string,
	args: string[]
): Promise<{ code: number; stdout: string; stderr: string }> {
	const child = Bun.spawn(args, { cwd, stdout: "pipe", stderr: "pipe" });
	const [stdout, stderr] = await Promise.all([
		new Response(child.stdout).text(),
		new Response(child.stderr).text(),
	]);
	return { code: await child.exited, stdout, stderr };
}

async function runStep(
	results: StepResult[],
	id: string,
	cwd: string,
	args: string[],
	mutating: boolean,
	options: Options
): Promise<void> {
	const start = performance.now();
	if (options.dryRun && (mutating || options.mode !== "check")) {
		results.push({
			id,
			ok: true,
			skipped: true,
			durationMs: 0,
			detail: `prévu: ${args.join(" ")}`,
		});
		console.log(`… ${id} (simulation) — ${args.join(" ")}`);
		return;
	}
	console.log(`▶ ${id}`);
	const result = await command(cwd, args);
	const detail = (result.stderr || result.stdout).trim().split("\n").slice(-8).join("\n");
	const step: StepResult = {
		id,
		ok: result.code === 0,
		durationMs: Math.round(performance.now() - start),
		detail,
	};
	results.push(step);
	if (result.code !== 0) {
		console.error(`✗ ${id} (${step.durationMs} ms)\n${detail}`);
		fail(`étape ${id} échouée (code ${result.code})`);
	}
	console.log(`✓ ${id} (${step.durationMs} ms)`);
}

async function skipStep(results: StepResult[], id: string, reason: string): Promise<void> {
	results.push({ id, ok: true, skipped: true, durationMs: 0, detail: reason });
	console.log(`· ${id} — ${reason}`);
}

async function ensureRoots(options: Options): Promise<void> {
	for (const [name, root] of [
		["rg", options.rgRoot],
		["niers", (options as Options & { niersRoot: string }).niersRoot],
	]) {
		const info = await stat(root).catch(() => undefined);
		if (!info?.isDirectory()) fail(`${name}: racine absente : ${root}`);
	}
}

async function main(): Promise<number> {
	const options = parseArgs(process.argv.slice(2));
	const niersRoot = (options as Options & { niersRoot: string }).niersRoot;
	const results: StepResult[] = [];
	await ensureRoots(options);

	if (options.sync && options.mode !== "promote") {
		const syncArgs =
			options.mode === "check"
				? ["--repo", "all", "--dry-run"]
				: ["--repo", "all", "--pull", "--commit"];
		syncArgs.push("--rg-root", options.rgRoot, "--niers-root", niersRoot);
		if (options.push && options.mode !== "check") syncArgs.push("--push");
		await runStep(
			results,
			"git-sync",
			options.rgRoot,
			[BUN, SYNC_SCRIPT, ...syncArgs],
			options.mode !== "check",
			options
		);
	} else await skipStep(results, "git-sync", "désactivé par --no-sync");

	if (options.mode === "check" || options.mode === "promote") {
		if (options.mode === "promote") {
			await runStep(
				results,
				"azalee-promote",
				options.rgRoot,
				[BUN, `${options.rgRoot}/scripts/ops/deploy.ts`, "promote", "azalee"],
				true,
				options
			);
			if (options.nginx) {
				await runStep(
					results,
					"nginx-test",
					options.rgRoot,
					["sudo", "nginx", "-t"],
					false,
					options
				);
				await runStep(
					results,
					"nginx-reload",
					options.rgRoot,
					["sudo", "systemctl", "reload", "nginx"],
					true,
					options
				);
			}
		} else {
			await runStep(results, "nginx-test", options.rgRoot, ["sudo", "nginx", "-t"], false, options);
			await runStep(
				results,
				"model-health",
				options.rgRoot,
				probe("http://127.0.0.1:8790/health"),
				false,
				options
			);
			await runStep(
				results,
				"azalee-health",
				options.rgRoot,
				probe("https://azalee.rosegriffon.fr/api/health"),
				false,
				options
			);
			await runStep(
				results,
				"cdn-health",
				options.rgRoot,
				probe("https://cdn.rosegriffon.fr/health"),
				false,
				options
			);
		}
		return report(results);
	}

	if (options.data) {
		await runStep(results, "nie-data", niersRoot, ["just", "regen-var"], true, options);
		if (options.mirror) {
			await runStep(
				results,
				"nie-mirror",
				niersRoot,
				["sudo", "systemctl", "start", "--wait", "nie-miroir.service"],
				true,
				options
			);
		} else await skipStep(results, "nie-mirror", "désactivé par --skip-mirror");
	} else {
		await skipStep(results, "nie-data", "désactivé par --skip-data");
		await skipStep(results, "nie-mirror", "désactivé par --skip-data");
	}
	if (options.formats) {
		await runStep(
			results,
			"nie-formats",
			niersRoot,
			["cargo", "test", "-p", "nie-formats", "--locked"],
			false,
			options
		);
	} else await skipStep(results, "nie-formats", "désactivé par --skip-formats");
	if (options.wasm) {
		await runStep(results, "nie-wasm", niersRoot, ["just", "build-wasm"], true, options);
	} else await skipStep(results, "nie-wasm", "désactivé par --skip-wasm");
	if (options.model) {
		await runStep(
			results,
			"nie-model-build",
			niersRoot,
			["cargo", "build", "--release", "-p", "nie-model-serve"],
			true,
			options
		);
		await runStep(
			results,
			"nie-model-install",
			niersRoot,
			[
				"sudo",
				"install",
				"-m",
				"0644",
				`${niersRoot}/deploy/systemd/nie-model-serve.service`,
				"/etc/systemd/system/nie-model-serve.service",
			],
			true,
			options
		);
		await runStep(
			results,
			"systemd-reload",
			niersRoot,
			["sudo", "systemctl", "daemon-reload"],
			true,
			options
		);
		await runStep(
			results,
			"nie-model-restart",
			niersRoot,
			["sudo", "systemctl", "restart", "nie-model-serve.service"],
			true,
			options
		);
	} else await skipStep(results, "nie-model", "désactivé par --skip-model");

	if (options.azalee) {
		await runStep(
			results,
			"azalee-typecheck",
			options.rgRoot,
			[BUN, "run", "--filter", "@rosegriffon/azalee-web", "type-check"],
			false,
			options
		);
		await runStep(
			results,
			"azalee-lint",
			options.rgRoot,
			[BUN, "run", "--filter", "@rosegriffon/azalee-web", "lint"],
			false,
			options
		);
		const deployMode = options.mode === "preview" ? "preview" : "deploy";
		await runStep(
			results,
			`azalee-${deployMode}`,
			options.rgRoot,
			[BUN, `${options.rgRoot}/scripts/ops/deploy.ts`, deployMode, "azalee", "--no-gate"],
			true,
			options
		);
	} else await skipStep(results, "azalee", "désactivé par --skip-azalee");
	if (options.nginx) {
		await runStep(results, "nginx-test", options.rgRoot, ["sudo", "nginx", "-t"], false, options);
		await runStep(
			results,
			"nginx-reload",
			options.rgRoot,
			["sudo", "systemctl", "reload", "nginx"],
			true,
			options
		);
	} else await skipStep(results, "nginx", "désactivé par --skip-nginx");
	if (options.cdn) {
		await runStep(
			results,
			"cdn-invalidate",
			options.rgRoot,
			[BUN, INVALIDATE_SCRIPT, "--bump-sw", "--purge-g4tx", "**/*", "--apply"],
			true,
			options
		);
	} else await skipStep(results, "cdn-invalidate", "désactivé par --skip-cdn");

	await runStep(
		results,
		"model-health",
		options.rgRoot,
		probe("http://127.0.0.1:8790/health"),
		false,
		options
	);
	await runStep(
		results,
		"model-sample",
		options.rgRoot,
		[
			...probe("http://127.0.0.1:8790/model-full/c05024700.glb"),
			"-o",
			"/dev/null",
			"-w",
			"%{http_code}",
		],
		false,
		options
	);
	await runStep(
		results,
		"azalee-health",
		options.rgRoot,
		probe("https://azalee.rosegriffon.fr/api/health"),
		false,
		options
	);
	await runStep(
		results,
		"cdn-health",
		options.rgRoot,
		probe("https://cdn.rosegriffon.fr/health"),
		false,
		options
	);
	return report(results);
}

function report(results: StepResult[]): number {
	const failed = results.filter((result) => !result.ok);
	console.log(`\nrelease-stack : ${results.length - failed.length}/${results.length} étapes OK`);
	return failed.length ? 1 : 0;
}

const USAGE = `Usage : bun scripts/ops/release-stack.ts [mode] [options]

Modes (check par défaut)
  --mode check       sondes et nginx -t, aucune écriture
  --preview          gates + build + publication slot B, sans promotion
  --deploy           gates + build + bascule Azalée en production
  --promote          promeut la preview existante, sans rebuild
  --apply             alias de --deploy

Options
  --push             pousse les deux dépôts pendant git-sync
  --no-sync          ne fait pas le fetch fast-forward
  --skip-data        ne régénère pas les manifests ni le miroir SQLite
  --skip-formats     ne lance pas le gate nie-formats
  --skip-wasm        ne compile pas nie-wasm
  --skip-model       ne compile/redémarre pas nie-model-serve
  --skip-azalee      ne type-check/lint/build pas Azalée
	--skip-mirror      ne republie pas le miroir SQLite (après --skip-data ou reprise)
  --skip-cdn         ne bump/purge pas le cache CDN
  --skip-nginx       ne teste/recharge pas nginx
  --dry-run          affiche les mutations sans les exécuter
`;

const exitCode = await main().catch((error) => {
	console.error(`✗ release-stack: ${error instanceof Error ? error.message : String(error)}`);
	return 1;
});
process.exit(exitCode);
