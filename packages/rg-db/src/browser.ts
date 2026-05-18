// Client Supabase browser-side (Next.js client components).
// Singleton — un seul client par tab.
import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./types.gen";

let cachedClient: ReturnType<typeof createBrowserClient<Database>> | null =
	null;

export function createSupabaseBrowserClient() {
	if (cachedClient) return cachedClient;

	let url = process.env.NEXT_PUBLIC_SUPABASE_URL;
	const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

	// Safety: Vercel might pass encrypted JSON or missing value during build.
	// We check for falsy, empty string or starting with {
	if (!url || url === "" || url === "undefined" || url === "null" || url.startsWith("{")) {
		url = "https://isbkaeltubqittywibeh.supabase.co";
	}

	if (!key) {
		throw new Error(
			"[@rosegriffon/db] Missing NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
		);
	}

	cachedClient = createBrowserClient<Database>(url, key);
	return cachedClient;
}
