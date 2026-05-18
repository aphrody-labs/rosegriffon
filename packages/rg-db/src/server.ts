// Client Supabase server-side (Next.js server components, Route Handlers, Server Actions).
// Lit/écrit les cookies Next via `next/headers` — donc nécessite Next runtime.
import { createServerClient, type CookieOptions } from "@supabase/ssr";

export interface CookieStore {
	getAll: () => Array<{ name: string; value: string }>;
	set?: (name: string, value: string, options?: CookieOptions) => void;
}

export function createSupabaseServerClient(cookies: CookieStore) {
	let url = process.env.NEXT_PUBLIC_SUPABASE_URL;
	const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

	// Safety: Vercel might pass encrypted JSON or missing value during build.
	if (!url || url === "undefined" || url === "null" || !url.startsWith("http")) {
		url = "https://isbkaeltubqittywibeh.supabase.co";
	}

	if (!key) {
		throw new Error(
			"[@rosegriffon/db] Missing NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
		);
	}

	return createServerClient(url, key, {
		cookies: {
			getAll() {
				return cookies.getAll();
			},
			setAll(
				cookiesToSet: Array<{
					name: string;
					value: string;
					options?: CookieOptions;
				}>,
			) {
				try {
					for (const { name, value, options } of cookiesToSet) {
						cookies.set?.(name, value, options);
					}
				} catch {
					// Server Component context — cookies are read-only. Middleware refreshes la session.
				}
			},
		},
	});
}
