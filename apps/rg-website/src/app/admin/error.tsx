"use client";

import { AlertCircle, Home, RefreshCcw } from "lucide-react";
import { useEffect } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Admin Global Error:", error);
  }, [error]);

  return (
    <div className="container max-w-4xl py-20 space-y-8">
      <div className="flex flex-col items-center justify-center text-center space-y-4">
        <div className="p-4 bg-red-50 rounded-full">
          <AlertCircle className="w-12 h-12 text-red-600" />
        </div>
        <h2 className="text-3xl font-bold tracking-tight text-foreground">
          Une erreur inattendue est survenue
        </h2>
        <p className="text-muted-foreground max-w-lg text-lg">
          Le panneau d'administration a rencontré un problème critique.
        </p>
      </div>

      <Alert
        variant="destructive"
        className="max-w-2xl mx-auto border-red-200 bg-red-50 dark:bg-red-950/20"
      >
        <AlertCircle className="h-4 w-4 text-red-600" />
        <AlertTitle className="text-red-800 dark:text-red-400">Détails techniques</AlertTitle>
        <AlertDescription className="mt-2 font-mono text-xs bg-muted/400 dark:bg-black/20 p-4 rounded border border-red-100 dark:border-red-900/50 text-red-900 dark:text-red-300 overflow-auto max-h-64">
          {error.message || "Erreur inconnue"}
          {error.digest && (
            <div className="mt-2 pt-2 border-t border-red-200/50 opacity-70">
              Digest: {error.digest}
            </div>
          )}
          {error.stack && (
            <div className="mt-2 pt-2 border-t border-red-200/50 opacity-70 whitespace-pre-wrap">
              {error.stack}
            </div>
          )}
        </AlertDescription>
      </Alert>

      <div className="flex justify-center gap-4">
        <Button onClick={() => (window.location.href = "/admin")} variant="outline" size="lg">
          <Home className="mr-2 h-4 w-4" />
          Tableau de bord
        </Button>
        <Button
          onClick={() => reset()}
          variant="default"
          size="lg"
          className="bg-red-600 hover:bg-red-700 text-white"
        >
          <RefreshCcw className="mr-2 h-4 w-4" />
          Réessayer
        </Button>
      </div>
    </div>
  );
}
