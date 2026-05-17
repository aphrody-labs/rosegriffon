// Re-export pour compat backward — utiliser directement `@rg/db/browser` dans les nouveaux modules.
// Cast en SupabaseClient permissif : le typing strict <Database> de `@rg/db` casse les call
// sites azalee historiques (colonnes obsolètes, types nullable vs strict). Trade-off assumé.
import { createSupabaseBrowserClient } from "@rg/db/browser";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Creates a browser Supabase client (anon, no auth).
 * For authenticated requests, use the SupabaseProvider context instead.
 */
export const createClient = (): SupabaseClient =>
	createSupabaseBrowserClient() as unknown as SupabaseClient;
