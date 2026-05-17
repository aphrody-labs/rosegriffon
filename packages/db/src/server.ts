// Client Supabase server-side (Next.js server components, Route Handlers, Server Actions).
// Lit/écrit les cookies Next via `next/headers` — donc nécessite Next runtime.
import { createServerClient } from "@supabase/ssr";
import type { Database } from "./types.gen";

interface CookieStore {
	getAll: () => Array<{ name: string; value: string }>;
	set?: (
		name: string,
		value: string,
		options?: Record<string, unknown>,
	) => void;
}

export function createSupabaseServerClient(cookies: CookieStore) {
	const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
	const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
	if (!url || !key) {
		throw new Error(
			"[@rg/db] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
		);
	}
	return createServerClient<Database>(url, key, {
		cookies: {
			getAll() {
				return cookies.getAll();
			},
			setAll(
				cookiesToSet: Array<{
					name: string;
					value: string;
					options?: Record<string, unknown>;
				}>,
			) {
				try {
					for (const { name, value, options } of cookiesToSet) {
						cookies.set?.(name, value, options);
					}
				} catch {
					// Server Component context — cookies are read-only. Middleware refreshes the session.
				}
			},
		},
	});
}
