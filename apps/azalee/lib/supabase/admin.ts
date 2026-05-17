// Re-export pour compat backward — utiliser directement `@rg/db/service` dans les nouveaux modules.
import { createSupabaseServiceClient } from "@rg/db/service";

export function createAdminClient() {
	return createSupabaseServiceClient();
}
