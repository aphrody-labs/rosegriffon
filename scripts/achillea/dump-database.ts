#!/usr/bin/env bun
import { chmod, link, mkdir, open, stat, unlink } from "node:fs/promises";
import path from "node:path";

const DEFAULT_PROJECT_REF = "yftdclwvehxxffwqvhmc";
const DEFAULT_BACKUP_DIRECTORY = path.resolve(import.meta.dir, "../../../achillea-backups");
const repositoryRoot = path.resolve(import.meta.dir, "../..");

export interface DumpEnvironment {
	ACHILLEA_BACKUP_DIR?: string;
	ACHILLEA_DATABASE_URL?: string;
	ACHILLEA_SUPABASE_PROJECT_REF?: string;
	DATABASE_URL?: string;
}

export interface DumpPlan {
	backupDirectory: string;
	database: string;
	finalPath: string;
	host: string;
	password: string;
	pgDumpArguments: string[];
	port: string;
	projectRef: string;
	sslMode: string;
	temporaryPath: string;
	username: string;
}

function timestamp(date: Date): string {
	return date
		.toISOString()
		.replaceAll(/[-:]/g, "")
		.replace(/\.\d{3}Z$/, "Z");
}

function isUnsafeHost(host: string): boolean {
	const normalized = host.toLowerCase();
	return (
		normalized === "localhost" ||
		normalized.endsWith(".localhost") ||
		normalized.endsWith(".local") ||
		normalized === "::1" ||
		/^127\./.test(normalized) ||
		/^10\./.test(normalized) ||
		/^192\.168\./.test(normalized) ||
		/^172\.(?:1[6-9]|2\d|3[01])\./.test(normalized) ||
		/^(?:\d{1,3}\.){3}\d{1,3}$/.test(normalized) ||
		normalized.includes(":")
	);
}

function escapePgPass(value: string): string {
	return value.replaceAll("\\", "\\\\").replaceAll(":", "\\:");
}

export function pgPassLine(plan: DumpPlan): string {
	return [plan.host, plan.port, plan.database, plan.username, plan.password]
		.map(escapePgPass)
		.join(":");
}

