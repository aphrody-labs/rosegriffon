"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";
import { domaineDeLaRoute, type Domaine } from "../config/navigation";
import { BASE_ESPORT, BASE_WIKI } from "../config/routes";

export interface UniverseSwitchProps extends React.ComponentProps<"nav"> {
	className?: string;
}

interface UniverseTab {
	id: Domaine;
	label: string;
	shortLabel: string;
	path: string;
	activeClass: string;
	hoverClass: string;
}

export function UniverseSwitch({ className, ...props }: UniverseSwitchProps) {
	const pathname = usePathname() || "/";
	const activeDomaine = domaineDeLaRoute(pathname);

	const tabs: UniverseTab[] = [
		{
			id: "association",
			label: "Association",
			shortLabel: "Asso",
			path: "/",
			activeClass: "bg-rose-griffon text-white shadow-xs",
			hoverClass: "hover:text-rose-griffon hover:bg-rose-griffon/10",
		},
		{
			id: "wiki",
			label: "Encyclopédie",
			shortLabel: "Wiki",
			path: BASE_WIKI,
			activeClass: "bg-secondary text-secondary-foreground shadow-xs",
			hoverClass: "hover:text-secondary hover:bg-secondary/10",
		},
		{
			id: "esport",
			label: "E-Sport",
			shortLabel: "E-Sport",
			path: BASE_ESPORT,
			activeClass: "bg-achillea-violet text-white dark:bg-achillea-lime dark:text-black shadow-xs",
			hoverClass: "hover:text-achillea-violet hover:bg-achillea-violet/10 dark:hover:text-achillea-lime",
		},
	];

	return (
		<nav
			aria-label="Sélection de l'univers"
			className={`inline-flex items-center p-0.5 rounded-full bg-surface-container-high/60 border border-outline-variant/15 text-xs font-semibold ${
				className ?? ""
			}`}
			{...props}
		>
			{tabs.map((tab) => {
				const isActive = activeDomaine === tab.id;
				return (
					<Link
						key={tab.id}
						href={tab.path}
						aria-current={isActive ? "page" : undefined}
						className={`px-2.5 py-1 rounded-full transition-all duration-200 select-none ${
							isActive
								? tab.activeClass
								: `text-on-surface-variant/80 ${tab.hoverClass}`
						}`}
					>
						<span className="hidden sm:inline">{tab.label}</span>
						<span className="sm:hidden">{tab.shortLabel}</span>
					</Link>
				);
			})}
		</nav>
	);
}

export default UniverseSwitch;
