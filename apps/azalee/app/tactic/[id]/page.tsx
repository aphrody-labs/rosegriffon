export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TacticDetail } from "@/components/wiki/TacticDetail";
import { wikiService } from "@/lib/wiki-service";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const tactic = await wikiService.getTactic(id);

  const name = tactic?.name_fr || tactic?.name || "Tactique";
  const description = `${name} - Tactique spéciale Inazuma Eleven: Victory Road. Effets, durée, recharge et boutique.`;

  return {
    title: `${name} | Inazuma Eleven Victory Road - Azalée`,
    description,
    alternates: { canonical: `/tactic/${id}` },
    openGraph: {
      title: `${name} | Azalée`,
      description,
      url: `/tactic/${id}`,
      siteName: "Azalée - Inazuma Eleven Victory Road",
      locale: "fr_FR",
      type: "article",
    },
  };
}

export default async function TacticDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tactic = await wikiService.getTactic(id);

  if (!tactic) {
    notFound();
  }

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Accueil", item: "https://azalee.rosegriffon.fr" },
      {
        "@type": "ListItem",
        position: 2,
        name: "Tactiques",
        item: "https://azalee.rosegriffon.fr/tactic",
      },
      { "@type": "ListItem", position: 3, name: tactic.name_fr || tactic.name },
    ],
  };

  return (
    <div className="w-full space-y-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-on-surface-variant font-medium">
        <Link href="/tactic" className="hover:text-primary transition-colors">
          Tactiques
        </Link>
        <span className="opacity-30">/</span>
        <span className="text-on-surface">{tactic.name_fr || tactic.name}</span>
      </div>

      <TacticDetail tactic={tactic} />
    </div>
  );
}
