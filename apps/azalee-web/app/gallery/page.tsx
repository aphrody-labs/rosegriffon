export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { GalleryGrid } from "@/components/wiki/GalleryGrid";
import { GalleryFilterBar } from "@/components/wiki/filters/GalleryFilterBar";
import { WikiPagination } from "@/components/wiki/WikiPagination";
import { WikiSearchToolbar } from "@/components/wiki/WikiSearchToolbar";
import { buildCanonical } from "@/lib/seo";
import { GALLERY_CATEGORIES, wikiService } from "@/lib/wiki-service";

const ITEMS_PER_PAGE = 48;

export async function generateMetadata({
	searchParams,
}: {
	searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
	const params = await searchParams;
	const category = typeof params.category === "string" ? params.category : undefined;
	const q = typeof params.q === "string" ? params.q : undefined;
	const page = typeof params.page === "string" ? params.page : undefined;

	const categoryLabel =
		GALLERY_CATEGORIES.find((c) => c.value === category)?.label || "Illustrations";

	let title = `Galerie - ${categoryLabel}`;
	if (q) {
		title += ` : "${q}"`;
	}
	const pageNum = page ? Number.parseInt(page, 10) : 1;
	if (pageNum > 1) {
		title += ` (Page ${pageNum})`;
	}

	return {
		alternates: {
			canonical: buildCanonical("/gallery", { category, page }, ["category", "page"]),
		},
		description:
			"Galerie complète des illustrations in-game d'Inazuma Eleven: Victory Road : scènes d'histoire, chroniques, illustrations spéciales et liens.",
		title: `${title} | Inazuma Eleven Victory Road - Azalée`,
	};
}

export default async function GalleryPage({
	searchParams,
}: {
	searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
	const params = await searchParams;
	const category = typeof params.category === "string" ? params.category : undefined;
	const q = typeof params.q === "string" ? params.q : undefined;
	const pageParam = typeof params.page === "string" ? params.page : undefined;
	const pageNumber = pageParam ? Math.max(1, Number.parseInt(pageParam, 10) || 1) : 1;
	const activeCategory = category || "all";

	const [{ data: items, total }, counts] = await Promise.all([
		wikiService.getGalleryList({
			category,
			limit: ITEMS_PER_PAGE,
			page: pageNumber,
			q,
		}),
		wikiService.getGalleryCategoryCounts(),
	]);

	const categoryOptions = [
		{ value: "all", label: "Toutes", icon: "apps", count: counts.all },
		...GALLERY_CATEGORIES.map((c) => ({
			value: c.value,
			label: c.label,
			icon: c.icon,
			count: counts[c.value] || 0,
		})),
	];

	const totalPages = Math.max(1, Math.ceil(total / ITEMS_PER_PAGE));

	// Résout les libellés/icônes de catégorie côté serveur pour une liste sérialisable
	// transmise à la grille client (lightbox + préchargement).
	const gridItems = items.map((item) => {
		const cat = GALLERY_CATEGORIES.find((c) => c.value === item.category);
		return {
			id: item.id,
			title: item.title,
			// Vignette légère (w=400 webp) pour la carte ; grande (w=1600 webp) pour le
			// lightbox ; `original` = PNG plein cadre réservé au téléchargement.
			thumb: item.thumb,
			full: item.full,
			original: item.image,
			categoryLabel: cat?.label,
			categoryIcon: cat?.icon,
		};
	});

	return (
		<div className="space-y-6">
			<div className="space-y-2">
				<h1 className="text-fluid-headline-md font-bold text-on-surface">Galerie d'illustrations</h1>
				<p className="text-sm text-on-surface-variant">
					Illustrations in-game d'Inazuma Eleven: Victory Road — scènes d'histoire, chroniques et
					images spéciales.
				</p>
			</div>

			<div className="space-y-4">
				<WikiSearchToolbar placeholder="Rechercher une illustration..." showFilters={false} />
				<GalleryFilterBar categories={categoryOptions} currentCategory={activeCategory} />
			</div>

			<div className="flex items-center justify-between px-1 text-xs font-medium uppercase tracking-wider text-on-surface-variant">
				<span>{total.toLocaleString("fr-FR")} illustrations</span>
				<span>
					Page {pageNumber} sur {totalPages}
				</span>
			</div>

			{items.length > 0 ? (
				<GalleryGrid items={gridItems} />
			) : (
				<div className="rounded-[32px] border border-dashed border-outline-variant bg-surface-container-low py-20 text-center">
					<p className="italic text-on-surface-variant">Aucune illustration trouvée.</p>
				</div>
			)}

			<WikiPagination totalItems={total} itemsPerPage={ITEMS_PER_PAGE} currentPage={pageNumber} />
		</div>
	);
}
