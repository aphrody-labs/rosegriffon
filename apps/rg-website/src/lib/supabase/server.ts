// Wrapper rétro-compat — délègue à `@rosegriffon/db/{server,service}`. L'API publique
// `createClient()` / `createAdminClient()` / `createPublicClient()` est conservée
// pour ne pas casser les ~50 call sites de l'app.
//
// `as SupabaseClient` (sans generic) bypasse le typage strict <Database> hérité
// du package — le code historique référence des colonnes obsolètes vs le schéma
// Supabase courant (ex: profiles.created_at, articles.tags). Trade-off assumé
// le temps de la migration : les call sites restent typés `any`, à durcir par
// vague avec types stricts opt-in.
import { createSupabaseServerClient } from "@rosegriffon/db/server";
import { createSupabaseServiceClient } from "@rosegriffon/db/service";
import {
	createClient as createSupabaseClient,
	type SupabaseClient,
} from "@supabase/supabase-js";
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
		process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
		process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

	// Safety: Vercel might pass encrypted JSON or empty string during build.
	if (!supabaseUrl || supabaseUrl === "undefined" || supabaseUrl === "null" || !supabaseUrl.startsWith("http")) {
		supabaseUrl = "https://isbkaeltubqittywibeh.supabase.co";
	}

	if (!supabaseAnonKey || supabaseAnonKey.startsWith("{")) {
		supabaseAnonKey =
			"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlzYmthZWx0dWJxaXR0eXdpYmVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYwNjk0MzAsImV4cCI6MjA2MTY0NTQzMH0.N4l07k3V_X5I8iW0n_D6K9-O4v5l7l6s6MYGpJIXRW_rB8zc45k7chqi8Ljl_CLiLc=";
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
