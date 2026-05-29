"use client";

import React, { useState } from "react";

import { Skeleton, StorageImage } from "@rose-griffon/ui";

// Image component with skeleton loader
const ImageWithSkeleton = React.memo(
	({ src, alt, priority = false }: { src: string; alt: string; priority?: boolean }) => {
		const [isLoading, setIsLoading] = useState(true);

		return (
			<>
				{isLoading && <Skeleton className="absolute inset-0 w-full h-full rounded-full" />}
				<StorageImage
					src={src}
					alt={`${alt} Rose Griffon`}
					fill
					className="object-cover"
					onLoad={() => setIsLoading(false)}
					priority={priority}
					loading={priority ? "eager" : "lazy"}
					sizes="(max-width: 768px) 100px, 144px"
					quality={70}
				/>
			</>
		);
	}
);

export default ImageWithSkeleton;
