import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Primitives de l'accueil.
 *
 * L'ancienne page empilait huit sections animées, chacune avec son halo, son
 * badge en capitales et son titre d'accroche : il fallait cinq écrans de défilement
 * pour arriver au Discord. Ces trois primitives-ci ne décorent rien — une
 * bordure, un fond de surface, un titre. Tout ce qui reste à l'écran est une
 * destination.
 */

export function Tuile({
	children,
	className,
	href,
	label,
}: {
	children: ReactNode;
	className?: string;
	/** Rend la tuile entièrement cliquable. */
	href?: string;
	label?: string;
}) {
	const classes = cn(
		"flex min-h-0 flex-col gap-2 overflow-hidden rounded-2xl border border-outline-variant/15 bg-surface-container-low p-4",
		href && "transition-colors hover:border-primary/40 hover:bg-surface-container",
		className
	);

	return href ? (
		<Link href={href} aria-label={label} className={classes}>
			{children}
		</Link>
	) : (
		<section aria-label={label} className={classes}>
			{children}
		</section>
	);
}

export function TitreTuile({ children }: { children: ReactNode }) {
	return (
		<h2 className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant/70">
			{children}
		</h2>
	);
}

export function Compteur({ valeur, libelle }: { valeur: number; libelle: string }) {
	return (
		<div className="rounded-xl bg-surface-container px-2 py-1.5 text-center">
			<div className="text-base font-bold tabular-nums text-on-surface">
				{valeur.toLocaleString("fr-FR")}
			</div>
			<div className="text-[11px] text-on-surface-variant/70">{libelle}</div>
		</div>
	);
}
