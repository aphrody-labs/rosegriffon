import { Injectable } from "@angular/core";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { environment } from "../../../environments/environment";

/**
 * Client Supabase partagé du front.
 *
 * Périmètre : lecture directe du dashboard (tables/vues publiques en RLS).
 * Les écritures à logique métier (elo, wallet, sanctions, ranked live) restent
 * sur l'API du bot. L'authentification utilisateur est centralisée dans
 * AuthSessionService et l'API Discord ; ce client n'entretient donc aucune
 * seconde session navigateur concurrente.
 */
@Injectable({ providedIn: "root" })
export class SupabaseService {
	readonly client: SupabaseClient = createClient(environment.supabaseUrl, environment.supabaseKey, {
		auth: {
			persistSession: false,
			autoRefreshToken: false,
			detectSessionInUrl: false,
			flowType: "pkce",
		},
	});

	/** Raccourci vers le query builder d'une table/vue. */
	from(relation: string) {
		return this.client.from(relation);
	}
}
