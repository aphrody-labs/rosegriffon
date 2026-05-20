import type { RealtimeChannel } from "@supabase/supabase-js";
import { useEffect, useRef } from "react";

import { createClient } from "@/lib/supabase/client";

export interface BroadcastProfileEvent {
  type: "INSERT" | "UPDATE" | "DELETE";
  new: Record<string, unknown>;
  old?: Record<string, unknown>;
}

export function useProfileBroadcast(
  userId: string | undefined,
  onProfileUpdate?: (event: BroadcastProfileEvent) => void
) {
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!userId) {return;}

    const supabase = createClient();
    const channel = supabase.channel(`profiles:${userId}`, {
      config: { broadcast: { self: true } },
    });

    channel
      .on(
        "postgres_changes",
        {
          event: "*",
          filter: `id=eq.${userId}`,
          schema: "public",
          table: "profiles",
        },
        (payload) => {
          const event: BroadcastProfileEvent = {
            new: payload.new,
            old: payload.old,
            type: payload.eventType as "INSERT" | "UPDATE" | "DELETE",
          };
          onProfileUpdate?.(event);
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, onProfileUpdate]);
}
