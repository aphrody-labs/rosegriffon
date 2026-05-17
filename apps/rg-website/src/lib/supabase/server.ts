// Wrapper rétro-compat — délègue à `@rg/db/{server,service}`. L'API publique
// `createClient()` / `createAdminClient()` / `createPublicClient()` est conservée
// pour ne pas casser les ~50 call sites de l'app.
//
// `as SupabaseClient` (sans generic) bypasse le typage strict <Database> hérité
// du package — le code historique référence des colonnes obsolètes vs le schéma
// Supabase courant (ex: profiles.created_at, articles.tags). Trade-off assumé
// le temps de la migration : les call sites restent typés `any`, à durcir par
// vague avec types stricts opt-in.
import { createSupabaseServerClient } from "@rg/db/server";
import { createSupabaseServiceClient } from "@rg/db/service";
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

export function createAdminClient(): SupabaseClient {
	return createSupabaseServiceClient() as unknown as SupabaseClient;
}
