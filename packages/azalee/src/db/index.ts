/**
 * Couche d'accès aux données de jeu.
 *
 * ⚠ Module **serveur** : touche `bun:sqlite` / `node:sqlite`. À ne jamais
 * importer depuis un contexte navigateur (webview Tauri, composant client).
 */

export { createSqliteClient, SqliteQueryBuilder } from "./sqlite-client";
export { createPostgresClient, PostgresQueryBuilder } from "@rosegriffon/db/postgres-client";
export {
	createClient,
	hasDatabaseProvider,
	setDatabaseProvider,
	type DatabaseClient, type DatabaseClientFactory,
} from "./provider";
export { resolveMirrorPath } from "../config";
