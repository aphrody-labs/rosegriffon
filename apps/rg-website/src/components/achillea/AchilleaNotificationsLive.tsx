"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { createSupabaseBrowserClient } from "@rosegriffon/db/browser";

import { createAchilleaClient, useAchilleaAuth } from "@/lib/achillea";

import { EVENEMENT_NOTIFICATION, lireSignal, topicNotifications } from "./notifications-live";

/**
 * Notifications Achilléa en direct (expulsion, candidatures, invitations,
 * dissolution) : à chaque signal du topic du joueur connecté, relit sa boîte
 * avec sa session et affiche la notification signalée.
 */
export function AchilleaNotificationsLive() {
  const { user, isAuthenticated } = useAchilleaAuth();
  const userId = isAuthenticated ? user?.id : undefined;

  useEffect(() => {
    if (!userId) return;
    const client = createAchilleaClient({ credentials: "include" });
    const deja = new Set<number>();
    let supabase: ReturnType<typeof createSupabaseBrowserClient>;
    try {
      supabase = createSupabaseBrowserClient();
    } catch (error) {
      console.warn("[achillea] temps réel indisponible", error);
      return;
    }
    const canal = supabase
      .channel(topicNotifications(userId), { config: { private: false } })
      .on("broadcast", { event: EVENEMENT_NOTIFICATION }, async message => {
        const signal = lireSignal(message.payload);
        if (!signal || deja.has(signal.notificationId)) return;
        deja.add(signal.notificationId);
        const boite = await client.notifications.mine();
        if (!boite.ok) return;
        const notification = boite.value.data?.find(n => n.id === signal.notificationId);
        if (notification) toast(notification.title, { description: notification.message });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(canal);
    };
  }, [userId]);

  return null;
}