export function createDumpPlan(environment: DumpEnvironment, now = new Date()): DumpPlan {
	const source = environment.ACHILLEA_DATABASE_URL?.trim() || environment.DATABASE_URL?.trim();
	if (!source) {
		throw new Error("ACHILLEA_DATABASE_URL ou DATABASE_URL est requis");
	}

	const projectRef = environment.ACHILLEA_SUPABASE_PROJECT_REF?.trim() || DEFAULT_PROJECT_REF;
	if (!/^[a-z0-9]{20}$/.test(projectRef)) {
		throw new Error("ACHILLEA_SUPABASE_PROJECT_REF invalide");
	}

	let connection: URL;
	try {
		connection = new URL(source);
	} catch {
		throw new Error("URL PostgreSQL Achillea invalide");
	}
	if (!new Set(["postgres:", "postgresql:"]).has(connection.protocol)) {
		throw new Error("La cible doit utiliser postgres:// ou postgresql://");
	}
	if (isUnsafeHost(connection.hostname)) {
		throw new Error("Une base locale, privee ou adressee par IP ne peut pas etre dumpee ici");
	}
	if (
		!connection.hostname.endsWith(".supabase.co") &&
		!connection.hostname.endsWith(".supabase.com")
	) {
		throw new Error("La cible doit etre un PostgreSQL Supabase Achillea dedie");
	}

	const username = decodeURIComponent(connection.username);
	const password = decodeURIComponent(connection.password);
	const database = decodeURIComponent(connection.pathname.replace(/^\//, ""));
	if ([username, password, database].some((value) => /[\r\n]/.test(value))) {
		throw new Error("La cible PostgreSQL contient un caractere de controle interdit");
	}
	const targetContainsRef =
		connection.hostname.split(".").includes(projectRef) || username.split(".").includes(projectRef);
	if (!targetContainsRef) {
		throw new Error("La cible ne correspond pas au project ref Supabase Achillea attendu");
	}
	if (!username || !password || !database || database.includes("/")) {
		throw new Error("La cible doit contenir utilisateur, mot de passe et base");
	}
	if (connection.hash) throw new Error("La cible PostgreSQL ne doit pas contenir de fragment");

	const sslMode = connection.searchParams.get("sslmode") ?? "";
	if (!new Set(["require", "verify-ca", "verify-full"]).has(sslMode)) {
		throw new Error("La cible Supabase doit imposer sslmode=require, verify-ca ou verify-full");
	}

	const backupDirectory = environment.ACHILLEA_BACKUP_DIR?.trim() || DEFAULT_BACKUP_DIRECTORY;
	if (!path.isAbsolute(backupDirectory)) throw new Error("ACHILLEA_BACKUP_DIR doit etre absolu");
	const normalizedBackup = path.resolve(backupDirectory);
	if (
		normalizedBackup === repositoryRoot ||
		normalizedBackup.startsWith(`${repositoryRoot}${path.sep}`) ||
		normalizedBackup === "/" ||
		normalizedBackup === "/home" ||
		normalizedBackup === "/home/ubuntu"
	) {
		throw new Error("Le repertoire de backup doit etre borne et situe hors du depot");
	}

	const basename = `achillea-${timestamp(now)}.dump`;
	const finalPath = path.join(normalizedBackup, basename);
	const temporaryPath = `${finalPath}.partial`;
	const port = connection.port || "5432";
	const pgDumpArguments = [
		"pg_dump",
		"--format=custom",
		"--no-owner",
		"--host",
		connection.hostname,
		"--port",
		port,
		"--username",
		username,
		"--dbname",
		database,
		"--file",
		temporaryPath,
	];

	return {
		backupDirectory: normalizedBackup,
		database,
		finalPath,
		host: connection.hostname,
		password,
		pgDumpArguments,
		port,
		projectRef,
		sslMode,
		temporaryPath,
		username,
	};
}

async function checkPgDump(): Promise<void> {
	const process = Bun.spawn(["pg_dump", "--version"], { stderr: "pipe", stdout: "pipe" });
	const exitCode = await process.exited;
	if (exitCode !== 0) throw new Error("pg_dump est absent ou inutilisable");
}

export async function executeDump(plan: DumpPlan, executable = "pg_dump"): Promise<void> {
	await mkdir(plan.backupDirectory, { mode: 0o700, recursive: true });
	await chmod(plan.backupDirectory, 0o700);

	const passFile = path.join(plan.backupDirectory, `.pgpass-${process.pid}-${crypto.randomUUID()}`);
	const passHandle = await open(passFile, "wx", 0o600);
	await passHandle.writeFile(`${pgPassLine(plan)}\n`);
	await passHandle.close();
	await chmod(passFile, 0o600);
	const dumpHandle = await open(plan.temporaryPath, "wx", 0o600);
	await dumpHandle.close();

	try {
		const child = Bun.spawn([executable, ...plan.pgDumpArguments.slice(1)], {
			env: {
				...process.env,
				PGPASSFILE: passFile,
				PGSSLMODE: plan.sslMode,
			},
			stderr: "inherit",
			stdout: "ignore",
		});
		const exitCode = await child.exited;
		if (exitCode !== 0) throw new Error(`pg_dump a echoue (code ${exitCode})`);

		const dumpStat = await stat(plan.temporaryPath);
		if (dumpStat.size === 0) throw new Error("pg_dump a produit un fichier vide");
		await chmod(plan.temporaryPath, 0o600);
		// Un lien dur refuse atomiquement d'ecraser un dump du meme timestamp.
		await link(plan.temporaryPath, plan.finalPath);
		await unlink(plan.temporaryPath).catch(() => undefined);
		console.log(`Dump Achillea cree: ${plan.finalPath} (${dumpStat.size} octets, mode 0600)`);
	} catch (error) {
		await unlink(plan.temporaryPath).catch(() => undefined);
		throw error;
	} finally {
		await unlink(passFile).catch(() => undefined);
	}
}

async function main(): Promise<void> {
	const plan = createDumpPlan(process.env);
	await checkPgDump();

	if (process.argv.includes("--check")) {
		console.log(
			`Dump Achillea: configuration valide (project=${plan.projectRef}, host=${plan.host}, database=${plan.database}, destination=${plan.finalPath})`
		);
		return;
	}
	if (process.argv.some((argument) => argument.startsWith("postgres"))) {
		throw new Error(
			"Ne passez jamais une URL PostgreSQL en argument; utilisez le secret d'environnement"
		);
	}
	await executeDump(plan);
}

if (import.meta.main) {
	main().catch((error) => {
		console.error(error instanceof Error ? error.message : "Echec du dump Achillea");
		process.exit(1);
	});
}
