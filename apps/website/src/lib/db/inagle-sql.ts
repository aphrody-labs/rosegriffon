import { createAchilleaSql } from "@rosegriffon/db/achillea-sql";
import { sql } from "kysely";

const db = createAchilleaSql();

const INAGLE_TABLES = new Set([
	"inagle_characters",
	"inagle_events",
	"inagle_items",
]);

/** Lecture serveur des projections Inagle sans passer par le miroir SQLite. */
export async function selectInagle<T extends object>(
	table: string,
	columns: string,
): Promise<T[]> {
	if (!INAGLE_TABLES.has(table)) {
		throw new Error(`Table Inagle non autorisée: ${table}`);
	}
	const result = await sql<T>`select ${sql.raw(columns)} from public.${sql.raw(table)}`.execute(db);
	return result.rows;
}
