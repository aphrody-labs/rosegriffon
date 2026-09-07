#!/usr/bin/env bun
import { chmod, link, mkdir, open, readFile, stat, unlink } from "node:fs/promises";
import path from "node:path";

import { createDumpPlan, pgPassLine, type DumpPlan } from "./dump-database";
import { resolveLocalTarget, type LocalTarget } from "./migrate-local-database";

const repositoryRoot = path.resolve(import.meta.dir, "../..");

export interface TableFingerprint {
	schema: string;
	table: string;
	rowCount: string;
	checksum: string;
}

export interface DatabaseInventory {
	formatVersion: 1;
	label: "source-cloud" | "target-local";
	database: string;
	generatedAt: string;
	tables: TableFingerprint[];
}

export interface InventoryDifference {
	table: string;
	kind: "missing-target" | "extra-target" | "row-count" | "checksum";
	source?: string;
	target?: string;
}

interface PsqlConnection {
	database: string;
	environment: Record<string, string>;
	host: string;
	port: string;
	user: string;
}

function argumentValue(name: string): string | undefined {
	const index = process.argv.indexOf(name);
	return index < 0 ? undefined : process.argv[index + 1];
}

function quoteIdentifier(value: string): string {
	return `"${value.replaceAll('"', '""')}"`;
}

function ensureSafeOutputPath(outputPath: string): string {
	if (!path.isAbsolute(outputPath)) throw new Error("Le chemin d'inventaire doit etre absolu");
	const normalized = path.resolve(outputPath);
	if (normalized === repositoryRoot || normalized.startsWith(`${repositoryRoot}${path.sep}`)) {
		throw new Error("Les inventaires de donnees doivent rester hors du depot");
	}
	if (!normalized.endsWith(".json")) throw new Error("L'inventaire doit etre un fichier .json");
	const parent = path.dirname(normalized);
	if (["/", "/home", "/home/ubuntu"].includes(parent)) {
		throw new Error("Le repertoire d'inventaire doit etre borne");
	}
	return normalized;
}

async function commandOutput(
	command: string[],
	environment: Record<string, string>
): Promise<string> {
	const child = Bun.spawn(command, {
		env: { ...process.env, ...environment },
		stderr: "pipe",
		stdout: "pipe",
	});
	const [stdout, stderr, exitCode] = await Promise.all([
		new Response(child.stdout).text(),
		new Response(child.stderr).text(),
		child.exited,
	]);
	if (exitCode !== 0) {
		throw new Error(`psql a echoue: ${stderr.trim().slice(0, 500)}`);
	}
	return stdout.trim();
}

function psqlArguments(connection: PsqlConnection, sql: string): string[] {
	return [
		"psql",
		"--no-psqlrc",
		"--tuples-only",
		"--no-align",
		"--set",
		"ON_ERROR_STOP=1",
		"--host",
		connection.host,
		"--port",
		connection.port,
		"--username",
		connection.user,
		"--dbname",
		connection.database,
		"--command",
		sql,
	];
}

async function capture(
	connection: PsqlConnection,
	label: DatabaseInventory["label"]
): Promise<DatabaseInventory> {
	const tablesSql = `select coalesce(json_agg(json_build_object('schema', n.nspname, 'table', c.relname) order by n.nspname, c.relname), '[]'::json)::text
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where c.relkind in ('r', 'p')
  and n.nspname not in ('pg_catalog', 'information_schema')
  and n.nspname !~ '^pg_(toast|temp_)';`;
	const rows = JSON.parse(
		await commandOutput(psqlArguments(connection, tablesSql), connection.environment)
	) as Array<{ schema: string; table: string }>;
	if (!Array.isArray(rows)) throw new Error("Inventaire des tables PostgreSQL invalide");

	const tables: TableFingerprint[] = [];
	for (const row of rows) {
		if (typeof row.schema !== "string" || typeof row.table !== "string") {
			throw new Error("Identifiant de table PostgreSQL invalide");
		}
		const qualified = `${quoteIdentifier(row.schema)}.${quoteIdentifier(row.table)}`;
		const fingerprintSql = `select count(*)::text || E'\\t' || md5(
  count(*)::text || ':' ||
  coalesce(sum((('x' || substr(row_hash, 1, 16))::bit(64)::bigint)::numeric), 0)::text || ':' ||
  coalesce(sum((('x' || substr(row_hash, 17, 16))::bit(64)::bigint)::numeric), 0)::text
)
from (select md5(row_to_json(t)::text) as row_hash from ${qualified} t) rows;`;
		const result = await commandOutput(
			psqlArguments(connection, fingerprintSql),
			connection.environment
		);
		const [rowCount, checksum, extra] = result.split("\t");
		if (!/^\d+$/.test(rowCount ?? "") || !/^[a-f0-9]{32}$/.test(checksum ?? "") || extra) {
			throw new Error(`Empreinte invalide pour ${row.schema}.${row.table}`);
		}
		tables.push({ schema: row.schema, table: row.table, rowCount, checksum });
	}

	return {
		formatVersion: 1,
		label,
		database: connection.database,
		generatedAt: new Date().toISOString(),
		tables,
	};
}

async function withSourceConnection<T>(
	plan: DumpPlan,
	directory: string,
	run: (connection: PsqlConnection) => Promise<T>
): Promise<T> {
	const passFile = path.join(directory, `.inventory-pgpass-${process.pid}-${crypto.randomUUID()}`);
	const handle = await open(passFile, "wx", 0o600);
	try {
		await handle.writeFile(`${pgPassLine(plan)}\n`);
		await handle.close();
		await chmod(passFile, 0o600);
		return await run({
			database: plan.database,
			environment: { PGPASSFILE: passFile, PGSSLMODE: plan.sslMode, PGTZ: "UTC" },
			host: plan.host,
			port: plan.port,
			user: plan.username,
		});
	} finally {
		await handle.close().catch(() => undefined);
		await unlink(passFile).catch(() => undefined);
	}
}

