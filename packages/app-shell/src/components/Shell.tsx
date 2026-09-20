"use client";

import { usePathname } from "next/navigation";
import {
	SidebarInset,
	SidebarProvider,
	useBreakpoint,
} from "@rosegriffon/ui";
import { Footer } from "./Footer";
import { NavigationRail } from "./NavigationRail";
import { MobileBottomNav } from "./MobileBottomNav";
import { AppSidebar } from "./AppSidebar";
import { DesktopTopBar, MobileHeader, type UserProfile } from "./TopAppBar";
import { estSousAdministration } from "../config/routes";
import type { NavItem } from "../config/navigation";

export interface ShellProps {
	children: React.ReactNode;
	user?: unknown | null;
	profile?: UserProfile | null;
	isAdmin?: boolean;
	defaultOpen?: boolean;
	appName?: string;
	logoSrc?: string;
	adminHref?: string;
	accountHref?: string;
	searchSlot?: React.ReactNode;
	notificationsSlot?: React.ReactNode;
	themeToggleSlot?: React.ReactNode;
	loginSlot?: React.ReactNode;
	sidebarItems?: NavItem[];
	mobileNavItems?: NavItem[];
	t?: (key: string) => string;
	renderIcon?: (item: NavItem) => React.ReactNode;
}

export function Shell({
	children,
	user = null,
	profile = null,
	isAdmin = false,
	defaultOpen = true,
	appName = "Azalée",
	logoSrc = "/logo.webp",
	adminHref,
	accountHref = "/settings",
	searchSlot,
	notificationsSlot,
	themeToggleSlot,
	loginSlot,
	sidebarItems,
	mobileNavItems,
	t,
	renderIcon,
}: ShellProps) {
	const pathname = usePathname() || "/";
	const breakpoint = useBreakpoint();

	const isCompact = breakpoint === "compact";
	const isMedium = breakpoint === "medium";
	const isExpanded =
		breakpoint === "expanded" || breakpoint === "large" || breakpoint === "extra-large";

	const isEditorPage =
		pathname.includes("/news/") &&
		(pathname.includes("/new") || pathname.split("/").length > 4);
	const isFullscreenPage = pathname === "/login";
	const isDashboard = estSousAdministration(pathname);

	const resolvedAdminHref =
		adminHref ?? (pathname.startsWith("/admin") ? "/admin" : "/dashboard");
	const resolvedIsAdmin =
		isAdmin ||
		(profile && typeof profile === "object" && "role" in profile && profile.role === "admin");

	if (isEditorPage || isFullscreenPage) {
		return (
			<div className="fixed inset-0 z-40 overflow-y-auto overscroll-contain bg-background pb-[env(safe-area-inset-bottom)]">
				{children}
			</div>
		);
	}

	return (
		<SidebarProvider defaultOpen={defaultOpen}>
			{/* Skip link for accessibility */}
			<a
				href="#main-content"
				className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-on-primary focus:rounded-md"
			>
				Aller au contenu principal
			</a>

			{/* Fixed Desktop Top Bar (Medium/Expanded) */}
			{!isCompact && (
				<DesktopTopBar
					appName={appName}
					logoSrc={logoSrc}
					adminHref={resolvedAdminHref}
					isAdmin={Boolean(resolvedIsAdmin)}
					user={user}
					profile={profile}
					searchSlot={searchSlot}
					notificationsSlot={notificationsSlot}
					themeToggleSlot={themeToggleSlot}
					loginSlot={loginSlot}
					accountHref={accountHref}
				/>
			)}

			{/* Main responsive layout */}
			<div className={`flex w-full bg-surface min-h-[100dvh] ${!isCompact ? "pt-14" : ""}`}>
				{/* NAVIGATION RAIL (MEDIUM SCREENS 600-839px) */}
				{isMedium && !isDashboard && (
					<NavigationRail
						items={sidebarItems}
						isAdmin={Boolean(resolvedIsAdmin)}
						t={t}
						renderIcon={renderIcon}
					/>
				)}

				{/* SIDEBAR (EXPANDED SCREENS >=840px OR COMPACT DRAWER) */}
				{(isExpanded || isCompact) && !isDashboard && (
					<AppSidebar
						variant="sidebar"
						className={isExpanded ? "top-14! h-auto!" : undefined}
						items={sidebarItems}
						isAdmin={Boolean(resolvedIsAdmin)}
						t={t}
						renderIcon={renderIcon}
					/>
				)}

				{/* Content Area */}
				<SidebarInset
					className={`flex-1 min-w-0 bg-surface-container flex flex-col transition-all duration-300 ${
						isMedium && !isDashboard ? "ml-20" : ""
					}`}
				>
					{/* Mobile Header (Only on compact screens) */}
					{isCompact && !isDashboard && (
						<MobileHeader
							appName={appName}
							logoSrc={logoSrc}
							adminHref={resolvedAdminHref}
							isAdmin={Boolean(resolvedIsAdmin)}
							user={user}
							profile={profile}
							notificationsSlot={notificationsSlot}
							themeToggleSlot={themeToggleSlot}
							loginSlot={loginSlot}
							accountHref={accountHref}
						/>
					)}

					{/* SidebarInset est déjà le landmark <main> ; le conteneur intérieur est un <div> portant id="main-content" pour le lien d'évitement. */}
					<div
						id="main-content"
						className={`flex-1 overflow-y-auto overflow-x-hidden scrollbar-hide flex flex-col ${
							isCompact && !isDashboard ? "pt-[calc(4rem+env(safe-area-inset-top))]" : "pt-0"
						}`}
					>
						<div
							className={`vt-page-content mx-auto w-full max-w-[1800px] flex-1 px-4 md:px-8 lg:px-12 ${
								isCompact && !isDashboard
									? "pb-[calc(6rem+env(safe-area-inset-bottom))]"
									: "pb-6"
							}`}
						>
							{children}
						</div>
						<Footer />
					</div>
				</SidebarInset>
			</div>

			{/* BOTTOM NAV (COMPACT SCREENS) */}
			{isCompact && !isDashboard && (
				<MobileBottomNav
					items={mobileNavItems}
					t={t}
					renderIcon={renderIcon}
				/>
			)}
		</SidebarProvider>
	);
}

export { Shell as AppShell };
export default Shell;
