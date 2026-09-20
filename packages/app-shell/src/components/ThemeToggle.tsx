"use client";

import { Check, Moon } from "lucide-react";
import Image from "next/image";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
	THEMES,
} from "@rosegriffon/ui";

export interface ThemeOption {
	id: string;
	label: string;
	icon?: typeof Moon;
	image?: string;
}

/**
 * Thèmes proposés par le sélecteur, DÉRIVÉS du catalogue de `@rosegriffon/ui`.
 *
 * Cette liste était recopiée à la main, et elle avait dérivé : trois entrées
 * quand le catalogue en déclarait cinq, et surtout un identifiant `"dark"` qui
 * ne correspond à AUCUN thème — `next-themes` posait donc la classe `.dark`,
 * qui n'existe qu'en repli générique, au lieu de `.theme-azalee-dark`. Azalée
 * clair et Achilléa, eux, étaient tout simplement absents du sélecteur : les
 * déclarer dans `styles.css` ne suffisait pas à les rendre choisissables.
 *
 * Ajouter un thème au catalogue l'ajoute désormais au sélecteur, sans toucher
 * ce fichier. C'est le seul moyen de garantir qu'ils ne redivergent pas.
 */
export const DEFAULT_THEMES: ThemeOption[] = Object.entries(THEMES).map(([id, theme]) => ({
	id,
	image: theme.icon,
	label: theme.name,
}));

export function ThemeToggle({
	themes = DEFAULT_THEMES,
	className,
}: {
	themes?: ThemeOption[];
	className?: string;
}) {
	const { setTheme, theme } = useTheme();
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		setMounted(true);
	}, []);

	if (!mounted) {
		return (
			<div
				className={`size-12 md:size-10 rounded-full flex items-center justify-center text-on-surface-variant/20 ${className ?? ""}`}
			>
				<Moon className="size-6 md:size-5" aria-hidden="true" />
			</div>
		);
	}

	const active = themes.find((entry) => entry.id === theme) ?? themes[0]!;
	const ActiveIcon = active.icon;

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<button
					type="button"
					className={`relative size-12 md:size-10 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-on-surface/[0.08] active:bg-on-surface/[0.12] transition-all duration-300 ${className ?? ""}`}
					aria-label="Changer de thème"
					title={active.label}
				>
					{ActiveIcon ? (
						<ActiveIcon className="size-6 md:size-5" aria-hidden="true" />
					) : active.image ? (
						<Image
							src={active.image}
							alt=""
							width={24}
							height={24}
							unoptimized
							className="size-6 md:size-5 object-contain"
						/>
					) : (
						<Moon className="size-6 md:size-5" aria-hidden="true" />
					)}
				</button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-48">
				{themes.map((entry) => {
					const Icon = entry.icon;
					return (
						<DropdownMenuItem
							key={entry.id}
							onClick={() => setTheme(entry.id)}
							className="gap-2.5"
							aria-current={entry.id === active.id ? "true" : undefined}
						>
							{Icon ? (
								<Icon className="size-4 shrink-0" aria-hidden="true" />
							) : entry.image ? (
								<Image
									src={entry.image}
									alt=""
									width={20}
									height={20}
									unoptimized
									className="size-5 shrink-0 object-contain"
								/>
							) : (
								<Moon className="size-4 shrink-0" aria-hidden="true" />
							)}
							<span className="flex-1 truncate">{entry.label}</span>
							{entry.id === active.id && (
								<Check className="size-4 shrink-0 opacity-70" aria-hidden="true" />
							)}
						</DropdownMenuItem>
					);
				})}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

export default ThemeToggle;
