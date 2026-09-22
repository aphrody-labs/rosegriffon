declare module "@rosegriffon/db" {
	export function createPostgresClient(connectionString?: string): any;
}

declare module "@rosegriffon/db/postgres-client" {
	export function createPostgresClient(connectionString?: string): any;
}

declare module "@rosegriffon/db/achillea" {
	export const ACHILLEA_SCHEMA: "achillea";
	export function getAchilleaDatabaseUrl(): string;
}

declare module "@rosegriffon/db/achillea-sql" {
	export function createAchilleaSql<DB extends object = never>(
	options?: { url?: string; maxConnections?: number },
): import("kysely").Kysely<DB>;
	export function destroyAchilleaSql(): Promise<void>;
}

declare module "@rosegriffon/db/schema" {
	export interface Database {
		user: {
			id: string;
		};
		user_connection: {
			id: import("kysely").Generated<number>;
			created_at: import("kysely").Generated<Date>;
			updated_at: import("kysely").Generated<Date>;
			user_id: string;
			provider: string;
			external_id: string | null;
			external_username: string | null;
			access_token: string | null;
			refresh_token: string | null;
		};
		oauth_csrf: {
			token: string;
			discord_id: string;
			created_at: import("kysely").Generated<Date>;
			updated_at: import("kysely").Generated<Date>;
		};
	}
}
