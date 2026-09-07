#!/usr/bin/env bun
import { open, readFile, stat } from "node:fs/promises";
import path from "node:path";

const repositoryRoot = path.resolve(import.meta.dir, "../..");
const requiredSchemas = ["auth", "public", "storage"];
const requiredRoles = ["anon", "authenticated", "authenticator", "service_role"];
const forbiddenDatabases = new Set(["rg", "rose_griffon", "postgres", "template0", "template1"]);

export interface LocalTarget {
	database: string;
	host: string;
	port: string;
	user: string;
}

export interface DumpInventory {
	extensions: string[];
	owners: string[];
	schemas: string[];
	tables: string[];
}

export interface RestorePlan {
	dumpPath: string;
	inventory: DumpInventory;
	pgRestoreArguments: string[];
	target: LocalTarget;
}

function argumentValue(name: string): string | undefined {
	const index = process.argv.indexOf(name);
	return index < 0 ? undefined : process.argv[index + 1];
}

export function resolveLocalTarget(environment = process.env): LocalTarget {
	const target = {
		database: environment.ACHILLEA_LOCAL_PGDATABASE?.trim() || "achillea",
		host: environment.ACHILLEA_LOCAL_PGHOST?.trim() || "/var/run/postgresql",
		port: environment.ACHILLEA_LOCAL_PGPORT?.trim() || "5432",
		user: environment.ACHILLEA_LOCAL_PGUSER?.trim() || "postgres",
	};
	if (target.database !== "achillea" || forbiddenDatabases.has(target.database)) {
		throw new Error("La restauration est autorisee uniquement dans la base dediee achillea");
	}
	if (target.host !== "/var/run/postgresql" && target.host !== "127.0.0.1") {
		throw new Error("La cible de restauration doit etre PostgreSQL local via socket ou loopback");
	}
	const port = Number(target.port);
	if (!Number.isInteger(port) || port < 1 || port > 65_535) {
		throw new Error("Port PostgreSQL local invalide");
	}
	if (!/^[a-z_][a-z0-9_-]{0,62}$/i.test(target.user)) {
		throw new Error("Role PostgreSQL local invalide");
	}
	return target;
}

export function parseRestoreList(contents: string): DumpInventory {
	const schemas = new Set<string>();
	const extensions = new Set<string>();
	const owners = new Set<string>();
	const tables = new Set<string>();

	for (const line of contents.split("\n")) {
		if (!line || line.startsWith(";")) continue;
		const schema = line.match(/\sSCHEMA\s+-\s+(\S+)\s+(\S+)\s*$/);
		if (schema) {
			schemas.add(schema[1]);
			owners.add(schema[2]);
		}
		const extension = line.match(/\sEXTENSION\s+-\s+(\S+)\s+(\S+)\s*$/);
		if (extension) {
			extensions.add(extension[1]);
			owners.add(extension[2]);
		}
		const table = line.match(/\sTABLE\s+(?:DATA\s+)?(\S+)\s+(\S+)\s+(\S+)\s*$/);
		if (table) {
			tables.add(`${table[1]}.${table[2]}`);
			owners.add(table[3]);
		}
	}

	return {
		extensions: [...extensions].sort(),
		owners: [...owners].sort(),
		schemas: [...schemas].sort(),
		tables: [...tables].sort(),
	};
}

async function validateDumpPath(dumpPath: string): Promise<void> {
	if (!path.isAbsolute(dumpPath)) throw new Error("Le chemin du dump doit etre absolu");
	const normalized = path.resolve(dumpPath);
	if (normalized.startsWith(`${repositoryRoot}${path.sep}`) || normalized === repositoryRoot) {
		throw new Error("Le dump doit rester hors du depot");
	}
	if (!normalized.endsWith(".dump") || normalized.endsWith(".partial")) {
		throw new Error("Le dump doit etre une archive finale .dump");
	}
	const info = await stat(normalized);
	if (!info.isFile() || info.size < 5) throw new Error("Archive de dump absente ou vide");
	if ((info.mode & 0o077) !== 0) throw new Error("Le dump doit etre prive (mode 0600)");
	const handle = await open(normalized, "r");
	try {
		const magic = Buffer.alloc(5);
		await handle.read(magic, 0, magic.length, 0);
		if (magic.toString("ascii") !== "PGDMP") throw new Error("Archive pg_dump custom invalide");
	} finally {
		await handle.close();
	}
}

async function output(command: string[]): Promise<string> {
	const child = Bun.spawn(command, { stderr: "pipe", stdout: "pipe" });
	const [stdout, stderr, exitCode] = await Promise.all([
		new Response(child.stdout).text(),
		new Response(child.stderr).text(),
		child.exited,
	]);
	if (exitCode !== 0) {
		throw new Error(`${path.basename(command[0])} a echoue: ${stderr.trim().slice(0, 500)}`);
	}
	return stdout;
}

