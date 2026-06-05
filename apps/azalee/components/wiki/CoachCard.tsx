"use client";

import { ClipboardList } from "lucide-react";
import Link from "next/link";
import { ElementIcon } from "@/components/wiki/ElementIcon";
import { cn } from "@/lib/utils";

export interface CoachCardProps {
	id: number;
	name: string;
	roleFr: string;
	role: string;
	playstyleFr?: string | null;
	elementKey?: string | null;
	elementFr?: string | null;
	/** Statistique affectée par le passif d'équipe (texte source EN). */
	stat?: string | null;
	/** Valeur du bonus pré-résolue. */
	buff?: string | null;
	className?: string;
}

/** Couleur d'accent par rôle (Coordinateur / Manager / Coach). */
const ROLE_ACCENT: Record<string, string> = {
	Coach: "text-tertiary",
	Coordinator: "text-primary",
	Manager: "text-secondary",
};

/**
 * Carte d'un membre de banc (entraîneur / coach).
 *
 * Aucune illustration n'est disponible dans la table source (`image` toujours
 * vide) → on s'appuie sur une vignette « sifflet » + l'icône d'élément, et on
 * met en avant le passif d'équipe (stat + valeur), seule donnée vraiment utile.
 */
export function CoachCard({
	id,
	name,
	roleFr,
	role,
	playstyleFr,
	elementKey,
	elementFr,
	stat,
	buff,
	className,
}: CoachCardProps) {
	const accent = ROLE_ACCENT[role] ?? "text-on-surface-variant";

	return (
		<Link
			href={`/entraineur/${id}`}
			className={cn(
				"group flex h-full flex-col overflow-hidden rounded-2xl",
				"border border-outline-variant/30 bg-surface-container-low",
				"transition-all duration-200 hover:-translate-y-0.5 hover:bg-surface-container hover:shadow-lg",
				className
			)}
		>
			<div className="relative flex aspect-[3/2] w-full items-center justify-center overflow-hidden bg-surface-container-high">
				<ClipboardList
					size={40}
					className={cn("opacity-30 transition-transform duration-300 group-hover:scale-110", accent)}
					aria-hidden="true"
				/>
				{elementKey ? (
					<div className="absolute right-2 top-2 rounded-full bg-surface/80 p-1 backdrop-blur-sm">
						<ElementIcon element={elementKey} size="sm" />
					</div>
				) : null}
			</div>

			<div className="flex flex-1 flex-col gap-1 p-3">
				<span className={cn("text-[10px] font-bold uppercase tracking-wider", accent)}>
					{roleFr}
					{playstyleFr ? ` · ${playstyleFr}` : ""}
				</span>
				<h3 className="line-clamp-1 text-sm font-bold leading-tight text-on-surface transition-colors group-hover:text-primary">
					{name}
				</h3>

				{stat ? (
					<div className="mt-auto flex items-center justify-between gap-2 pt-1">
						<span className="line-clamp-1 text-xs text-on-surface-variant">{stat}</span>
						{buff ? (
							<span className="shrink-0 rounded-full bg-primary-container px-2 py-0.5 text-[11px] font-bold text-on-primary-container">
								{buff}
							</span>
						) : null}
					</div>
				) : (
					<span className="mt-auto pt-1 text-xs italic text-on-surface-variant/50">
						{elementFr ?? "—"}
					</span>
				)}
			</div>
		</Link>
	);
}
