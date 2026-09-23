export interface RealtimeEvent {
	schema: string;
	table: string;
	eventType: "INSERT" | "UPDATE" | "DELETE";
	new?: Record<string, unknown> | null;
	old?: Record<string, unknown> | null;
	truncated?: boolean;
}

const PUBLIC_TABLES = new Set([
	"comments",
	"settings",
	"profiles",
	"discord_channels",
	"discord_messages",
	"discord_polls",
	"discord_poll_options",
]);

export function isPublicSubscription(schema: string, table: string): boolean {
	return schema === "public" && PUBLIC_TABLES.has(table);
}

/** Settings changes only need to invalidate the browser's server-rendered data. */
export function publicEvent(event: RealtimeEvent): RealtimeEvent | null {
	if (!isPublicSubscription(event.schema, event.table)) return null;
	if (event.table === "settings") {
		return { schema: event.schema, table: event.table, eventType: event.eventType, truncated: true };
	}
	return event;
}
