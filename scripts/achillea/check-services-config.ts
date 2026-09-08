#!/usr/bin/env bun
import { isAbsolute, resolve } from "node:path";

export interface AchilleaServiceManifest {
	schemaVersion: number;
	application: string;
	ownership: {
		workspace: string;
		backend: string;
		frontend: string;
		productionSecretsFile: string;
		localSecretsConvention: string;
	};
	services: Array<{
		id: string;
		kind: string;
		parent?: string;
		workingDirectory?: string;
		port?: number;
		bind?: string;
		health?: string;
		developmentCommand?: string[];
		productionCommand?: string[];
		buildCommand?: string[];
		artifact?: string;
	}>;
	dependencies: Array<{
		id: string;
		kind: string;
		required: boolean;
		environment: string[];
		legacyEnvironment?: string[];
	}>;
	environment: {
		unit: Record<string, string>;
		requiredServerSecrets: string[];
		legacyServerSecrets: string[];
		requiredServerConfiguration: string[];
		optionalServerConfiguration: string[];
		publicBrowserConfiguration: string[];
	};
	uploads: {
		owner: string;
		provider: string;
		buckets: {
			publicImages: { variable: string; default: string; public: boolean };
			privateRankedProofs: {
				variable: string;
				default: string;
				public: boolean;
				signedUrlTtlVariable: string;
				signedUrlTtlDefaultSeconds: number;
			};
		};
		serverCredential: string;
		legacyServerCredential: string;
		browserCredential: string;
		publicPaths: string[];
		privatePaths: string[];
		proxy: { maximumBytes: number; mimeTypes: string[]; authentication: string };
		rankedProof: {
			maximumDecodedBytes: number;
			transportMaximum: string;
			mimeTypes: string[];
			authentication: string;
			fallback: string;
		};
	};
	localSupabaseTarget: {
		status: string;
		database: string;
		forbiddenDatabases: string[];
		databaseHost: string;
		databasePort: number;
		storageRoot: string;
		secretsFiles: string[];
		services: Array<{ id: string; port: number; unit?: string; config?: string }>;
		authApi: { status: string; reason: string };
	};
	productionChecks: string[];
}

const repositoryRoot = resolve(import.meta.dir, "../..");
export const manifestPath = resolve(repositoryRoot, "infra/achillea/services.json");

const expectedPorts = new Map([
	["api", 4000],
	["ranked", 4002],
	["socket-io", 4005],
	["frontend-dev", 4200],
]);

const forbiddenBrowserNames = /(SECRET|SERVICE_KEY|PASSWORD|BOT_TOKEN|ADMIN_TOKEN|DATABASE_)/;
const credentialSignatures = [
	/sb_secret_[A-Za-z0-9_-]{12,}/,
	/sbp_[A-Za-z0-9_-]{12,}/,
	/[A-Za-z\d_-]{20,}\.[A-Za-z\d_-]{6,}\.[A-Za-z\d_-]{20,}/,
];

function unique(values: string[]): boolean {
	return new Set(values).size === values.length;
}

function has(text: string, fragment: string): boolean {
	return text.includes(fragment);
}

export async function readManifest(path = manifestPath): Promise<AchilleaServiceManifest> {
	return JSON.parse(await Bun.file(path).text()) as AchilleaServiceManifest;
}

