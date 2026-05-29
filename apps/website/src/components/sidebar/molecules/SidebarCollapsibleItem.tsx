"use client";

import { ChevronRight } from "lucide-react";
import React, { useEffect, useMemo } from "react";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@rose-griffon/ui";
import { getBadgeVariant, sidebarTransitions } from "@/lib/sidebar-config";
import { cn } from "@/lib/utils";
import { useSidebarStore } from "@/stores/sidebar-store";

import { SidebarMenuButton } from "../atoms/SidebarMenuButton";

export interface SidebarCollapsibleItemProps {
	title: string;
	sectionId?: string;
	icon?: React.ReactNode;
	badge?: {
		text: string;
		variant?: "new" | "hot" | "beta" | "soon";
	};
	description?: string;
	ariaLabel?: string;
	children: React.ReactNode;
	isActive?: boolean;
	isCollapsedByDefault?: boolean;
	onExpandChange?: (isOpen: boolean) => void;
}

/**
 * Composant d'item de menu repliable pour la sidebar.
 * Gère la logique d'ouverture/fermeture avec Zustand et la persistance localStorage.
 * S'ouvre automatiquement si un enfant est actif.
 * Supporte les badges dynamiques et les tooltips avec descriptions.
 * Version optimisée avec l'helper sidebarTransitions.
 *
 * @param {string} title - Titre de la section.
 * @param {string} [sectionId] - ID unique pour la persistance (généré depuis le titre si omis).
 * @param {React.ReactNode} [icon] - Icône affichée à gauche.
 * @param {object} [badge] - Badge optionnel à afficher.
 * @param {string} [description] - Description pour le tooltip.
 * @param {React.ReactNode} children - Les sous-items du menu.
 */
export const SidebarCollapsibleItem = React.forwardRef<HTMLDivElement, SidebarCollapsibleItemProps>(
	(
		{
			title,
			sectionId,
			icon,
			badge,
			description,
			ariaLabel,
			children,
			isActive = false,
			isCollapsedByDefault = false,
			onExpandChange,
		},
		ref
	) => {
		// Use Zustand store for state persistence
		const toggleSection = useSidebarStore((state) => state.toggleSection);
		const openSections = useSidebarStore((state) => state.openSections);
		const isHydrated = useSidebarStore((state) => state.isHydrated);

		// Use sectionId if provided, otherwise use title as fallback
		const sectionKey = useMemo(
			() => sectionId || title.toLowerCase().replaceAll(/\s+/g, "-"),
			[sectionId, title]
		);

		// Local state for open/closed to ensure hydration match
		// Initial state MUST match server (default prop)
		const [isOpen, setIsOpen] = React.useState(!isCollapsedByDefault);

		// Sync with store after hydration
		useEffect(() => {
			if (isHydrated) {
				setIsOpen(openSections.includes(sectionKey));
			}
		}, [isHydrated, openSections, sectionKey]);

		// Auto-expand if child is active
		useEffect(() => {
			if (isActive && !isOpen) {
				toggleSection(sectionKey);
				onExpandChange?.(true);
			}
		}, [isActive, isOpen, toggleSection, sectionKey, onExpandChange]);

		const handleToggle = () => {
			toggleSection(sectionKey);
			// Optimistic update
			setIsOpen(!isOpen);
			onExpandChange?.(!isOpen);
		};

		// Get badge styling if badge exists
		const badgeStyles = badge ? getBadgeVariant(badge.variant || "new") : null;

		// Menu button content
		const menuButton = (
			<SidebarMenuButton
				onClick={handleToggle}
				onKeyDown={(e: React.KeyboardEvent) => {
					// Handle keyboard navigation (Enter/Space to toggle)
					if (e.key === "Enter" || e.key === " ") {
						e.preventDefault();
						handleToggle();
					}
					// Handle Escape to close
					if (e.key === "Escape" && isOpen) {
						toggleSection(sectionKey);
						onExpandChange?.(false);
					}
				}}
				isActive={isActive}
				icon={icon}
				aria-expanded={isOpen}
				aria-label={ariaLabel || `${isOpen ? "Réduire" : "Développer"} ${title}`}
				className={cn("group relative", sidebarTransitions.focus)}
				role="button"
				tabIndex={0}
			>
				<span className="flex-1 flex items-center gap-2">
					{title}

					{/* Badge dynamique avec helper getBadgeVariant */}
					{badge && badgeStyles && (
						<span
							className={cn(
								"px-1.5 py-0.5 text-[10px] font-bold rounded-md border",
								sidebarTransitions.badge,
								badgeStyles.bg,
								badgeStyles.text,
								badgeStyles.border,
								badgeStyles.animation
							)}
							aria-label={`Badge: ${badge.text}`}
						>
							{badge.text}
						</span>
					)}
				</span>

				{/* Chevron icon - Rotation horizontale plus intuitive */}
				<ChevronRight
					className={cn(
						"w-3.5 h-3.5 sm:w-4 sm:h-4 transition-transform duration-200 shrink-0",
						"text-sidebar-foreground/70",
						isOpen && "rotate-90"
					)}
					aria-hidden="true"
				/>
			</SidebarMenuButton>
		);

		return (
			<div ref={ref} className="w-full">
				{/* Collapsible Header Button with optional Tooltip */}
				{description ? (
					<TooltipProvider delayDuration={300}>
						<Tooltip>
							<TooltipTrigger asChild>{menuButton}</TooltipTrigger>
							<TooltipContent side="right" className="max-w-xs" sideOffset={10}>
								<p className="text-sm">{description}</p>
							</TooltipContent>
						</Tooltip>
					</TooltipProvider>
				) : (
					menuButton
				)}

				{/* Collapsible Content - Smooth height transition */}
				{isOpen && (
					<div
						className={cn(
							"overflow-hidden",
							"border-l border-sidebar-border",
							"ml-3 mt-0 pl-3",
							"space-y-0",
							"animate-in fade-in-50 slide-in-from-top-2 duration-200 ease-out"
						)}
						role="region"
						aria-label={`Contenu de ${title}`}
					>
						{children}
					</div>
				)}
			</div>
		);
	}
);

SidebarCollapsibleItem.displayName = "SidebarCollapsibleItem";
