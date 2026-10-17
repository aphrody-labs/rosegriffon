"use client";

import { Button } from "@rosegriffon/ui";
import { useEffect } from "react";

import { AlertTriangle } from "@/lib/icons-config";

interface AdminErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export function AdminError({ error, reset }: AdminErrorProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center h-[50vh] space-y-4 text-center p-6">
      <div className="p-4 bg-destructive/10 rounded-full">
        <AlertTriangle className="size-8 text-destructive" />
      </div>
      <h2 className="text-2xl font-bold">Une erreur est survenue</h2>
      <p className="text-muted-foreground max-w-md">
        {error.message || "Impossible de charger les données. Veuillez réessayer."}
      </p>
      <Button onClick={() => reset()} variant="default">
        Réessayer
      </Button>
    </div>
  );
}
