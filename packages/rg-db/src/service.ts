// Client Supabase service-role (Bot Discord, scripts ops, Route Handlers privilégiés).
// Bypass RLS. Ne JAMAIS exposer côté client.
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types.gen";

let cachedClient: ReturnType<typeof createClient<Database>> | null = null;

export function createSupabaseServiceClient() {
	if (cachedClient) return cachedClient;
	const url =
		process.env.SUPABASE_INTERNAL_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
	const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
	if (!url || !key) {
		throw new Error(
			"[@rose-griffon/db] Missing SUPABASE_INTERNAL_URL/NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
		);
	}
	cachedClient = createClient<Database>(url, key, {
		auth: { persistSession: false, autoRefreshToken: false },
	});
	return cachedClient;
}
