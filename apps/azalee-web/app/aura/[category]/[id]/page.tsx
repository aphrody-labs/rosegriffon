export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AuraDetail } from "@/components/wiki/AuraDetail";
import { wikiService } from "@/lib/wiki-service";

const SUBTYPE_INFO: Record<string, { label: string; icon: string; color: string }> = {
  Keshin: { label: "Esprit Guerrier", icon: "flash_on", color: "text-primary" },
  Soul: { label: "Totem", icon: "pets", color: "text-tertiary" },
  Awakening: { label: "Éveil", icon: "wb_twilight", color: "text-secondary" },
  ModeChange: { label: "Changement de Mode", icon: "transform", color: "text-error" },
  Miximax: { label: "Miximax", icon: "group_work", color: "text-blue-500" },
  Aura: { label: "Aura", icon: "wifi_tethering", color: "text-primary" },
};

const CATEGORY_LABELS: Record<string, string> = {
  "esprits-guerriers": "Esprits Guerriers",
  totems: "Totems",
  miximax: "Miximax",
  eveil: "Éveil",
  "changement-mode": "Changement de Mode",
  autres: "Autres",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string; id: string }>;
}): Promise<Metadata> {
  const { id, category } = await params;
  const aura = await wikiService.getAura(id, category);

  const name = aura?.displayName || "Hyper Technique";
  const categoryLabel = CATEGORY_LABELS[category] || category;
  const description = aura?.desc_FR || `${categoryLabel} - Détails et statistiques.`;
  const title = `${name} | ${categoryLabel} - Azalée`;

  return {
    title,
    description,
    alternates: { canonical: `/aura/${category}/${id}` },
    openGraph: {
      title: `${name} | Azalée`,
      description,
      url: `/aura/${category}/${id}`,
      siteName: "Azalée - Inazuma Eleven Victory Road",
      locale: "fr_FR",
      type: "article",
    },
    twitter: {
      card: "summary",
      title: `${name} | Azalée`,
      description,
    },
  };
}

export default async function AuraDetailPage({
  params,
}: {
  params: Promise<{ category: string; id: string }>;
}) {
  const { id, category } = await params;
  const aura = await wikiService.getAura(id, category);

  if (!aura) {
    notFound();
  }

  const subTypeInfo = SUBTYPE_INFO[aura.subType || "Aura"] || SUBTYPE_INFO.Aura;

  const categoryLabel = CATEGORY_LABELS[category] || category;
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Accueil", item: "https://azalee.rosegriffon.fr" },
      {
        "@type": "ListItem",
        position: 2,
        name: "Hyper Techniques",
        item: "https://azalee.rosegriffon.fr/aura",
      },
      {
        "@type": "ListItem",
        position: 3,
        name: categoryLabel,
        item: `https://azalee.rosegriffon.fr/aura/${category}`,
      },
      { "@type": "ListItem", position: 4, name: aura.displayName },
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
        <Link href="/aura" className="hover:text-primary transition-colors">
          Hyper Techniques
        </Link>
        <span className="opacity-30">/</span>
        <Link href={`/aura/${category}`} className="hover:text-primary transition-colors">
          {categoryLabel}
        </Link>
        <span className="opacity-30">/</span>
        <span className="text-on-surface">{aura.displayName}</span>
      </div>

      <AuraDetail
        aura={aura}
        category={category}
        subTypeInfo={subTypeInfo}
        prevAura={null}
        nextAura={null}
      />
    </div>
  );
}
