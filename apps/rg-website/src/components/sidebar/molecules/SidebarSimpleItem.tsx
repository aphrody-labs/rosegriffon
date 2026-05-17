"use client";

import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import React from "react";

import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { getBadgeVariant, sidebarTransitions } from "@/lib/sidebar-config";
import { cn } from "@/lib/utils";

import { SidebarMenuButton } from "../atoms/SidebarMenuButton";

export interface SidebarSimpleItemProps {
	href: string;
	icon?: React.ReactNode;
	label: string;
	badge?: {
		text: string;
		variant?: "new" | "hot" | "beta" | "soon";
	};
	description?: string;
	shortcut?: string;
	isExternal?: boolean;
	ariaLabel?: string;
	target?: "_blank" | "_self" | "_parent" | "_top";
	rel?: string;
	onClick?: () => void;
}

/**
 * Composant d'item de menu simple pour les liens de la sidebar.
 * Détecte automatiquement l'état actif basé sur le pathname actuel.
 * Supporte les badges dynamiques et les tooltips avec descriptions.
 * Version optimisée avec l'helper sidebarTransitions.
 *
 * @param {string} href - L'URL de destination.
 * @param {React.ReactNode} [icon] - Icône affichée à gauche.
 * @param {string} label - Le texte du lien.
 * @param {object} [badge] - Badge optionnel à afficher.
 * @param {string} [description] - Description pour le tooltip.
 * @param {boolean} [isExternal] - Si true, ouvre dans un nouvel onglet.
 */
export const SidebarSimpleItem = React.forwardRef<
	HTMLAnchorElement,
	SidebarSimpleItemProps
>(
	(
		{
			href,
			icon,
			label,
			badge,
			description,
			shortcut,
			isExternal,
			ariaLabel,
			target,
			rel,
			onClick,
		},
		ref,
	) => {
		const pathname = usePathname();

		// Determine if this item is active
		const isActive = pathname
			? pathname === href || pathname.startsWith(`${href}/`)
			: false;

		// Handle external links
		const linkTarget = isExternal ? "_blank" : target;
		const linkRel = rel || (isExternal ? "noopener noreferrer" : undefined);

		const linkProps = {
			href,
			...(linkTarget && { target: linkTarget }),
			...(linkRel && { rel: linkRel }),
			ref,
		};

		// Get badge styling if badge exists
		const badgeStyles = badge ? getBadgeVariant(badge.variant || "new") : null;

		// Menu button content
		const menuButton = (
			<Link {...linkProps} className="block w-full">
				<SidebarMenuButton
					isActive={isActive}
					icon={icon}
					onClick={onClick}
					aria-label={ariaLabel || label}
					className={cn(
						"cursor-pointer group relative w-full",
						sidebarTransitions.focus,
					)}
				>
					<span className="flex-1 flex items-center gap-2">
						{label}

						{/* External link indicator */}
						{isExternal && (
							<ExternalLink className="h-3 w-3 opacity-50 group-hover:opacity-100 transition-opacity" />
						)}
					</span>

					{/* Badge dynamique avec helper getBadgeVariant */}
					{badge && badgeStyles && (
						<span
							className={cn(
								"px-1.5 py-0.5 text-[10px] font-bold rounded-md border",
								sidebarTransitions.badge,
								badgeStyles.bg,
								badgeStyles.text,
								badgeStyles.border,
								badgeStyles.animation,
							)}
							aria-label={`Badge: ${badge.text}`}
						>
							{badge.text}
						</span>
					)}

					{/* Keyboard shortcut (desktop only) */}
					{shortcut && (
						<kbd className="hidden lg:inline-flex px-1.5 py-0.5 text-[10px] font-mono bg-muted rounded border">
							{shortcut}
						</kbd>
					)}
				</SidebarMenuButton>
			</Link>
		);

		// Wrap with tooltip if description exists
		if (description) {
			return (
				<TooltipProvider delayDuration={300}>
					<Tooltip>
						<TooltipTrigger asChild>{menuButton}</TooltipTrigger>
						<TooltipContent side="right" className="max-w-xs" sideOffset={10}>
							<p className="text-sm">{description}</p>
							{shortcut && (
								<p className="text-xs text-muted-foreground mt-1">
									Raccourci:{" "}
									<kbd className="px-1 py-0.5 bg-muted rounded">{shortcut}</kbd>
								</p>
							)}
						</TooltipContent>
					</Tooltip>
				</TooltipProvider>
			);
		}

		return menuButton;
	},
);

SidebarSimpleItem.displayName = "SidebarSimpleItem";
