#!/usr/bin/env bun
/**
 * Contrat et observabilité de la stack RG/Niers.
 *
 * Commands:
 *   status [--json] [--strict]  live units, probes, disk and duplicates
 *   check                       manifest/source consistency
 *   plan                        check + live status, no mutations
 *
 * This file intentionally never starts, stops, reloads or installs anything.
 * Deployment remains explicit in deploy.ts/release-stack.ts.
 */
import { readFile } from "node:fs/promises";

const ROOT = "/home/ubuntu/rg";
const MANIFEST_PATH = `${ROOT}/infra/stack.json`;
const manifest = JSON.parse(await readFile(MANIFEST_PATH, "utf8")) as Manifest;
const json = process.argv.includes("--json");
const strict = process.argv.includes("--strict");
const command = process.argv[2] ?? "status";

type Component = {
	id: string;
	kind: string;
	owner: "rg" | "niers" | "package";
	unit: string;
	source: "rg" | "niers" | "package";
	required: boolean;
	oneshot?: boolean;
	timer?: string;
	ports?: number[];
	health?: string;
	standby?: boolean;
	retired?: boolean;
};
type Manifest = {
	schemaVersion: number;
	stackVersion: string;
	name: string;
	policy: Record<string, string | boolean>;
	components: Component[];
};

type CommandResult = { code: number; stdout: string; stderr: string };
async function run(args: string[]): Promise<CommandResult> {
	const child = Bun.spawn(args, { stdout: "pipe", stderr: "pipe" });
	const [stdout, stderr] = await Promise.all([
		new Response(child.stdout).text(),
		new Response(child.stderr).text(),
	]);
	return { code: await child.exited, stdout, stderr };
}

function unique<T>(values: T[]): T[] {
	return [...new Set(values)];
}

function manifestProblems(): string[] {
	const problems: string[] = [];
	if (manifest.schemaVersion !== 1) problems.push("schemaVersion inconnue");
	if (!/^\d+\.\d+\.\d+$/u.test(manifest.stackVersion)) problems.push("stackVersion invalide");
	const ids = manifest.components.map((component) => component.id);
	for (const id of unique(ids)) {
		if (ids.filter((candidate) => candidate === id).length > 1) problems.push(`id dupliqué: ${id}`);
	}
	const ports = new Map<number, Component[]>();
	for (const component of manifest.components) {
		for (const port of component.ports ?? []) ports.set(port, [...(ports.get(port) ?? []), component]);
	}
	for (const [port, owners] of ports) {
		const active = owners.filter((component) => !component.retired && !component.standby);
		if (active.length > 1) problems.push(`port ${port} partagé par ${active.map((component) => component.id).join(", ")}`);
	}
	return problems;
}

async function unitStatus(unit: string) {
	const result = await run(["systemctl", "show", unit, "--no-page", "--property=LoadState,ActiveState,SubState,UnitFileState"]);
	const values = Object.fromEntries(
		result.stdout
			.trim()
			.split("\n")
			.filter(Boolean)
			.map((line) => line.split("=", 2) as [string, string]),
	);
	return {
		unit,
		loaded: values.LoadState === "loaded",
		active: values.ActiveState === "active",
		state: values.SubState ?? "unknown",
		enabled: values.UnitFileState ?? "unknown",
	};
}

async function timerStatus(timer: string | undefined) {
	if (!timer) return undefined;
	const result = await run(["systemctl", "show", timer, "--no-page", "--property=ActiveState,UnitFileState"]);
	const values = Object.fromEntries(
		result.stdout
			.trim()
			.split("\n")
			.filter(Boolean)
			.map((line) => line.split("=", 2) as [string, string]),
	);
	return { unit: timer, active: values.ActiveState === "active", enabled: values.UnitFileState ?? "unknown" };
}

async function probe(url: string) {
	const started = performance.now();
	try {
		const response = await fetch(url, { signal: AbortSignal.timeout(8_000) });
		return { url, ok: response.ok, status: response.status, ms: Math.round(performance.now() - started) };
	} catch (error) {
		return { url, ok: false, status: 0, ms: Math.round(performance.now() - started), error: String(error) };
	}
}

async function disk() {
	const result = await run(["df", "-Pk", "/", "/tmp"]);
	const rows = result.stdout.trim().split("\n").slice(1);
	return rows.map((row) => {
		const columns = row.trim().split(/\s+/u);
		return { mount: columns.at(-1), usedPercent: Number.parseInt(columns.at(-2)?.replace("%", "") ?? "0", 10), availableKb: Number(columns.at(-3) ?? 0) };
	});
}

async function status() {
	const components = await Promise.all(
		manifest.components.map(async (component) => ({
			...component,
			unit: await unitStatus(component.unit),
			timer: await timerStatus(component.timer),
			probe: component.health ? await probe(component.health) : undefined,
		})),
	);
	const diskState = await disk();
	const diskWarnings = diskState.filter(
		(row) => row.usedPercent >= Number(manifest.policy.diskWarningPercent ?? 85),
	);
	const diskCritical = diskState.some(
		(row) => row.usedPercent >= Number(manifest.policy.diskCriticalPercent ?? 95),
	);
	const requiredFailures = components.filter(
		(component) =>
			(component.required && (!component.oneshot && !component.unit.active || (component.probe && !component.probe.ok))) ||
			(component.required && component.oneshot && component.timer && !component.timer.active) ||
			(component.retired && component.unit.active),
	);
	const result = {
		stack: manifest.name,
		stackVersion: manifest.stackVersion,
		schemaVersion: manifest.schemaVersion,
		timestamp: new Date().toISOString(),
		components,
		disk: diskState,
		diskWarnings,
		manifestProblems: manifestProblems(),
		health: requiredFailures.length === 0 && manifestProblems().length === 0 && !diskCritical ? "ok" : "degraded",
	};
	if (json) console.log(JSON.stringify(result));
	else {
		console.log(`${result.stack} ${result.stackVersion} — ${result.health}`);
		for (const component of components) {
			const health = component.probe ? ` probe=${component.probe.status}` : "";
			console.log(`- ${component.id.padEnd(24)} ${component.unit.active ? "UP" : "DOWN"} ${component.unit.state}${health}`);
		}
		for (const row of result.disk) console.log(`- disk ${row.mount}: ${row.usedPercent}% used`);
		for (const row of result.diskWarnings) console.log(`! disk warning ${row.mount}: ${row.usedPercent}% used`);
		for (const problem of result.manifestProblems) console.log(`! ${problem}`);
	}
	return strict && result.health !== "ok" ? 1 : 0;
}

async function check() {
	const problems = manifestProblems();
	for (const component of manifest.components) {
		if (component.source === "rg" && !(await Bun.file(`${ROOT}/infra/systemd/${component.unit}`).exists())) {
			// Nginx is tracked as a package-level source, not a systemd unit.
			if (component.kind !== "gateway") problems.push(`${component.id}: unité absente de infra/systemd`);
		}
	}
	if (json) console.log(JSON.stringify({ stackVersion: manifest.stackVersion, problems }));
	else console.log(problems.length ? problems.map((problem) => `! ${problem}`).join("\n") : "✓ manifest infra cohérent");
	return problems.length ? 1 : 0;
}

let exitCode: number;
if (command === "check") exitCode = await check();
else if (command === "status") exitCode = await status();
else if (command === "plan") {
		const checkCode = await check();
		const statusCode = await status();
		exitCode = checkCode || statusCode;
} else {
		console.error("usage: bun scripts/ops/stack.ts [status|check|plan] [--json] [--strict]");
	exitCode = 2;
}
process.exit(exitCode);
