// Client Supabase service-role (Bot Discord, scripts ops, Route Handlers privilégiés).
// Bypass RLS. Ne JAMAIS exposer côté client.
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types.gen";

let cachedClient: ReturnType<typeof createClient<Database>> | null = null;

export function createSupabaseServiceClient() {
	if (cachedClient) return cachedClient;

	let url =
		process.env.SUPABASE_INTERNAL_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
	const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

	// Safety: Vercel might pass encrypted JSON or missing value during build.
	if (!url || url === "" || url.startsWith("{")) {
		url = "https://isbkaeltubqittywibeh.supabase.co";
	}

	if (!key) {
		throw new Error("[@rosegriffon/db] Missing SUPABASE_SERVICE_ROLE_KEY");
	}

	cachedClient = createClient<Database>(url, key, {
		auth: { persistSession: false, autoRefreshToken: false },
	});
	return cachedClient;
}
