import { Skeleton } from "@rose-griffon/ui";

export default function Loading() {
  return (
    <div className="space-y-12">
      {/* Hero skeleton */}
      <div className="relative h-[60vh] min-h-[400px] rounded-3xl overflow-hidden bg-surface-container-highest">
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-8">
          <Skeleton className="h-10 w-64 bg-surface-container-high rounded-lg" />
          <Skeleton className="h-6 w-96 max-w-full bg-surface-container-high rounded-md" />
          <Skeleton className="h-12 w-48 bg-surface-container-high rounded-full mt-4" />
        </div>
      </div>

      {/* Wiki carousel skeleton */}
      <div className="space-y-4">
        <Skeleton className="h-8 w-48 bg-surface-container-highest rounded-lg" />
        <div className="flex gap-4 overflow-hidden">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton
              key={i}
              className="h-32 w-56 shrink-0 bg-surface-container-highest rounded-2xl"
            />
          ))}
        </div>
      </div>

      {/* News skeleton */}
      <div className="space-y-4">
        <Skeleton className="h-8 w-40 bg-surface-container-highest rounded-lg" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-2xl bg-surface-container-low overflow-hidden">
              <Skeleton className="w-full aspect-video bg-surface-container-highest" />
              <div className="p-4 space-y-2">
                <Skeleton className="h-5 w-3/4 bg-surface-container-highest rounded-md" />
                <Skeleton className="h-4 w-1/2 bg-surface-container-highest rounded-md" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
