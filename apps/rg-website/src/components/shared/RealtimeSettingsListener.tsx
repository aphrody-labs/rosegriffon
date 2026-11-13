"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Rafraîchit les composants serveur dès qu'un réglage change en base.
 * Adossé au service rg-realtime (SSE) depuis la migration hors Supabase.
 *
 * ⚠ IMPORT DIFFÉRÉ, APRÈS LE CHARGEMENT. Un import statique de `@/lib/realtime`
 * embarquait supabase-js (171 Ko bruts, 47 Ko gzip) dans le JS initial de
 * l'accueil, pour un abonnement qui ne sert qu'après coup. Le module est chargé
 * quand le navigateur est inactif, hors du chemin critique (LCP, TBT).
 */
export function RealtimeSettingsListener() {
  const router = useRouter();

  useEffect(() => {
    let annule = false;
    let desabonner: (() => void) | null = null;
    const brancher = () => {
      void import("@/lib/realtime").then(({ subscribeTable }) => {
        if (annule) return;
        desabonner = subscribeTable({ table: "settings" }, () => {
          router.refresh();
        });
      });
    };
    const inactif = typeof window.requestIdleCallback === "function";
    const poignee = inactif
      ? window.requestIdleCallback(brancher, { timeout: 5000 })
      : window.setTimeout(brancher, 3000);
    return () => {
      annule = true;
      if (inactif) window.cancelIdleCallback(poignee);
      else window.clearTimeout(poignee);
      desabonner?.();
    };
  }, [router]);

  return null; // Composant sans rendu
}
