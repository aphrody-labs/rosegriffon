export const dynamic = "force-dynamic";

import { SearchX } from "lucide-react";
import type { Metadata } from "next";
import { FadeInItem, FadeInStagger } from "@/components/ui/fade-in";
import { ItemCard } from "@/components/wiki/ItemCard";
import { WikiPagination } from "@/components/wiki/WikiPagination";
import { WikiSearchToolbar } from "@/components/wiki/WikiSearchToolbar";
import { parseSearchParams } from "@/lib/validations";
import { wikiService } from "@/lib/wiki-service";

export const metadata: Metadata = {
  alternates: { canonical: "/tactic" },
  description:
    "Liste complète des tactiques spéciales dans Inazuma Eleven: Victory Road. Effets, durée et disponibilité en boutique.",
  title: "Tactiques | Inazuma Eleven Victory Road - Azalée",
};

const ITEMS_PER_PAGE = 48;

export default async function TacticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const rawParams = await searchParams;
  const params = parseSearchParams(rawParams);
  const page = typeof params.page === "number" ? params.page : 1;
  const q = params.q || "";

  const { data: tactics, total } = await wikiService.getTacticsList({
    category: "special_tactics",
    limit: ITEMS_PER_PAGE,
    page,
    q,
  });

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl lg:text-3xl font-black text-on-surface tracking-tight">
          Tactiques
        </h1>
        <p className="text-sm text-on-surface-variant mt-1">{total} tactiques disponibles</p>
      </div>

      {/* Search */}
      <WikiSearchToolbar placeholder="Rechercher une tactique..." showFilters={false} />

      {/* Grid */}
      {tactics.length > 0 ? (
        <FadeInStagger className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {tactics.map((t: any) => (
            <FadeInItem key={t.itemId}>
              <ItemCard
                id={t.itemId}
                name={t.names?.fr || t.names?.en || t.name_FR}
                category="special_tactics"
                categoryLabel="Tactique"
                rarity={t.rarity}
                internalCode={t.internalCode}
                price={t.price}
                location={t.location}
                stats={t.stats}
              />
            </FadeInItem>
          ))}
        </FadeInStagger>
      ) : (
        <div className="text-center py-16">
          <SearchX size={48} className="text-on-surface-variant/30 mb-4 block" aria-hidden="true" />
          <p className="text-on-surface-variant">Aucune tactique trouvée.</p>
        </div>
      )}

      {/* Pagination */}
      {total > ITEMS_PER_PAGE && (
        <WikiPagination currentPage={page} totalItems={total} itemsPerPage={ITEMS_PER_PAGE} />
      )}
    </div>
  );
}
