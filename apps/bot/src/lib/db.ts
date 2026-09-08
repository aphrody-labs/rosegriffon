/**
 * Couche DB du bot — deux chemins sur la même Postgres Supabase.
 *
 *   - `supabase` (de @rosegriffon/db/service) : query builder typé. Préférer pour les queries
 *     simples (`from().select()`, `.insert()`, `.rpc()`) — type-checking sur les
 *     colonnes via le type `Database` généré.
 *   - `sql` (Bun.SQL) : connexion Postgres directe sur le pooler Supabase
 *     (DATABASE_URL = postgresql://postgres.<ref>:<pwd>@aws-0-<region>.pooler.supabase.com:6543/postgres).
 *     Préférer pour les queries SQL complexes (CTE, fenêtres, agrégats multi-niveaux)
 *     où le builder Supabase serait verbeux ou impossible.
 *
 * Les deux clients accèdent à la même base. Bypass RLS (service-role + connexion directe) —
 * ne JAMAIS exposer côté client (le bot tourne en Bun/serveur uniquement).
 */
import { SQL } from "bun";
import { createSupabaseServiceClient } from "@rosegriffon/db/service";

export const supabase = createSupabaseServiceClient();

const databaseUrl = Bun.env.DATABASE_URL;
if (!databaseUrl) {
	throw new Error(
		"[bot/db] DATABASE_URL is required (Supabase Postgres pooler URL — voir .env.example)"
	);
}

const configuredPoolMax = Number.parseInt(Bun.env.DATABASE_POOL_MAX ?? "", 10);
const poolMax = configuredPoolMax > 0 ? Math.min(configuredPoolMax, 4) : 4;

export const sql = new SQL({
	url: databaseUrl,
	max: poolMax,
	idleTimeout: 30,
	maxLifetime: 1_800,
	connectionTimeout: 10,
});