export function validateManifest(manifest: AchilleaServiceManifest): string[] {
	const errors: string[] = [];
	const serialized = JSON.stringify(manifest);

	if (manifest.schemaVersion !== 1) errors.push("schemaVersion must be 1");
	if (manifest.application !== "achillea") errors.push("application must be achillea");
	if (manifest.ownership.workspace !== repositoryRoot)
		errors.push(`workspace must be ${repositoryRoot}`);
	if (!isAbsolute(manifest.ownership.productionSecretsFile))
		errors.push("production secrets file must be absolute");
	if (manifest.ownership.productionSecretsFile.startsWith(`${repositoryRoot}/`))
		errors.push("production secrets file must stay outside the repository");
	if (manifest.ownership.localSecretsConvention !== "$HOME/.bash_secrets")
		errors.push("local secrets convention must remain $HOME/.bash_secrets");

	for (const signature of credentialSignatures) {
		if (signature.test(serialized)) errors.push(`credential-like value found: ${signature.source}`);
	}

	const ids = manifest.services.map(({ id }) => id);
	if (!unique(ids)) errors.push("service ids must be unique");
	const ports = manifest.services.flatMap(({ port }) => (port === undefined ? [] : [port]));
	if (!unique(ports.map(String))) errors.push("service ports must be unique");

	for (const [id, expectedPort] of expectedPorts) {
		const service = manifest.services.find((candidate) => candidate.id === id);
		if (!service) {
			errors.push(`missing service ${id}`);
			continue;
		}
		if (service.port !== expectedPort) errors.push(`${id} must use port ${expectedPort}`);
		if (service.bind !== "127.0.0.1") errors.push(`${id} must bind on 127.0.0.1`);
	}

	for (const service of manifest.services) {
		if (service.parent && !ids.includes(service.parent))
			errors.push(`${service.id} references missing parent ${service.parent}`);
		if (service.workingDirectory && !service.workingDirectory.startsWith("apps/"))
			errors.push(`${service.id} working directory must remain under apps/`);
		for (const command of [
			service.developmentCommand,
			service.productionCommand,
			service.buildCommand,
		]) {
			if (!command) continue;
			if (command[0] !== "bun") errors.push(`${service.id} command must use Bun`);
			if (command.some((part) => /sudo|systemctl|deploy|migration/i.test(part)))
				errors.push(`${service.id} command contains an operational side effect`);
		}
	}

	const secretNames = manifest.environment.requiredServerSecrets;
	const publicNames = manifest.environment.publicBrowserConfiguration;
	if (!unique(secretNames)) errors.push("required server secret names must be unique");
	if (!unique(publicNames)) errors.push("public browser variable names must be unique");
	for (const name of publicNames) {
		if (forbiddenBrowserNames.test(name)) errors.push(`${name} must not be exposed to the browser`);
		if (secretNames.includes(name)) errors.push(`${name} cannot be both server-secret and public`);
	}
	for (const required of [
		"BOT_TOKEN",
		"DISCORD_CLIENT_SECRET",
		"DATABASE_URL",
		"JWT_SECRET_KEY",
		"RANKED_INTERNAL_SECRET",
		"SUPABASE_SECRET_KEY",
	]) {
		if (!secretNames.includes(required))
			errors.push(`missing server secret declaration ${required}`);
	}
	for (const required of ["SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY", "SUPABASE_JWKS_URL"]) {
		if (!publicNames.includes(required))
			errors.push(`missing public browser declaration ${required}`);
	}

	if (manifest.uploads.owner !== "backend-only") errors.push("uploads must stay backend-only");
	if (manifest.uploads.provider !== "supabase-storage")
		errors.push("uploads must use the dedicated Supabase Storage provider");
	if (manifest.uploads.serverCredential !== "SUPABASE_SECRET_KEY")
		errors.push("server uploads must use SUPABASE_SECRET_KEY");
	if (manifest.uploads.legacyServerCredential !== "SUPABASE_SERVICE_KEY")
		errors.push("legacy server upload credential must remain SUPABASE_SERVICE_KEY");
	if (manifest.uploads.browserCredential !== "SUPABASE_PUBLISHABLE_KEY")
		errors.push("browser auth must use SUPABASE_PUBLISHABLE_KEY");
	if (!manifest.uploads.buckets.publicImages.public)
		errors.push("general image bucket must remain public for returned public URLs");
	if (manifest.uploads.buckets.privateRankedProofs.public)
		errors.push("ranked proof bucket must remain private");
	if (manifest.uploads.buckets.privateRankedProofs.signedUrlTtlDefaultSeconds !== 3600)
		errors.push("ranked signed URL default TTL must be 3600 seconds");
	if (manifest.uploads.proxy.maximumBytes !== 6 * 1024 * 1024)
		errors.push("proxy upload limit must be 6 MiB");
	if (manifest.uploads.rankedProof.maximumDecodedBytes !== 5 * 1024 * 1024)
		errors.push("ranked proof limit must be 5 MiB decoded");

	const localTarget = manifest.localSupabaseTarget;
	if (localTarget.status !== "active") errors.push("local Supabase target must be active");
	if (localTarget.database !== "achillea")
		errors.push("local Supabase database must be exactly achillea");
	for (const forbidden of ["rg", "rose_griffon", "postgres", "template0", "template1"]) {
		if (!localTarget.forbiddenDatabases.includes(forbidden))
			errors.push(`local Supabase forbidden databases must include ${forbidden}`);
	}
	if (localTarget.databaseHost !== "/var/run/postgresql" || localTarget.databasePort !== 5432)
		errors.push("local Supabase database must use the dedicated local socket contract");
	if (localTarget.storageRoot !== "/var/www/achillea-storage")
		errors.push("local Supabase storage root must stay isolated");
	if (localTarget.authApi.status !== "active")
		errors.push("local Supabase auth API must be active");
	const localPorts = localTarget.services.map(({ port }) => port);
	if (!unique(localPorts.map(String))) errors.push("local Supabase ports must be unique");
	const allApplicationPorts = manifest.services.flatMap(({ port }) =>
		port === undefined ? [] : [port]
	);
	for (const port of localPorts) {
		if (allApplicationPorts.includes(port))
			errors.push(`local Supabase port ${port} collides with an application service`);
		if ([8809, 8810, 8811, 8812].includes(port))
			errors.push(`local Supabase port ${port} collides with the RG Supabase stack`);
	}
	for (const expected of [8820, 8821, 8822, 8823]) {
		if (!localPorts.includes(expected)) errors.push(`local Supabase port ${expected} is missing`);
	}
	for (const secretFile of localTarget.secretsFiles) {
		if (!isAbsolute(secretFile) || secretFile.startsWith(`${repositoryRoot}/`))
			errors.push(`local Supabase secret file must stay outside the repository: ${secretFile}`);
	}

	for (const dependency of manifest.dependencies) {
		if (!dependency.environment.length)
			errors.push(`${dependency.id} must declare its environment contract`);
	}

	return errors;
}

