import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AuraList } from "@/components/wiki/AuraList";
import { parseSearchParams } from "@/lib/validations";
import { wikiService } from "@/lib/wiki-service";

export const dynamic = "force-dynamic";

const CATEGORIES = {
  "esprits-guerriers": { title: "Esprits Guerriers", type: "Keshin" },
  totems: { title: "Totems", type: "Soul" },
  miximax: { title: "Miximax", type: "Miximax" },
  eveil: { title: "Éveil", type: "Awakening" },
  "changement-mode": { title: "Changement de Mode", type: "ModeChange" },
} as const;

type CategoryKey = keyof typeof CATEGORIES;

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ category: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}): Promise<Metadata> {
  const { category } = await params;
  const rawParams = await searchParams;
  const { q, page, element } = parseSearchParams(rawParams);

  const config = CATEGORIES[category as CategoryKey];
  if (!config) return { title: "Non trouvé" };

  let title = config.title;
  const filters: string[] = [];

  if (q) filters.push(`"${q}"`);
  if (element) filters.push(`Élément ${element}`);

  if (filters.length > 0) {
    title += ` : ${filters.join(" ")}`;
  }

  const pageNum = page ? parseInt(page.toString(), 10) : 1;
  if (pageNum > 1) title += ` (Page ${pageNum})`;

  return {
    title: `${title} | Inazuma Eleven Victory Road - Azalée`,
    description: `Liste complète des ${config.title.toLowerCase()}${filters.length > 0 ? ` filtrée par ${filters.join(", ")}` : ""}.`,
    alternates: {
      canonical: `/aura/${category}${rawParams ? `?${new URLSearchParams(rawParams as Record<string, string>).toString()}` : ""}`,
    },
  };
}

export async function generateStaticParams() {
  return Object.keys(CATEGORIES).map((category) => ({ category }));
}

export default async function AuraCategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ category: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { category } = await params;
  const config = CATEGORIES[category as CategoryKey];

  if (!config) {
    notFound();
  }

  const rawParams = await searchParams;
  const search = parseSearchParams(rawParams);
  const { q, page, element } = search;
  const pageNumber = page ? parseInt(page.toString(), 10) : 1;

  // Data First: Fetch paginated from DB
  const { data: auras, total } = await wikiService.getAurasList({
    typeSlug: category,
    q: q?.toString(),
    element: element?.toString(),
    page: pageNumber,
    limit: 48, // Match AuraList grid
  });

  return (
    <div className="w-full space-y-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold font-grade-high">{config.title}</h1>
        <p className="text-on-surface-variant">{total} résultats trouvés</p>
      </div>

      <AuraList auras={auras} category={category} />
    </div>
  );
}
