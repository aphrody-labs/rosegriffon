"use client";

import { useState } from "react";
import { FadeInItem, FadeInStagger } from "@/components/ui/fade-in";
import { GalleryCard } from "@/components/wiki/GalleryCard";
import { GalleryLightbox } from "@/components/wiki/GalleryLightbox";

/** Item de galerie sérialisable transmis du Server Component à la grille client. */
export interface GalleryGridItem {
	id: string;
	title: string;
	image: string | null;
	categoryLabel?: string;
	categoryIcon?: string;
}

interface GalleryGridProps {
	items: GalleryGridItem[];
	/** Nb d'images de la 1re rangée chargées en `priority` (préchargement). */
	priorityCount?: number;
}

/**
 * Grille client de la galerie : rend les cartes + détient l'état du lightbox plein
 * écran (index ouvert) pour la navigation précédent/suivant sur toute la page. Les
 * `priorityCount` premières cartes sont chargées en priorité (next/image `priority`)
 * et préchargées via `<link rel="preload" as="image">` pour un affichage fluide.
 */
export function GalleryGrid({ items, priorityCount = 4 }: GalleryGridProps) {
	const [openIndex, setOpenIndex] = useState<number | null>(null);

	return (
		<>
			{/* Préchargement des premières images (1re rangée) avant le paint. */}
			{items.slice(0, priorityCount).map((item) =>
				item.image ? (
					// biome-ignore lint/correctness/useUniqueElementIds: lien de preload sans id
					<link key={`preload-${item.id}`} rel="preload" as="image" href={item.image} />
				) : null
			)}

			<FadeInStagger className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
				{items.map((item, i) => (
					<FadeInItem key={item.id} className="h-full">
						<GalleryCard
							id={item.id}
							title={item.title}
							image={item.image}
							categoryLabel={item.categoryLabel}
							categoryIcon={item.categoryIcon}
							priority={i < priorityCount}
							onOpen={() => setOpenIndex(i)}
							className="h-full"
						/>
					</FadeInItem>
				))}
			</FadeInStagger>

			<GalleryLightbox
				items={items}
				index={openIndex}
				onClose={() => setOpenIndex(null)}
				onNavigate={setOpenIndex}
			/>
		</>
	);
}