export async function validateRepository(manifest: AchilleaServiceManifest): Promise<string[]> {
	const errors: string[] = [];
	const read = (relativePath: string) => Bun.file(resolve(repositoryRoot, relativePath)).text();

	for (const service of manifest.services) {
		if (service.workingDirectory) {
			const packageFile = Bun.file(
				resolve(repositoryRoot, service.workingDirectory, "package.json")
			);
			if (!(await packageFile.exists()))
				errors.push(`${service.id} working directory has no package.json`);
		}
	}

	const [
		main,
		apiConfig,
		apiServer,
		socketServer,
		ranked,
		proxyUpload,
		webInjection,
		systemd,
		webNginx,
		rankedNginx,
		storageSql,
		environmentSchema,
		postgresConfig,
		imageStorage,
		rankedStorage,
		dumpScript,
		migrationScript,
		inventoryScript,
		postgrestSystemd,
		storageSystemd,
		realtimeSystemd,
		authSystemd,
		internalNginx,
	] = await Promise.all([
		read("apps/achillea-bot/src/main.ts"),
		read("apps/achillea-bot/src/configs/api.ts"),
		read("apps/achillea-bot/src/api/server.ts"),
		read("apps/achillea-bot/src/websockets/socket-server.ts"),
		read("apps/achillea-bot/src/ranked/main.ts"),
		read("apps/achillea-bot/src/api/controllers/proxy.ts"),
		read("apps/achillea-web/scripts/inject-env.ts"),
		read("infra/systemd/achillea-bot.service"),
		read("infra/nginx/achillea.rosegriffon.conf"),
		read("infra/nginx/ranked.rosegriffon.conf"),
		read("infra/achillea/supabase-storage.sql"),
		read("apps/achillea-bot/src/utils/types/environment.ts"),
		read("apps/achillea-bot/src/configs/postgres.ts"),
		read("apps/achillea-bot/src/services/SupabaseImageStorage.ts"),
		read("apps/achillea-bot/src/ranked/storage.ts"),
		read("scripts/achillea/dump-database.ts"),
		read("scripts/achillea/migrate-local-database.ts"),
		read("scripts/achillea/database-inventory.ts"),
		read("infra/systemd/achillea-postgrest.service"),
		read("infra/systemd/achillea-storage.service"),
		read("infra/systemd/achillea-realtime.service"),
		read("infra/systemd/achillea-auth.service"),
		read("infra/nginx/achillea-supabase-internal.conf"),
	]);

	if (!has(environmentSchema, 'API_HOST: str({ default: "127.0.0.1" })'))
		errors.push("API host must default to loopback");
	if (!has(environmentSchema, 'SOCKET_HOST: str({ default: "127.0.0.1" })'))
		errors.push("Socket.IO host must default to loopback");
	if (!has(environmentSchema, 'RANKED_HOST: str({ default: "127.0.0.1" })'))
		errors.push("ranked host must default to loopback");
	if (!has(apiConfig, "env.API_PORT ?? 4000")) errors.push("API source no longer defaults to 4000");
	if (!has(apiServer, "httpPort: `${host}:${port}`"))
		errors.push("API server does not enforce its configured host");
	if (!has(main, "env.SOCKET_PORT : env.TEST_SOCKET_PORT"))
		errors.push("backend no longer starts Socket.IO from the declared socket port");
	if (!has(main, "RANKED_PORT: String(env.RANKED_PORT)"))
		errors.push("backend no longer supervises ranked on 4002");
	if (!has(main, 'rankedProcess.kill("SIGTERM")'))
		errors.push("backend no longer terminates ranked with its process group");
	if (!has(socketServer, 'host = "127.0.0.1"') || !has(socketServer, "server.listen(port, host"))
		errors.push("Socket.IO server does not enforce its configured loopback host");
	if (!has(ranked, "process.env.RANKED_PORT ?? 4002"))
		errors.push("ranked source no longer defaults to 4002");
	if (
		!has(ranked, 'process.env.RANKED_HOST ?? "127.0.0.1"') ||
		!has(ranked, "server.listen(PORT, HOST)")
	)
		errors.push("ranked server does not enforce its configured loopback host");
	if (!has(ranked, 'app.get("/api/health"')) errors.push("ranked health route is missing");
	if (!has(ranked, "const DISPUTE_MAX_BYTES = 5 * 1024 * 1024"))
		errors.push("ranked upload limit drifted from the manifest");
	if (!has(proxyUpload, "const MAX_UPLOAD_BYTES = 6 * 1024 * 1024"))
		errors.push("proxy upload limit drifted from the manifest");
	if (!has(postgresConfig, "connectionUrl") || !has(environmentSchema, "DATABASE_URL:"))
		errors.push("backend does not expose the DATABASE_URL contract");
	if (!has(imageStorage, "SUPABASE_SECRET_KEY") || !has(imageStorage, "SUPABASE_SERVICE_KEY"))
		errors.push("public image storage does not support the modern key and legacy alias");
	if (
		!has(rankedStorage, 'DEFAULT_BUCKET = "ranked-proofs"') ||
		!has(rankedStorage, "createSignedUrl") ||
		!has(rankedStorage, "supabase-private:")
	)
		errors.push("ranked proofs are not stored as private signed references");

	for (const variable of manifest.environment.publicBrowserConfiguration) {
		if (!has(webInjection, `"${variable}"`))
			errors.push(`web runtime injector does not read ${variable}`);
	}
	for (const forbidden of [
		"SUPABASE_SECRET_KEY",
		"SUPABASE_SERVICE_KEY",
		"DATABASE_URL",
		"DATABASE_PASSWORD",
		"DISCORD_CLIENT_SECRET",
	]) {
		if (has(webInjection, forbidden)) errors.push(`web runtime injector exposes ${forbidden}`);
	}

	for (const line of [
		"EnvironmentFile=/etc/rose-griffon/achillea.env",
		"Environment=API_HOST=127.0.0.1",
		"Environment=API_PORT=4000",
		"Environment=RANKED_HOST=127.0.0.1",
		"Environment=RANKED_PORT=4002",
		"Environment=SOCKET_HOST=127.0.0.1",
		"Environment=SOCKET_PORT=4005",
		"KillMode=control-group",
	]) {
		if (!has(systemd, line)) errors.push(`systemd unit is missing ${line}`);
	}
	if (/EnvironmentFile=.*\/\.env(?:\s|$)/m.test(systemd))
		errors.push("systemd unit must not load a repository .env file");
	for (const signature of credentialSignatures) {
		if (signature.test(systemd)) errors.push("systemd unit contains a credential-like value");
	}
	for (const fragment of [
		"insert into storage.buckets",
		"'images'",
		"'ranked-proofs'",
		"false",
		"6291456",
		"'image/png'",
		"'image/jpeg'",
		"'image/webp'",
		"'image/gif'",
		"revoke insert, update, delete on table storage.objects from anon, authenticated",
	]) {
		if (!has(storageSql, fragment)) errors.push(`Supabase Storage SQL is missing ${fragment}`);
	}
	if (/create policy|grant\s+(?:insert|update|delete)/i.test(storageSql))
		errors.push("Supabase Storage SQL must not grant browser write access");
	for (const fragment of [
		"ACHILLEA_DATABASE_URL",
		"ACHILLEA_SUPABASE_PROJECT_REF",
		"PGPASSFILE",
		"--format=custom",
		"0o700",
		"0o600",
		"await link(plan.temporaryPath, plan.finalPath)",
	]) {
		if (!has(dumpScript, fragment)) errors.push(`database dump wrapper is missing ${fragment}`);
	}
	for (const fragment of [
		'new Set(["rg", "rose_griffon", "postgres", "template0", "template1"])',
		'target.database !== "achillea"',
		"--single-transaction",
		"--exit-on-error",
		"--no-owner",
		'process.argv.includes("--execute")',
		"La base achillea cible n'est pas vide",
	]) {
		if (!has(migrationScript, fragment))
			errors.push(`local database migration wrapper is missing ${fragment}`);
	}
	for (const fragment of [
		"PGPASSFILE",
		'process.argv.includes("--compare")',
		"rowCount: string",
		"checksum: string",
		'target.database !== "achillea"',
		"0o600",
	]) {
		if (!has(inventoryScript, fragment))
			errors.push(`database inventory wrapper is missing ${fragment}`);
	}
	for (const [contents, fragments, label] of [
		[
			postgrestSystemd,
			["PGRST_SERVER_HOST=127.0.0.1", "PGRST_SERVER_PORT=8820", "achillea-postgrest.env"],
			"PostgREST",
		],
		[
			storageSystemd,
			[
				"RG_STORAGE_HOST=127.0.0.1",
				"RG_STORAGE_PORT=8821",
				"RG_STORAGE_ROOT=/var/www/achillea-storage",
				"achillea-storage.env",
			],
			"Storage",
		],
		[
			realtimeSystemd,
			["RG_REALTIME_HOST=127.0.0.1", "RG_REALTIME_PORT=8822", "achillea-realtime.env"],
			"Realtime",
		],
		[authSystemd, ["achillea-auth.env", "supabase/gotrue:v2.189.0", "--network host"], "Auth"],
	] as Array<[string, string[], string]>) {
		for (const fragment of fragments) {
			if (!has(contents, fragment)) errors.push(`${label} unit is missing ${fragment}`);
		}
		if (/EnvironmentFile=.*\/\.env(?:\s|$)/m.test(contents))
			errors.push(`${label} unit must not load a repository .env file`);
	}
	for (const fragment of [
		"listen 127.0.0.1:8823",
		"127.0.0.1:8820",
		"127.0.0.1:8821",
		"127.0.0.1:8822",
		"127.0.0.1:8824",
	]) {
		if (!has(internalNginx, fragment))
			errors.push(`Achillea internal Supabase nginx config is missing ${fragment}`);
	}
	if (has(internalNginx, "listen 0.0.0.0"))
		errors.push("Achillea internal Supabase nginx must stay private");
	if (!has(internalNginx, "location /auth/v1/"))
		errors.push("Achillea internal Supabase nginx must proxy the real auth API");

	for (const fragment of [
		"server 127.0.0.1:4000",
		"server 127.0.0.1:4002",
		"location ^~ /api/proxy/",
		"client_max_body_size 6M",
	]) {
		if (!has(webNginx, fragment)) errors.push(`Achillea web nginx config is missing ${fragment}`);
	}
	for (const fragment of [
		"server 127.0.0.1:4002",
		"server 127.0.0.1:4005",
		"location = /api/health",
		"location /socket.io/",
		"proxy_set_header Upgrade $http_upgrade",
	]) {
		if (!has(rankedNginx, fragment)) errors.push(`ranked nginx config is missing ${fragment}`);
	}

	return errors;
}

export async function checkServicesConfig(): Promise<string[]> {
	const manifest = await readManifest();
	return [...validateManifest(manifest), ...(await validateRepository(manifest))];
}

if (import.meta.main) {
	const errors = await checkServicesConfig();
	const asJson = process.argv.includes("--json");
	if (asJson) {
		console.log(JSON.stringify({ ok: errors.length === 0, errors }, null, 2));
	} else if (errors.length === 0) {
		console.log("Achillea services configuration: ok (6 services, 4 ports, 3 dependencies)");
	} else {
		for (const error of errors) console.error(`- ${error}`);
	}
	if (errors.length > 0) process.exit(1);
}
