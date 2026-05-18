// Wrapper rétro-compat — délègue à `@rose-griffon/db/browser`. L'API publique
// `createClient()` est conservée pour ne pas casser les ~30 call sites.
// Cast en SupabaseClient permissif : cf. justification dans server.ts.
import { createSupabaseBrowserClient } from "@rose-griffon/db/browser";
import type { SupabaseClient } from "@supabase/supabase-js";

export function createClient(): SupabaseClient {
	return createSupabaseBrowserClient() as unknown as SupabaseClient;
}
