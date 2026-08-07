import { getPgPool } from "@/lib/db/pg";

// Lecture Postgres DIRECTE (bypass le Data API PostgREST de Supabase) — cf.
// lib/db/pg.ts. Utilisé par la page de profil public `/profil/[username]`
// (visitable par tout visiteur non-connecté). `profiles.username` porte une
// contrainte UNIQUE (cf. data/schema-snapshot) → LIMIT 1 reproduit fidèlement
// le `.single()` Supabase pour le cas nominal.

export interface ProfileMeta {
	full_name: string | null;
	bio: string | null;
}

// `SELECT *` reproduit exactement la forme retournée par `.from("profiles").select("*")`
// (toutes les colonnes, y compris celles ajoutées après le dernier snapshot de schéma) —
// pas de liste de colonnes figée ici pour éviter toute dérive de schéma. Typé en
// `Record<string, any>` (comme l'ancien `(supabase as any)`) : la page consommatrice
// indexe des colonnes potentiellement nullable (`roleConfig[profile.role]`) sans guard.
export type ProfileRow = Record<string, any>;

/** Utilisé par `generateMetadata` — mêmes colonnes que l'ancien `.select("full_name, bio")`. */
export async function getProfileMetaByUsername(username: string): Promise<ProfileMeta | null> {
	try {
		const pool = getPgPool();
		const { rows } = await pool.query<ProfileMeta>(
			"SELECT full_name, bio FROM profiles WHERE username = $1 LIMIT 1",
			[username]
		);
		return rows[0] ?? null;
	} catch (error) {
		console.error(`Error fetching profile meta for ${username}:`, error);
		return null;
	}
}

/** Utilisé par la page — mêmes colonnes que l'ancien `.select("*")`. */
export async function getProfileByUsername(username: string): Promise<ProfileRow | null> {
	try {
		const pool = getPgPool();
		const { rows } = await pool.query<ProfileRow>(
			"SELECT * FROM profiles WHERE username = $1 LIMIT 1",
			[username]
		);
		return rows[0] ?? null;
	} catch (error) {
		console.error(`Error fetching profile for ${username}:`, error);
		return null;
	}
}
