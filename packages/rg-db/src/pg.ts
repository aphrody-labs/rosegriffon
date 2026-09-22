import { Pool } from "pg";

export type { PoolClient, QueryResultRow } from "pg";

export interface PgPoolOptions {
	applicationName?: string;
	max?: number;
}

export function getDatabaseURL(): string {
	const url = process.env.DATABASE_URL;
	if (!url || url.startsWith("eyJ2Ijo") || url === "undefined" || url === "null") {
		throw new Error("DATABASE_URL absent ou corrompu : une chaîne Postgres valide est requise.");
	}
	return url;
}

export function isDatabaseConfigured(): boolean {
	const url = process.env.DATABASE_URL;
	return Boolean(url && !url.startsWith("eyJ2Ijo") && url !== "undefined" && url !== "null");
}

let sharedPool: Pool | null = null;

/** Singleton pg pool for server-side SQL consumers across the monorepo. */
export function getPgPool(options: PgPoolOptions = {}): Pool {
	if (!sharedPool) {
		const configuredMax = Number.parseInt(process.env.DATABASE_POOL_MAX ?? "", 10);
		const max = options.max ?? (configuredMax > 0 ? Math.min(configuredMax, 4) : 4);
		sharedPool = new Pool({
			application_name: options.applicationName ?? "rosegriffon",
			connectionString: getDatabaseURL(),
			connectionTimeoutMillis: 5_000,
			idleTimeoutMillis: 30_000,
			max,
		});
		sharedPool.on("error", (error) => console.error("[pg] Erreur inattendue sur le pool partagé :", error));
	}
	return sharedPool;
}

export function getPgPoolOrNull(): Pool | null {
	if (!isDatabaseConfigured()) return null;
	try {
		return getPgPool();
	} catch {
		return null;
	}
}

export async function closePgPool(): Promise<void> {
	if (!sharedPool) return;
	const pool = sharedPool;
	sharedPool = null;
	await pool.end();
}
