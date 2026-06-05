export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { FadeInItem, FadeInStagger } from "@/components/ui/fade-in";
import { ItemFilterBar } from "@/components/wiki/filters/ItemFilterBar";
import { ItemCard } from "@/components/wiki/ItemCard";
import { WikiPagination } from "@/components/wiki/WikiPagination";
import { WikiSearchToolbar } from "@/components/wiki/WikiSearchToolbar";
import { parseSearchParams } from "@/lib/validations";
import { wikiService } from "@/lib/wiki-service";

export async function generateMetadata({
	searchParams,
}: {
	searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
	const rawParams = await searchParams;
	const { q, category, page } = parseSearchParams(rawParams) as any;

	const activeCategory = (category as string) || "shoes";
	const categoryLabel = CATEGORIES.find((t) => t.value === activeCategory)?.label || "Équipements";

	let title = `${categoryLabel} - Objets`;
	if (q) {
		title += ` : "${q}"`;
	}

	const pageNum = page ? Number.parseInt(page.toString(), 10) : 1;
	if (pageNum > 1) {
		title += ` (Page ${pageNum})`;
	}

	return {
		alternates: {
			canonical: `/item?category=${activeCategory}${page ? `&page=${page}` : ""}`,
		},
		description: `Liste complète des ${categoryLabel.toLowerCase()} et objets dans Inazuma Eleven: Victory Road. Localisation, stats et effets.`,
		title: `${title} | Inazuma Eleven Victory Road - Azalée`,
	};
}

const ITEMS_PER_PAGE = 48;

const CATEGORIES = [
	{ icon: "steps", label: "Chaussures", value: "shoes" },
	{ icon: "watch", label: "Bracelets", value: "misanga" },
	{ icon: "diamond", label: "Pendentifs", value: "accessory" },
	{ icon: "link", label: "Lien Kizuna", value: "kizuna_link" },
	{ icon: "lunch_dining", label: "Consommables", value: "consume" },
	{ icon: "strategy", label: "Tactiques Sp.", value: "special_tactics" },
];

export default async function ItemsPage({
	searchParams,
}: {
	searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
	const rawParams = await searchParams;
	const params: any = parseSearchParams(rawParams);
	const { q, page, category } = params;

	const pageNumber = page ? Number.parseInt(page.toString(), 10) : 1;
	const activeCategory = (category as string) || "shoes";

	// Data First: Fetch paginated from DB
	const { data: items, total } = await wikiService.getItemsList({
		category: activeCategory,
		limit: ITEMS_PER_PAGE,
		page: pageNumber,
		q: q?.toString(),
	});

	return (
		<div className="space-y-6">
			<h1 className="sr-only">Objets</h1>
			<div className="space-y-4">
				<WikiSearchToolbar placeholder="Rechercher un objet..." showFilters={false} />
				<ItemFilterBar categories={CATEGORIES} currentCategory={activeCategory} />
			</div>

			<div className="flex items-center justify-between text-xs font-medium text-on-surface-variant px-1 uppercase tracking-wider">
				<span>{total.toLocaleString("fr-FR")} objets</span>
				<span>
					Page {pageNumber} sur {Math.max(1, Math.ceil(total / ITEMS_PER_PAGE))}
				</span>
			</div>

			{items.length > 0 ? (
				<FadeInStagger className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
					{items.map((item: any) => (
						<FadeInItem key={item.itemId} className="h-full">
							<ItemCard
								id={item.itemId}
								name={item.name_FR || item.names?.en || "Inconnu"}
								category={item.category}
								categoryLabel={CATEGORIES.find((t) => t.value === item.category)?.label}
								rarity={item.rarity}
								internalCode={item.internalCode}
								icon={item.image}
								price={item.price}
								location={item.location}
								stats={item.stats}
								bonuses={item.bonuses}
								className="h-full"
							/>
						</FadeInItem>
					))}
				</FadeInStagger>
			) : (
				<div className="py-20 text-center rounded-[32px] border border-outline-variant bg-surface-container-low border-dashed">
					<p className="text-on-surface-variant italic">Aucun objet trouvé.</p>
				</div>
			)}

			<WikiPagination totalItems={total} itemsPerPage={ITEMS_PER_PAGE} currentPage={pageNumber} />
		</div>
	);
}
