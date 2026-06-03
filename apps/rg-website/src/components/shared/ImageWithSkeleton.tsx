"use client";

import React, { useState } from "react";

import { Skeleton, StorageImage } from "@rose-griffon/ui";

const PLACEHOLDER = "/RG_Logo_V2.5.webp";

// Image component with skeleton loader.
//
// Les avatars d'équipe pointent vers cdn.discordapp.com (déjà servi en webp
// dimensionné via ?size=) ou Supabase Storage. On les sert `unoptimized` :
// l'optimiseur Vercel renvoyait 402 (quota d'optimisation d'images distantes
// épuisé) sur ces URLs externes — toutes les photos retombaient alors sur le
// placeholder. En bypassant l'optimiseur, l'avatar source (200) s'affiche
// directement. Fallback propre vers le logo RG si l'URL source casse.
const ImageWithSkeleton = React.memo(
	({ src, alt, priority = false }: { src: string; alt: string; priority?: boolean }) => {
		const [isLoading, setIsLoading] = useState(true);

		return (
			<>
				{isLoading && <Skeleton className="absolute inset-0 w-full h-full rounded-full" />}
				<StorageImage
					src={src}
					alt={alt}
					fill
					className="object-cover"
					onLoad={() => setIsLoading(false)}
					priority={priority}
					loading={priority ? "eager" : "lazy"}
					sizes="(max-width: 768px) 100px, 144px"
					unoptimized
					fallback={PLACEHOLDER}
				/>
			</>
		);
	}
);

export default ImageWithSkeleton;
