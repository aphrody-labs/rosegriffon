// Façade SQL serveur partagée par le bot, cron, auth et les Route Handlers.
// Les noms historiques sont conservés pour éviter une migration atomique de tous
// les consommateurs ; l'implémentation ne passe plus par PostgREST.
import { createPostgresClient } from "./postgres-client";

export { createPostgresClient } from "./postgres-client";

let cachedClient: ReturnType<typeof createPostgresClient> | null = null;

// Compatibility façade: callers still using the historical Supabase surface
// are intentionally allowed to evolve independently while the implementation
// is backed by Kysely/PostgreSQL. Domain-specific code should migrate to the
// typed Kysely client; this boundary prevents a monorepo-wide type lock-in.
export function createSupabaseServiceClient(): any {
	if (cachedClient) return cachedClient;

	cachedClient = createPostgresClient();
	return cachedClient;
}
