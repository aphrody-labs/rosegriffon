"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 text-center">
      <h2 className="mb-4 text-2xl font-bold">Une erreur est survenue !</h2>
      <p className="mb-4 text-muted-foreground">
        Nous sommes désolés, une erreur inattendue s&apos;est produite.
      </p>
      <Button onClick={() => reset()}>Réessayer</Button>
    </div>
  );
}
