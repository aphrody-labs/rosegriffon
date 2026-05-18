// Client Supabase server-side (Next.js server components, Route Handlers, Server Actions).
// Lit/écrit les cookies Next via `next/headers` — donc nécessite Next runtime.
import { createServerClient, type CookieOptions } from "@supabase/ssr";

export interface CookieStore {
	getAll: () => Array<{ name: string; value: string }>;
	set?: (name: string, value: string, options?: CookieOptions) => void;
}

export function createSupabaseServerClient(cookies: CookieStore) {
	const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
	const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
	if (!url || !key) {
		throw new Error(
			"[@rose-griffon/db] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
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
