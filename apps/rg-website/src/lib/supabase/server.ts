// Wrapper rétro-compat — délègue à `@rg/db/{server,service}`. L'API publique
// `createClient()` / `createAdminClient()` / `createPublicClient()` est conservée
// pour ne pas casser les ~50 call sites de l'app.
import { createSupabaseServerClient } from "@rg/db/server";
import { createSupabaseServiceClient } from "@rg/db/service";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

/**
 * Server Component / Server Action / Route Handler — utilise les cookies Next.
 * Fluid compute friendly : nouveau client à chaque appel, pas de cache global.
 */
export async function createClient() {
	const cookieStore = await cookies();
	return createSupabaseServerClient({
		getAll: () => cookieStore.getAll(),
		set: (name, value, options) =>
			cookieStore.set(name, value, options as Record<string, unknown>),
	});
}

/**
 * Public anon client SANS cookies — utile pour Server Components ISR/SSG (pas d'auth visiteur).
 */
export function createPublicClient() {
	const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
	const supabaseAnonKey =
		process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
		process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

	return createSupabaseClient(supabaseUrl, supabaseAnonKey, {
		auth: {
			autoRefreshToken: false,
			persistSession: false,
		},
	});
}

/**
 * Admin client (service role) — bypass RLS. À utiliser server-side seulement.
 */
export function createAdminClient() {
	return createSupabaseServiceClient();
}