function localConnection(target: LocalTarget): PsqlConnection {
	return {
		database: target.database,
		environment: { PGSSLMODE: "disable", PGTZ: "UTC" },
		host: target.host,
		port: target.port,
		user: target.user,
	};
}

async function writePrivateJson(outputPath: string, value: unknown): Promise<void> {
	const directory = path.dirname(outputPath);
	await mkdir(directory, { mode: 0o700, recursive: true });
	await chmod(directory, 0o700);
	const temporary = `${outputPath}.partial-${process.pid}-${crypto.randomUUID()}`;
	const handle = await open(temporary, "wx", 0o600);
	try {
		await handle.writeFile(`${JSON.stringify(value, null, 2)}\n`);
		await handle.close();
		await chmod(temporary, 0o600);
		await link(temporary, outputPath);
	} finally {
		await handle.close().catch(() => undefined);
		await unlink(temporary).catch(() => undefined);
	}
}

export function compareInventories(
	source: DatabaseInventory,
	target: DatabaseInventory
): InventoryDifference[] {
	if (source.formatVersion !== 1 || source.label !== "source-cloud") {
		throw new Error("Inventaire source invalide");
	}
	if (
		target.formatVersion !== 1 ||
		target.label !== "target-local" ||
		target.database !== "achillea"
	) {
		throw new Error("Inventaire cible Achillea invalide");
	}
	const differences: InventoryDifference[] = [];
	const sourceTables = new Map(
		source.tables.map((table) => [`${table.schema}.${table.table}`, table])
	);
	const targetTables = new Map(
		target.tables.map((table) => [`${table.schema}.${table.table}`, table])
	);
	for (const [name, sourceTable] of sourceTables) {
		const targetTable = targetTables.get(name);
		if (!targetTable) {
			differences.push({ table: name, kind: "missing-target" });
			continue;
		}
		if (sourceTable.rowCount !== targetTable.rowCount) {
			differences.push({
				table: name,
				kind: "row-count",
				source: sourceTable.rowCount,
				target: targetTable.rowCount,
			});
		} else if (sourceTable.checksum !== targetTable.checksum) {
			differences.push({
				table: name,
				kind: "checksum",
				source: sourceTable.checksum,
				target: targetTable.checksum,
			});
		}
	}
	for (const name of targetTables.keys()) {
		if (!sourceTables.has(name)) differences.push({ table: name, kind: "extra-target" });
	}
	return differences.sort((left, right) => left.table.localeCompare(right.table));
}

async function readPrivateInventory(inputPath: string): Promise<DatabaseInventory> {
	const normalized = ensureSafeOutputPath(inputPath);
	const info = await stat(normalized);
	if (!info.isFile() || (info.mode & 0o077) !== 0) {
		throw new Error("L'inventaire doit etre un fichier prive (mode 0600)");
	}
	return JSON.parse(await readFile(normalized, "utf8")) as DatabaseInventory;
}

async function main(): Promise<void> {
	if (process.argv.includes("--compare")) {
		const sourcePath = argumentValue("--source-file");
		const targetPath = argumentValue("--target-file");
		if (!sourcePath || !targetPath) throw new Error("--source-file et --target-file sont requis");
		const differences = compareInventories(
			await readPrivateInventory(sourcePath),
			await readPrivateInventory(targetPath)
		);
		if (differences.length > 0) {
			console.error(JSON.stringify({ ok: false, differences }, null, 2));
			process.exitCode = 1;
			return;
		}
		console.log("Inventaires Achillea identiques: row counts et checksums valides.");
		return;
	}

	const sourceMode = process.argv.includes("--source");
	const targetMode = process.argv.includes("--target");
	if (sourceMode === targetMode) throw new Error("Choisissez exactement --source ou --target");
	const outputPathArgument = argumentValue("--output");
	if (!outputPathArgument) throw new Error("--output /chemin/hors-repo/inventaire.json est requis");
	const outputPath = ensureSafeOutputPath(outputPathArgument);

	const sourcePlan = sourceMode ? createDumpPlan(process.env) : undefined;
	const target = targetMode ? resolveLocalTarget() : undefined;
	const version = Bun.spawn(["psql", "--version"], { stderr: "ignore", stdout: "ignore" });
	if ((await version.exited) !== 0) throw new Error("psql est absent ou inutilisable");
	if (process.argv.includes("--check")) {
		console.log(
			`Inventaire Achillea: configuration valide (mode=${sourceMode ? "source-cloud" : "target-local"}, destination=${outputPath})`
		);
		return;
	}

	await mkdir(path.dirname(outputPath), { mode: 0o700, recursive: true });
	await chmod(path.dirname(outputPath), 0o700);
	const inventory = sourcePlan
		? await withSourceConnection(sourcePlan, path.dirname(outputPath), (connection) =>
				capture(connection, "source-cloud")
			)
		: await capture(localConnection(target!), "target-local");
	await writePrivateJson(outputPath, inventory);
	console.log(
		`Inventaire ${inventory.label} ecrit: ${outputPath} (${inventory.tables.length} tables)`
	);
}

if (import.meta.main) {
	main().catch((error) => {
		console.error(error instanceof Error ? error.message : "Echec inventaire Achillea");
		process.exit(1);
	});
}
