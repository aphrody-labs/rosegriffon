import { Skeleton } from "@rose-griffon/ui";

export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Skeleton className="size-20 rounded-full bg-surface-container-highest" />
        <div className="space-y-2">
          <Skeleton className="h-6 w-40 rounded bg-surface-container-highest" />
          <Skeleton className="h-4 w-24 rounded bg-surface-container-highest" />
        </div>
      </div>
      <Skeleton className="h-20 w-full rounded-2xl bg-surface-container-highest" />
      <Skeleton className="h-40 w-full rounded-2xl bg-surface-container-highest" />
    </div>
  );
}
