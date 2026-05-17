// Wrapper rétro-compat — délègue à `@rg/db/browser`. L'API publique
// `createClient()` est conservée pour ne pas casser les ~30 call sites.
import { createSupabaseBrowserClient } from "@rg/db/browser";

export function createClient() {
	return createSupabaseBrowserClient();
}
