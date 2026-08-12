"use client";

import {
	Button,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
	THEMES,
	type ThemeType,
} from "@rosegriffon/ui";
import { Check } from "lucide-react";
import Image from "next/image";

import { useTheme } from "@/contexts/theme-context";

/** Ordre d'affichage : les deux mascottes RG, puis Azalée (sombre uniquement —
 * la déclinaison claire reste définie dans le design system mais n'est plus
 * proposée à l'utilisateur). */
const THEME_ORDER: ThemeType[] = ["roy", "gaelle", "azalee-dark"];

const FALLBACK_THEME: ThemeType = "roy";

export function ThemeToggle() {
	const { theme, setTheme, mounted } = useTheme();

	if (!mounted) {
		return (
			<Button
				variant="ghost"
				size="icon"
				className="h-11 w-11 sm:h-9 sm:w-9 md:h-10 md:w-10"
				disabled
				aria-label="Chargement du thème"
			>
				<span className="sr-only">Chargement thème</span>
			</Button>
		);
	}

	const activeTheme = THEME_ORDER.includes(theme as ThemeType)
		? (theme as ThemeType)
		: FALLBACK_THEME;
	const current = THEMES[activeTheme];

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					variant="ghost"
					size="icon"
					className="group relative h-11 w-11 overflow-hidden rounded-full transition-all duration-300 hover:bg-sidebar-accent/20 sm:h-9 sm:w-9 md:h-10 md:w-10"
					title={`Thème actuel : ${current.name}`}
					aria-label={`Thème actuel : ${current.name}. Changer de thème`}
				>
					<div className="relative size-6 transition-transform duration-500 ease-in-out group-hover:rotate-12 sm:h-7 sm:w-7">
						<Image
							src={current.icon}
							alt=""
							fill
							className="object-contain"
							priority
							unoptimized
						/>
					</div>
					<span className="sr-only">Changer de thème</span>
				</Button>
			</DropdownMenuTrigger>

			<DropdownMenuContent align="end" className="w-52">
				<DropdownMenuLabel>Thème</DropdownMenuLabel>
				<DropdownMenuSeparator />
				{THEME_ORDER.map((id) => {
					const meta = THEMES[id];
					const isActive = id === activeTheme;

					return (
						<DropdownMenuItem
							key={id}
							onClick={() => setTheme(id)}
							className="gap-2.5"
							aria-current={isActive ? "true" : undefined}
						>
							<span className="relative size-6 shrink-0">
								<Image src={meta.icon} alt="" fill className="object-contain" unoptimized />
							</span>
							<span className="flex-1 truncate">{meta.name}</span>
							{isActive && <Check className="size-4 shrink-0 opacity-70" aria-hidden />}
						</DropdownMenuItem>
					);
				})}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
