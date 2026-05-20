import type { Metadata } from "next";
import { Suspense } from "react";

import TeamsSection from "../_components/teams";
import { TeamSectionSkeleton } from "./team-skeleton";

export const metadata: Metadata = {
  description:
    "Découvrez les talents qui donnent vie à l'univers de Rose Griffon. Notre équipe passionnée de créateurs, artistes et producteurs.",
  title: "Notre Équipe - Staff | Rose Griffon",
};

// ISR: Revalidate toutes les heures (équipe rarement modifiée)
export const revalidate = 3600; // 1 heure

export default function StaffPage() {
  return (
    <main className="min-h-screen">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-linear-to-b from-gaelle-blue/5 via-transparent to-gaelle-blue-light/5 pointer-events-none" />

      <div className="relative container mx-auto py-12 lg:py-20 px-4 lg:px-8">
        <Suspense fallback={<TeamSectionSkeleton />}>
          <TeamsSection />
        </Suspense>
      </div>
    </main>
  );
}
