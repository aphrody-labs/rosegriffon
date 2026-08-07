"use client";

import Image from "next/image";
import Link from "next/link";
import type React from "react";
import { Suspense, lazy } from "react";

import { SidebarSearch } from "@/components/sidebar/molecules/SidebarSearch";
import { SidebarUser } from "@/components/sidebar/molecules/SidebarUser";
import { SidebarNavLinks } from "@/components/sidebar/organisms/SidebarNavLinks";
import { SocialLinksSkeleton } from "@/components/sidebar/skeletons/SocialLinksSkeleton";
import { Separator, Sidebar, SidebarContent, SidebarFooter, SidebarHeader } from "@rose-griffon/ui";
import { assoMenu, contactMenu } from "@/lib/sidebar-config";

const SocialLinks = lazy(() => import("@/components/sidebar/organisms/SocialLinks"));

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
	return (
		<Sidebar collapsible="offcanvas" {...props}>
			<SidebarContent className="flex flex-col overflow-x-hidden bg-sidebar text-sidebar-foreground">
				<SidebarHeader className="gap-3 border-b border-sidebar-border/40 px-3 pb-3 pt-4">
					<Link
						href="/"
						className="flex items-center gap-2.5 rounded-md px-1 py-0.5 transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-sidebar-ring"
					>
						<div className="relative size-10 shrink-0">
							<Image
								src="/RG_Logo_V2.5.webp"
								fill
								alt=""
								sizes="40px"
								priority
								className="object-contain drop-shadow-md"
							/>
						</div>
						<span className="truncate text-lg font-bold tracking-tight text-sidebar-foreground">
							Rose Griffon
						</span>
					</Link>

					<SidebarSearch />
				</SidebarHeader>

				<div className="custom-scrollbar flex-1 space-y-1 overflow-y-auto overflow-x-hidden py-4">
					<SidebarNavLinks title={assoMenu.label} items={assoMenu.items} />

					<Separator className="mx-3 my-2 bg-sidebar-border/40" />
					<SidebarNavLinks title={contactMenu.label} items={contactMenu.items} />

					<div className="px-3 pt-1">
						<Suspense fallback={<SocialLinksSkeleton />}>
							<SocialLinks />
						</Suspense>
					</div>
				</div>

				<SidebarFooter className="gap-2 border-t border-sidebar-border/40 px-3 py-2">
					<SidebarUser />
				</SidebarFooter>
			</SidebarContent>
		</Sidebar>
	);
}
