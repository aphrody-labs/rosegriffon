export const dynamic = "force-dynamic";

import { Suspense } from "react";

import { Skeleton } from "@rg/ui";

import AssoMembersSection from "../_components/asso";
import BoardMembersSection from "../_components/board";

export default function AssociationPage() {
  return (
    <main className="min-h-screen bg-linear-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-950">
      <div className="container mx-auto py-8 lg:py-16 px-4 lg:px-8 space-y-20 lg:space-y-32">
        <Suspense fallback={<TeamSectionSkeleton />}>
          <BoardMembersSection />
        </Suspense>

        <Suspense fallback={<TeamSectionSkeleton />}>
          <AssoMembersSection />
        </Suspense>
      </div>
    </main>
  );
}

function TeamSectionSkeleton() {
  return (
    <section className="flex flex-col gap-10 lg:gap-12 animate-pulse">
      <div className="text-center space-y-4 max-w-4xl mx-auto">
        <Skeleton className="h-14 lg:h-16 w-3/4 lg:w-96 mx-auto bg-linear-to-r from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-800 rounded-2xl" />
        <Skeleton className="h-24 lg:h-28 w-full max-w-3xl mx-auto bg-gray-200 dark:bg-gray-800 rounded-xl" />
        <Skeleton className="h-1 w-24 mx-auto bg-gaelle-blue/30 dark:bg-gaelle-blue/50 rounded-full" />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6 lg:gap-8 mt-6">
        {[...Array(6)].map((_, index) => (
          <div key={index} className="flex flex-col items-center text-center gap-4 p-4 sm:p-6">
            <Skeleton className="size-28 sm:w-36 sm:h-36 lg:w-40 lg:h-40 rounded-full bg-linear-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-800" />
            <div className="space-y-2 w-full">
              <Skeleton className="h-5 sm:h-6 w-3/4 mx-auto bg-gray-200 dark:bg-gray-700 rounded-lg" />
              <Skeleton className="h-4 w-1/2 mx-auto bg-gray-200 dark:bg-gray-700 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
