"use client";

import { usePathname } from "next/navigation";
import React from "react";

import { SidebarCollapsibleItem } from "@/components/sidebar/molecules/SidebarCollapsibleItem";
import { SidebarSimpleItem } from "@/components/sidebar/molecules/SidebarSimpleItem";
import {
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarMenu,
	SidebarMenuItem,
} from "@rose-griffon/ui";
import type { MenuItem } from "@/lib/sidebar-config";

interface SidebarNavLinksProps {
	title: string;
	items: MenuItem[];
}

/**
 * Composant affichant un groupe de liens de navigation dans la sidebar.
 * Gère l'affichage des items simples et des items repliables (collapsible).
 *
 * @param {string} title - Le titre du groupe (affiché en label).
 * @param {MenuItem[]} items - La liste des items de menu à afficher.
 */
export const SidebarNavLinks = React.memo(({ title, items }: SidebarNavLinksProps) => {
	// Protection si items est vide ou invalide
	if (!items || !Array.isArray(items) || items.length === 0) {
		return null;
	}

	const pathname = usePathname();


	return (
		<SidebarGroup className="px-1">
			<SidebarGroupLabel className="px-3 py-1 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/75">
				{title}
			</SidebarGroupLabel>
			<SidebarGroupContent>
				<SidebarMenu className="flex w-full min-w-0 flex-col gap-0.5 px-1.5">
					{items.map((item, index) => {
						// Protection contre les items invalides
						if (!item?.title || !item.icon) return null;

						return (
							<SidebarMenuItem key={`${item.title}-${index}`}>
								{/* Collapsible items */}
								{item.collapsible && Array.isArray(item.items) && item.items.length > 0 ? (
									<SidebarCollapsibleItem
										title={item.title}
										icon={
											<item.icon className="size-4 md:w-5 md:h-5 transition-all duration-200" />
										}
										// `isActive` n'était jamais transmis : la section restait
										// repliée et non surlignée même sur une de ses sous-pages,
										// et l'auto-ouverture documentée ne s'exécutait jamais.
										isActive={item.items.some(
											(sub) => pathname === sub.url || pathname.startsWith(`${sub.url}/`)
										)}
										description={item.description}
										ariaLabel={item.ariaLabel}
									>
										{item.items.map((subItem) => (
											<SidebarSimpleItem
												key={subItem.title}
												href={subItem.url}
												icon={
													<subItem.icon className="w-3.5 h-3.5 md:w-4 md:h-4 transition-all duration-200" />
												}
												label={subItem.title}
												// badge={subItem.badge} // Badge removed
												description={subItem.description}
												shortcut={subItem.shortcut}
											/>
										))}
									</SidebarCollapsibleItem>
								) : (
									/* Simple items */
									<SidebarSimpleItem
										href={item.url || "/"}
										icon={
											<item.icon className="size-4 md:w-5 md:h-5 transition-all duration-200" />
										}
										label={item.title}
										// badge={item.badge} // Badge removed
										description={item.description}
										isExternal={item.isExternal}
										ariaLabel={item.ariaLabel}
									/>
								)}
							</SidebarMenuItem>
						);
					})}
				</SidebarMenu>
			</SidebarGroupContent>
		</SidebarGroup>
	);
});
