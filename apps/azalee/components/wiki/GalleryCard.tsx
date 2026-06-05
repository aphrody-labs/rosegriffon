"use client";

import Image from "next/image";
import { useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/utils";

export interface GalleryCardProps {
	id: string;
	title: string;
	image: string | null;
	categoryLabel?: string;
	categoryIcon?: string;
	className?: string;
}

/**
 * Carte d'illustration de galerie in-game (`inagle_gallery`). Image plein cadre
 * (illustration 16:9 du dump dx11), titre dérivé du `img_path`, chip de catégorie.
 * Fallback propre (icône de catégorie) si l'image est absente ou renvoie 404.
 */
export function GalleryCard({
	title,
	image,
	categoryLabel,
	categoryIcon = "image",
	className,
}: GalleryCardProps) {
	const [imgError, setImgError] = useState(false);
	const hasImage = !!image && !imgError;

	return (
		<div
			className={cn(
				"group block h-full overflow-hidden rounded-2xl",
				"border border-outline-variant/30 bg-surface-container-low",
				"transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:bg-surface-container",
				className
			)}
		>
			<div className="relative aspect-video w-full overflow-hidden bg-surface-container-high">
				{hasImage ? (
					<Image
						src={image as string}
						alt={title}
						fill
						sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
						className="object-cover transition-transform duration-300 group-hover:scale-105"
						unoptimized
						onError={() => setImgError(true)}
					/>
				) : (
					<div className="flex size-full items-center justify-center">
						<Icon name={categoryIcon} size={40} className="text-on-surface-variant/25" />
					</div>
				)}
				{categoryLabel && (
					<span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-surface/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-on-surface backdrop-blur-sm">
						<Icon name={categoryIcon} size={12} />
						{categoryLabel}
					</span>
				)}
			</div>
			<div className="p-3">
				<h3 className="line-clamp-1 text-xs font-bold leading-tight text-on-surface transition-colors group-hover:text-primary">
					{title}
				</h3>
			</div>
		</div>
	);
}
