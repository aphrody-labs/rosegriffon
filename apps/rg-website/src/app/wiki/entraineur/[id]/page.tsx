export const dynamic = "force-static";
export const revalidate = 3600;

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CoachDetail } from "@/components/wiki/CoachDetail";
import { getCoach } from "@/lib/wiki/coaches";
import { wiki } from "@rosegriffon/app-shell";
import { absoluteUrl } from "@/lib/site-url";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const coach = await getCoach(Number(id));

  const name = coach?.name || "Entraîneur";
  const description = coach
    ? `${name} (${coach.roleFr})${coach.stat ? ` — passif d'équipe : ${coach.stat}${coach.buff ? ` ${coach.buff}` : ""}` : ""}. Inazuma Eleven: Victory Road.`
    : "Entraîneur Inazuma Eleven: Victory Road.";

  return {
    alternates: { canonical: wiki(`/entraineur/${id}`) },
    description,
    openGraph: {
      description,
      locale: "fr_FR",
      siteName: "Azalée - Inazuma Eleven Victory Road",
      title: `${name} | Azalée`,
      type: "article",
      url: `/wiki/entraineur/${id}`,
    },
    title: `${name} | Inazuma Eleven Victory Road - Azalée`,
  };
}

export default async function CoachDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const coach = await getCoach(Number(id));

  if (!coach) {
    notFound();
  }

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", item: absoluteUrl(wiki("/")), name: "Accueil", position: 1 },
      {
        "@type": "ListItem",
        item: absoluteUrl(wiki("/entraineur")),
        name: "Entraîneurs",
        position: 2,
      },
      {
        "@type": "ListItem",
        item: absoluteUrl(wiki(`/entraineur/${id}`)),
        name: coach.name,
        position: 3,
      },
    ],
  };

  return (
    <div className="w-full py-2">
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD statique
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <CoachDetail coach={coach} />
    </div>
  );
}
