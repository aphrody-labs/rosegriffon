// Re-export pour compat backward — utiliser directement `@rose-griffon/db/service` dans les nouveaux modules.
// Cast en SupabaseClient permissif (cf. lib/supabase/client.ts pour le rationale).
import { createSupabaseServiceClient } from "@rose-griffon/db/service";
import type { SupabaseClient } from "@supabase/supabase-js";

export function createAdminClient(): SupabaseClient {
	return createSupabaseServiceClient() as unknown as SupabaseClient;
}
