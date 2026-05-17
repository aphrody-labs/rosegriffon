"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { createClient } from "@/lib/supabase/client";

export function RealtimeSettingsListener() {
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    // Listen to changes in the 'settings' table
    const channel = supabase
      .channel("settings-realtime")
      .on(
        "postgres_changes",
        {
          event: "*", // Listen to INSERT, UPDATE, DELETE
          schema: "public",
          table: "settings",
        },
        () => {
          // Refresh the current route server components
          router.refresh();
          // Optional: Show a toast to indicate live update (can be removed if too noisy)
          // toast.info("Contenu mis à jour en temps réel");
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, router]);

  return null; // Headless component
}
