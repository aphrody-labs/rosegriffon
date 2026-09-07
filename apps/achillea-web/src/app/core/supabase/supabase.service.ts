import { Injectable } from "@angular/core";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { environment } from "../../../environments/environment";

/**
 * Client Supabase partagé du front.
 *
 * Périmètre : lecture directe du dashboard (tables/vues ouvertes en RLS) + auth.
 * Les écritures à logique métier (elo, wallet, sanctions, ranked live) restent
 * sur l'API du bot. La clé est la clé publishable (publique).
 */
@Injectable({ providedIn: "root" })
export class SupabaseService {
	readonly client: SupabaseClient = createClient(environment.supabaseUrl, environment.supabaseKey, {
		auth: {
			persistSession: true,
			autoRefreshToken: true,
			detectSessionInUrl: true,
			flowType: "pkce",
		},
	});

	/** Raccourci vers le query builder d'une table/vue. */
	from(relation: string) {
		return this.client.from(relation);
	}
}
