// Client Supabase browser-side (Next.js client components).
// Singleton — un seul client par tab.
import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./types.gen";

let cachedClient: ReturnType<typeof createBrowserClient<Database>> | null =
	null;

export function createSupabaseBrowserClient() {
	if (cachedClient) return cachedClient;
	const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
	const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
	if (!url || !key) {
		throw new Error(
			"[@rose-griffon/db] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
		);
	}
	cachedClient = createBrowserClient<Database>(url, key);
	return cachedClient;
}
