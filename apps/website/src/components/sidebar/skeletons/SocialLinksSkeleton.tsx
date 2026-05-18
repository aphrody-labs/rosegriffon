"use client";

import { Skeleton } from "@rg/ui";

/**
 * Social Links Skeleton - Loading placeholder
 * Shown while SocialLinks lazy loads
 */
export function SocialLinksSkeleton() {
	return (
		<div className="flex items-center justify-center gap-1">
			{[1, 2, 3, 4, 5].map((i) => (
				<Skeleton key={i} className="size-9 rounded-md bg-muted" />
			))}
		</div>
	);
}
