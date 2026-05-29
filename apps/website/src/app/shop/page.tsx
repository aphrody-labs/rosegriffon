import { Suspense } from "react";

import { PRODUCTS } from "@/lib/shop/products";
import type { ProductCategory } from "@/lib/shop/products";
import { CategoryFilter } from "./_components/category-filter";
import { PatreonDiscountBanner } from "./_components/patreon-discount-banner";
import { ProductCard } from "./_components/product-card";

interface ShopPageProps {
	searchParams: Promise<{ cat?: string }>;
}

export default async function ShopIndexPage({ searchParams }: ShopPageProps) {
	const { cat = "" } = await searchParams;
	const filtered =
		cat && cat !== "all"
			? PRODUCTS.filter((p) => p.category === (cat as ProductCategory))
			: PRODUCTS;

	return (
		<div className="mx-auto max-w-7xl px-4 pb-16 pt-10 md:px-8 md:pt-16">
			{/* Hero */}
			<section className="mb-12 grid gap-6 md:mb-16 md:grid-cols-12 md:items-end">
				<header className="md:col-span-8">
					<p className="mb-3 inline-flex items-center gap-2 rounded-full border-2 border-[#d4af37] bg-[#0c1730] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.24em] text-[#d4af37] shadow-[0_2px_0_0_rgba(0,0,0,0.5)]">
						<span>★</span>
						<span>Édition Communauté 2026</span>
						<span>★</span>
					</p>
					<h1 className="text-balance text-fluid-display-xl font-extrabold leading-[0.95] tracking-tight text-white">
						La boutique <span className="text-[#d4af37]">Rose Griffon</span>.
					</h1>
					<p className="mt-5 max-w-2xl text-base text-white/80 md:text-lg">
						Stickers, prints A5, badges brodés, marque-pages, textile et packs collector édités avec
						les artistes de l'association — tirages limités, imprimés en France, expédiés sous 3 à
						10 jours.
					</p>
				</header>

				<aside className="md:col-span-4">
					<Suspense
						fallback={
							<div className="h-24 animate-pulse rounded-2xl border-2 border-[#d4af37]/30 bg-[#0c1730]/60" />
						}
					>
						<PatreonDiscountBanner />
					</Suspense>
				</aside>
			</section>

			{/* Filters */}
			<section className="mb-8 flex flex-wrap items-center justify-between gap-4">
				<CategoryFilter active={cat} />
				<p className="text-xs font-semibold uppercase tracking-widest text-white/60">
					{filtered.length} produit{filtered.length > 1 ? "s" : ""}
				</p>
			</section>

			{/* Grid */}
			{filtered.length === 0 ? (
				<EmptyState />
			) : (
				<section
					aria-label="Catalogue produits"
					className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
				>
					{filtered.map((p) => (
						<ProductCard key={p.slug} product={p} />
					))}
				</section>
			)}
		</div>
	);
}

function EmptyState() {
	return (
		<div className="rounded-3xl border-2 border-dashed border-[#d4af37]/40 bg-[#0c1730]/40 p-16 text-center">
			<p className="text-4xl">🌹</p>
			<p className="mt-4 text-lg font-bold text-white">
				Aucun produit dans cette catégorie pour l'instant.
			</p>
			<p className="mt-2 text-sm text-white/60">
				Reviens vite — on prépare de nouveaux drops chaque mois.
			</p>
		</div>
	);
}
