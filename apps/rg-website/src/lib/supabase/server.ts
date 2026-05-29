// Wrapper rétro-compat — délègue à `@rose-griffon/db/{server,service}`. L'API publique
// `createClient()` / `createAdminClient()` / `createPublicClient()` est conservée
// Pour ne pas casser les ~50 call sites de l'app.
//
// `as SupabaseClient` (sans generic) bypasse le typage strict <Database> hérité
// Du package — le code historique référence des colonnes obsolètes vs le schéma
// Supabase courant (ex: profiles.created_at, articles.tags). Trade-off assumé
// Le temps de la migration : les call sites restent typés `any`, à durcir par
// Vague avec types stricts opt-in.
import { createSupabaseServerClient } from "@rose-griffon/db/server";
import { createSupabaseServiceClient } from "@rose-griffon/db/service";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

export async function createClient(): Promise<SupabaseClient> {
	const cookieStore = await cookies();
	return createSupabaseServerClient({
		getAll: () => cookieStore.getAll(),
		set: (name, value, options) => cookieStore.set(name, value, options),
	}) as unknown as SupabaseClient;
}

export function createPublicClient(): SupabaseClient {
	let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
	let supabaseAnonKey =
		process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

	// Safety: Vercel might pass encrypted JSON or empty string during build.
	if (
		!supabaseUrl ||
		supabaseUrl === "undefined" ||
		supabaseUrl === "null" ||
		!supabaseUrl.startsWith("http") ||
		supabaseUrl.startsWith("eyJ2Ijo")
	) {
		supabaseUrl = "https://isbkaeltubqittywibeh.supabase.co";
	}

	if (
		!supabaseAnonKey ||
		supabaseAnonKey.startsWith("{") ||
		supabaseAnonKey.startsWith("eyJ2Ijo")
	) {
		supabaseAnonKey =
			"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlzYmthZWx0dWJxaXR0eXdpYmVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1NDYyNzUsImV4cCI6MjA5MjEyMjI3NX0.eAyJfqREb8Kh5F_yLf5Jp43S2qOil4qUcqFTLQiExx0";
	}

	return createSupabaseClient(supabaseUrl, supabaseAnonKey, {
		auth: {
			autoRefreshToken: false,
			persistSession: false,
		},
	});
}

export function createAdminClient(): SupabaseClient {
	return createSupabaseServiceClient() as unknown as SupabaseClient;
}
