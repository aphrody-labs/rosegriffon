/**
 * Connecteur et configuration de la base de données Achilléa.
 *
 * Les deux bases vivent sur le même cluster PostgreSQL :
 * - `rg` (Supabase principal Rose Griffon)
 * - `achillea` (PostgreSQL / MikroORM compétitif)
 *
 * Le schéma étranger `rg.achillea` (alimenté par `postgres_fdw` et synchronisé via `sync:achillea`)
 * permet à Rose Griffon de requêter directement les tables compétitives.
 */

export const ACHILLEA_SCHEMA = "achillea" as const;

export function getAchilleaDatabaseUrl(): string {
	return (
		process.env["ACHILLEA_DATABASE_URL"] ||
		process.env["DATABASE_URL"] ||
		"postgresql://postgres:postgres@localhost:5432/achillea"
	);
}

export function getAchilleaApiUrl(): string {
	return (
		process.env["NEXT_PUBLIC_ACHILLEA_API_URL"] ||
		process.env["ACHILLEA_API_URL"] ||
		"https://api.rosegriffon.fr"
	);
}
