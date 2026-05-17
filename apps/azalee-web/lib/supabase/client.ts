// Re-export pour compat backward — utiliser directement `@rg/db/browser` dans les nouveaux modules.
import { createSupabaseBrowserClient } from "@rg/db/browser";

/**
 * Creates a browser Supabase client (anon, no auth).
 * For authenticated requests, use the SupabaseProvider context instead.
 */
export const createClient = () => createSupabaseBrowserClient();