export async function createRestorePlan(dumpPath: string): Promise<RestorePlan> {
	await validateDumpPath(dumpPath);
	const list = await output(["pg_restore", "--list", dumpPath]);
	const inventory = parseRestoreList(list);
	for (const schema of requiredSchemas) {
		if (!inventory.schemas.includes(schema))
			throw new Error(`Schema requis absent du dump: ${schema}`);
	}
	if (inventory.tables.length === 0) throw new Error("Le dump ne contient aucune table");

	const target = resolveLocalTarget();
	const pgRestoreArguments = [
		"pg_restore",
		"--single-transaction",
		"--exit-on-error",
		"--no-owner",
		"--host",
		target.host,
		"--port",
		target.port,
		"--username",
		target.user,
		"--dbname",
		target.database,
		dumpPath,
	];
	return { dumpPath, inventory, pgRestoreArguments, target };
}

interface TargetPreflight {
	database: string;
	extensions: string[];
	missingRoles: string[];
	tableCount: number;
}

async function targetPreflight(plan: RestorePlan): Promise<TargetPreflight> {
	const extensions = plan.inventory.extensions.map((value) => `'${value.replaceAll("'", "''")}'`);
	const roles = [...new Set([...requiredRoles, ...plan.inventory.owners])]
		.filter((value) => value !== "-")
		.map((value) => `'${value.replaceAll("'", "''")}'`);
	const sql = `select json_build_object(
  'database', current_database(),
  'tableCount', (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind in ('r','p') and n.nspname not in ('pg_catalog','information_schema') and n.nspname !~ '^pg_toast'),
  'missingRoles', (select coalesce(json_agg(x.role), '[]'::json) from (select role from unnest(array[${roles.join(",")}]::text[]) role where not exists (select 1 from pg_roles where rolname=role)) x),
  'extensions', (select coalesce(json_agg(name), '[]'::json) from (select name from pg_available_extensions where name = any(array[${extensions.join(",")}]::text[])) x)
)::text;`;
	const text = await output([
		"psql",
		"--no-psqlrc",
		"--tuples-only",
		"--no-align",
		"--set",
		"ON_ERROR_STOP=1",
		"--host",
		plan.target.host,
		"--port",
		plan.target.port,
		"--username",
		plan.target.user,
		"--dbname",
		plan.target.database,
		"--command",
		sql,
	]);
	const result = JSON.parse(text.trim()) as TargetPreflight;
	if (result.database !== "achillea") throw new Error("Preflight connecte a une base non-Achillea");
	if (result.tableCount !== 0) throw new Error("La base achillea cible n'est pas vide");
	if (result.missingRoles.length > 0) {
		throw new Error(`Roles PostgreSQL requis absents: ${result.missingRoles.join(", ")}`);
	}
	const missingExtensions = plan.inventory.extensions.filter(
		(extension) => !result.extensions.includes(extension)
	);
	if (missingExtensions.length > 0) {
		throw new Error(`Extensions PostgreSQL indisponibles: ${missingExtensions.join(", ")}`);
	}
	return result;
}

async function restore(plan: RestorePlan): Promise<void> {
	await targetPreflight(plan);
	const child = Bun.spawn(plan.pgRestoreArguments, { stderr: "inherit", stdout: "inherit" });
	const exitCode = await child.exited;
	if (exitCode !== 0) throw new Error(`pg_restore a echoue (code ${exitCode})`);
}

async function main(): Promise<void> {
	const dumpPath = argumentValue("--dump");
	if (!dumpPath) throw new Error("--dump /chemin/absolu/achillea-*.dump est requis");
	const plan = await createRestorePlan(dumpPath);
	const summary = {
		database: plan.target.database,
		dump: plan.dumpPath,
		extensions: plan.inventory.extensions,
		ownersObserved: plan.inventory.owners,
		schemas: plan.inventory.schemas,
		tableCount: plan.inventory.tables.length,
	};

	if (
		process.argv.includes("--check") ||
		(!process.argv.includes("--restore") && !process.argv.includes("--preflight"))
	) {
		console.log(JSON.stringify({ mode: "dry-run", ...summary }, null, 2));
		return;
	}
	if (process.argv.includes("--preflight")) {
		const result = await targetPreflight(plan);
		console.log(JSON.stringify({ mode: "target-preflight", ...summary, target: result }, null, 2));
		return;
	}
	if (!process.argv.includes("--execute")) {
		console.log(JSON.stringify({ mode: "restore-plan", ...summary }, null, 2));
		console.log("Ajoutez --execute uniquement apres preflight et approbation operateur.");
		return;
	}
	await restore(plan);
	console.log("Restauration transactionnelle terminee; lancer les inventaires source/cible.");
}

if (import.meta.main) {
	main().catch((error) => {
		console.error(error instanceof Error ? error.message : "Echec de migration Achillea");
		process.exit(1);
	});
}
