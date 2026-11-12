"use client";

import NextLink from "next/link";
import { type ComponentProps, useState } from "react";

type Props = ComponentProps<typeof NextLink>;

/**
 * `next/link` dont le préchargement attend l'intention (survol, focus ou toucher) quand
 * `prefetch` n'est pas fourni. Le préchargement par défaut à l'entrée dans le viewport lançait
 * ~18 requêtes RSC au chargement de l'accueil et ~1 s de travail du routeur (Lighthouse TBT).
 * Un `prefetch` explicite garde le comportement de Next.
 */
export default function Link({
	prefetch,
	onMouseEnter,
	onFocus,
	onTouchStart,
	...rest
}: Props) {
	const [active, setActive] = useState(false);
	if (prefetch !== undefined) {
		return (
			<NextLink
				prefetch={prefetch}
				onMouseEnter={onMouseEnter}
				onFocus={onFocus}
				onTouchStart={onTouchStart}
				{...rest}
			/>
		);
	}
	return (
		<NextLink
			{...rest}
			prefetch={active ? null : false}
			onMouseEnter={(e) => {
				setActive(true);
				onMouseEnter?.(e);
			}}
			onFocus={(e) => {
				setActive(true);
				onFocus?.(e);
			}}
			onTouchStart={(e) => {
				setActive(true);
				onTouchStart?.(e);
			}}
		/>
	);
}
