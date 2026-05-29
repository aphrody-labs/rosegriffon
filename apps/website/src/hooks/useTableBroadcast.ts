import type { RealtimeChannel } from "@supabase/supabase-js";
import { useEffect, useRef } from "react";

import { createClient } from "@/lib/supabase/client";

export interface BroadcastTableEvent<T> {
	type: "INSERT" | "UPDATE" | "DELETE";
	new: T;
	old?: T;
}

export interface UseTableBroadcastOptions<T = Record<string, unknown>> {
	table: string;
	schema?: string;
	filter?: string;
	onInsert?: (data: T) => void;
	onUpdate?: (data: T) => void;
	onDelete?: (data: T) => void;
}

export function useTableBroadcast<T = Record<string, unknown>>({
	table,
	schema = "public",
	filter,
	onInsert,
	onUpdate,
	onDelete,
}: UseTableBroadcastOptions<T>) {
	const channelRef = useRef<RealtimeChannel | null>(null);

	useEffect(() => {
		const supabase = createClient();
		const channelName = filter ? `${table}:${filter}` : table;

		const channel = supabase.channel(channelName, {
			config: { broadcast: { self: true } },
		});

		channel
			.on(
				"postgres_changes" as unknown as never,
				{
					event: "*",
					filter,
					schema,
					table,
				},
				(payload: unknown) => {
					const typedPayload = payload as {
						eventType: string;
						new?: T;
						old?: T;
					};
					const event = typedPayload.eventType as "INSERT" | "UPDATE" | "DELETE";

					switch (event) {
						case "INSERT": {
							onInsert?.(typedPayload.new as T);
							break;
						}
						case "UPDATE": {
							onUpdate?.(typedPayload.new as T);
							break;
						}
						case "DELETE": {
							onDelete?.(typedPayload.old as T);
							break;
						}
					}
				}
			)
			.subscribe();

		channelRef.current = channel;

		return () => {
			supabase.removeChannel(channel);
		};
	}, [table, schema, filter, onInsert, onUpdate, onDelete]);
}
