"use client";

import { Button } from "@rosegriffon/ui";
import Link from "next/link";
import { useEffect } from "react";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60dvh] flex-col items-center justify-center gap-4 p-4 text-center">
      <h1 className="text-2xl font-bold text-balance">Cette page n&apos;a pas pu s&apos;afficher</h1>
      <p className="max-w-md text-muted-foreground text-pretty">
        Un incident a interrompu le chargement. Réessayez ; si le problème persiste, revenez à l&apos;accueil.
      </p>
      {error.digest && <p className="font-mono text-xs text-muted-foreground">Référence : {error.digest}</p>}
      <div className="flex flex-wrap justify-center gap-3">
        <Button onClick={() => reset()}>Réessayer</Button>
        <Button asChild variant="outline">
          <Link href="/">Retour à l&apos;accueil</Link>
        </Button>
      </div>
    </div>
  );
}
