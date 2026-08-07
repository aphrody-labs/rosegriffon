import { Pool } from "pg";

// Connexion Postgres DIRECTE (bypass le Data API PostgREST de Supabase) —
// utilisée pour les lectures publiques qui ne doivent PAS dépendre de la
// disponibilité du Data API (ex. `exceed_storage_size_quota` a restreint le
// Data API pendant 7+ jours début août 2026 alors que la connexion Postgres
// directe restait fonctionnelle tout du long — cf. docs/rag-unified.md et
// packages/cron/src/lib/db.ts qui utilise déjà ce pattern côté cron).
// Extrait depuis lib/auth.ts (qui réutilise ce module) pour être partagé par
// toute lecture serveur "full local" (indépendante du Data API).

export const getDatabaseURL = (): string => {
	const url = process.env.DATABASE_URL;
	if (!url || url.startsWith("eyJ2Ijo") || url === "undefined" || url === "null") {
		throw new Error(
			"DATABASE_URL absent ou corrompu : une chaîne de connexion Postgres valide est requise (cf. variables d'environnement Vercel)."
		);
	}
	// Vercel serverless est IPv4-only ; l'hôte direct Supabase (db.<ref>.supabase.co) est IPv6-only
	// → DNS getaddrinfo ENOTFOUND. On réécrit vers le pooler Supavisor en mode transaction (IPv4, port 6543),
	// en DÉRIVANT depuis l'URL directe — aucun secret en dur, donc résilient à un scrub d'historique.
	// EN SELF-HOST VPS (rosegriffon.fr / azalee.rosegriffon.fr) l'IPv6 est dispo et le pooler Supavisor
	// ne résout plus de façon fiable → on GARDE l'URL directe. Le rewrite n'a lieu que sous Vercel.
	if (process.env.VERCEL === "1") {
		const direct = url.match(
			/^postgres(?:ql)?:\/\/([^:]+):([^@]+)@db\.([a-z0-9]+)\.supabase\.co:\d+\/([^?]+)(?:\?.*)?$/
		);
		if (direct) {
			const [, , password, ref, db] = direct;
			const region = process.env.SUPABASE_REGION ?? "eu-west-1";
			return `postgresql://postgres.${ref}:${password}@aws-0-${region}.pooler.supabase.com:6543/${db}`;
		}
	}
	return url;
};

let _pgPool: Pool | null = null;

/** Pool Postgres direct partagé (singleton lazy) — réutiliser ce pool, ne jamais en créer un par requête. */
export function getPgPool(): Pool {
	if (!_pgPool) {
		_pgPool = new Pool({
			connectionString: getDatabaseURL(),
			connectionTimeoutMillis: 5_000,
			idleTimeoutMillis: 30_000,
			max: 10,
		});
	}
	return _pgPool;
}
