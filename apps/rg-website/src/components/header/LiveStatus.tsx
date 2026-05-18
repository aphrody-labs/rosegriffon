"use client";

import { Button } from "@rose-griffon/ui";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@rose-griffon/ui";
import { Tv, Users, Video } from "@/lib/icons-config";
import { cn } from "@/lib/utils";

interface StreamStatus {
  isLive: boolean;
  title?: string;
  gameName?: string;
  viewerCount?: number;
  startedAt?: string;
  thumbnailUrl?: string;
  error?: string;
}

/**
 * Indicateur de statut live Twitch
 * Affiche un badge pulsant quand le stream est actif
 * Refresh automatique toutes les 60 secondes
 */
export function LiveStatus() {
  const [status, setStatus] = useState<StreamStatus>({ isLive: false });
  const [loading, setLoading] = useState(true);
  const [retryCount, setRetryCount] = useState(0);

  // Fonction de récupération du statut avec gestion d'erreur
  const fetchStatus = useCallback(async () => {
    try {
      const response = await fetch("/api/public/rgtv/status", {
        // Cache pour éviter requêtes excessives
        next: { revalidate: 60 },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const rawData = await response.json();
      setStatus({
        isLive: rawData.live?.is_live || false,
        title: rawData.live?.title,
        gameName: rawData.live?.category,
        viewerCount: rawData.live?.viewers,
        startedAt: rawData.live?.started_at,
      });
      setRetryCount(0); // Reset retry count on success
    } catch (error) {
      console.error("Erreur récupération statut live:", error);
      setStatus({ isLive: false, error: "Erreur de connexion" });

      // Augmenter retry count pour backoff exponentiel
      setRetryCount((prev) => Math.min(prev + 1, 5));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Fetch initial
    fetchStatus();

    // Backoff exponentiel: 60s, 120s, 240s, etc.
    const refreshInterval = 60000 * 2 ** Math.min(retryCount, 3);
    const interval = setInterval(fetchStatus, refreshInterval);

    return () => clearInterval(interval);
  }, [fetchStatus, retryCount]);

  // Ne rien afficher pendant le chargement ou si pas live
  if (loading || !status.isLive) {
    return null;
  }

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Link href="/rose-griffon-tv" className="group">
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "relative gap-1.5 sm:gap-2",
                "bg-red-600/10 hover:bg-red-600/20",
                "text-red-600 dark:text-red-400",
                "border border-red-600/30",
                "hover:border-red-600/50",
                "font-bold shadow-sm hover:shadow-md",
                "transition-all duration-300 ease-in-out",
                "hover:scale-105 active:scale-95",
                "focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-red-500"
              )}
              aria-label="Rose Griffon TV est en direct - Cliquez pour regarder"
            >
              {/* Badge LIVE pulsant avec double animation */}
              <span className="relative flex size-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full size-3 bg-red-500 animate-pulse" />
              </span>

              {/* Texte LIVE */}
              <span className="text-xs sm:text-sm tracking-wide">LIVE</span>

              {/* Viewers count (desktop only) avec animation */}
              {status.viewerCount !== undefined && status.viewerCount > 0 && (
                <span className="hidden sm:flex items-center gap-1 text-xs font-normal">
                  <Users className="h-3.5 w-3.5 group-hover:animate-pulse" />
                  {formatViewerCount(status.viewerCount)}
                </span>
              )}

              {/* Icône TV (très petits écrans) */}
              <Tv className="size-4 sm:hidden group-hover:animate-pulse" />
            </Button>
          </Link>
        </TooltipTrigger>

        <TooltipContent side="bottom" className="max-w-xs sm:max-w-sm p-3 shadow-lg" sideOffset={5}>
          <div className="space-y-2">
            {/* Header du tooltip */}
            <div className="flex items-center gap-2">
              <div className="relative flex size-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full size-2 bg-red-500" />
              </div>
              <span className="font-semibold text-sm">Rose Griffon TV est en direct !</span>
            </div>

            {/* Titre du stream */}
            {status.title && <p className="text-sm text-foreground line-clamp-2">{status.title}</p>}

            {/* Informations additionnelles */}
            <div className="flex flex-col gap-1 text-xs text-muted-foreground">
              {status.gameName && (
                <div className="flex items-center gap-1.5">
                  <Video className="h-3.5 w-3.5 text-red-500" />
                  <span>{status.gameName}</span>
                </div>
              )}

              {status.viewerCount !== undefined && status.viewerCount > 0 && (
                <div className="flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 text-red-500" />
                  <span>{formatViewerCount(status.viewerCount)} spectateurs</span>
                </div>
              )}

              {status.startedAt && (
                <div className="flex items-center gap-1.5 mt-1 pt-1 border-t">
                  <span className="text-xs opacity-70">
                    Depuis {formatStreamDuration(status.startedAt)}
                  </span>
                </div>
              )}
            </div>

            {/* CTA */}
            <div className="pt-2 border-t">
              <p className="text-xs font-medium text-red-600 dark:text-red-400">
                👉 Cliquez pour regarder en direct
              </p>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Formate le nombre de viewers de manière lisible
 */
function formatViewerCount(count: number): string {
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}k`;
  }
  return count.toString();
}

/**
 * Calcule la durée du stream depuis le début
 */
function formatStreamDuration(startedAt: string): string {
  const start = new Date(startedAt);
  const now = new Date();
  const diffMs = now.getTime() - start.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 60) {
    return `${diffMins} min`;
  }

  const hours = Math.floor(diffMins / 60);
  const mins = diffMins % 60;

  return `${hours}h${mins > 0 ? ` ${mins}min` : ""}`;
}