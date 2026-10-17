import { Skeleton } from "@rosegriffon/ui";

/**
 * Squelette par défaut des pages d'administration sans `loading.tsx` propre
 * (actualités, base de données, statistiques, audit, tweets…).
 */
export default function AdminLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 lg:px-8" role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">Chargement en cours…</span>
      <div className="space-y-8">
        <div className="space-y-2 border-b border-border pb-6">
          <Skeleton className="h-8 w-64 max-w-full" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-28 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-96 rounded-xl" />
      </div>
    </div>
  );
}
