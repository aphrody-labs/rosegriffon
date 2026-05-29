// Re-export pour compat backward — utiliser directement `@rose-griffon/db/browser` dans les nouveaux modules.
// Cast en SupabaseClient permissif : le typing strict <Database> de `@rose-griffon/db` casse les call
// Sites azalee historiques (colonnes obsolètes, types nullable vs strict). Trade-off assumé.
import { createSupabaseBrowserClient } from "@rose-griffon/db/browser";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Creates a browser Supabase client (anon, no auth).
 * For authenticated requests, use the SupabaseProvider context instead.
 */
export const createClient = (): SupabaseClient =>
	createSupabaseBrowserClient() as unknown as SupabaseClient;
