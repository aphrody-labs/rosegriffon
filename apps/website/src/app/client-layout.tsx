"use client";

import "./globals.css";

import { usePathname } from "next/navigation";
import { BREAKPOINTS, SidebarInset, SidebarProvider, Toaster, useBreakpoint } from "@rosegriffon/ui";
import { WebsiteNavigationRail } from "@/components/layout/WebsiteNavigationRail";
import { Menu, ChevronLeft } from "lucide-react";

function CustomSidebarTrigger() {
	const { isOpen, toggleSidebar } = useSidebarStore();
	return (
		<button
			onClick={toggleSidebar}
			className={cn(
				"fixed top-4 z-50 rounded-full flex items-center justify-center transition-all duration-300",
				"size-8 text-foreground/75 hover:bg-black/10 dark:hover:bg-white/10 hover:text-foreground",
				"bg-transparent border border-border/10 shadow-sm backdrop-blur-xs",
				"focus-visible:outline-hidden cursor-pointer",
				isOpen 
					? "left-[calc(var(--sidebar-width)+12px)]" 
					: "left-4"
			)}
			aria-label={isOpen ? "Fermer le menu" : "Ouvrir le menu"}
		>
			{isOpen ? <ChevronLeft size={16} /> : <Menu size={16} />}
		</button>
	);
}

import { AppSidebar } from "@/components/app-sidebar";
import Footer from "@/components/layout/footer";
import { Header } from "@/components/layout/Header";
import { MobileBottomNavigation } from "@/components/layout/MobileBottomNavigation";
import SidebarNavigationHandler from "@/components/layout/SidebarNavigationHandler";
import EdgeSwipeDetector from "@/components/shared/EdgeSwipeDetector";
import MobileWatermark from "@/components/shared/MobileWatermark";
import { AuthProvider } from "@/contexts/auth-context";
import { ProfileProvider } from "@/contexts/profile-context";
import { ThemeProvider } from "@/contexts/theme-context";
import { Providers } from "@/lib/providers";
import { cn } from "@/lib/utils";
import { useSidebarStore } from "@/stores/sidebar-store";

function SidebarWrapper({ children }: { children: React.ReactNode }) {
	const { isOpen, setSidebarOpen } = useSidebarStore();
	const breakpoint = useBreakpoint();
	const isCompact = breakpoint === "compact";
	const isMedium = breakpoint === "medium";
	const isExpanded = breakpoint === "expanded" || breakpoint === "large";

	// Utilise l'état local/persisté pour toutes les tailles d'écran afin de permettre le masquage sur desktop
	const sidebarOpen = isOpen;

	const handleOpenChange = (open: boolean) => {
		setSidebarOpen(open);
	};

	return (
		<SidebarProvider open={sidebarOpen} onOpenChange={handleOpenChange}>
			{children}
		</SidebarProvider>
	);
}

export default function ClientLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	const breakpoint = useBreakpoint();
	const isCompact = breakpoint === "compact";
	const isMedium = breakpoint === "medium";
	const isExpanded = breakpoint === "expanded" || breakpoint === "large";
	
	const pathname = usePathname();
	const isAdminPage = pathname?.startsWith("/admin");

	const shouldHideSidebar = isAdminPage;

	return (
		<ThemeProvider>
			<Providers>
				<AuthProvider>
					<ProfileProvider>
						<SidebarWrapper>
							{/* NAVIGATION RAIL (MEDIUM SCREENS) */}
							{isMedium && !shouldHideSidebar && <WebsiteNavigationRail />}

							{/* SIDEBAR (EXPANDED SCREENS) */}
							{!shouldHideSidebar && (
								<AppSidebar 
									className={cn(
										"hidden",
										isExpanded && "flex"
									)}
								/>
							)}

							{!shouldHideSidebar && isExpanded && (
								<CustomSidebarTrigger />
							)}

							<SidebarNavigationHandler />
							<EdgeSwipeDetector />
							<SidebarInset className={cn(
								"transition-all duration-300",
								isMedium && "ml-20",
								isExpanded && "ml-[var(--sidebar-width)] peer-data-[state=collapsed]:ml-0"
							)}>
								<div
									className={cn(
										"flex flex-col min-h-[100dvh] w-full",
										"pb-[calc(4rem+env(safe-area-inset-bottom))] lg:pb-0",
									)}
								>
									{isCompact && (
										<Header isMobile showSearch={false} showCart={false} />
									)}
									<div className="flex-1 w-full">
										<div className="min-h-full w-full overflow-x-hidden">
											<div className="flex-1 w-full">{children}</div>
										</div>
									</div>
									<Footer />
									<MobileWatermark />
									{/* Affiche la barre de nav du bas uniquement sur mobile */}
									{isCompact && <MobileBottomNavigation />}
								</div>
							</SidebarInset>
						</SidebarWrapper>
						<Toaster richColors position="top-right" />
					</ProfileProvider>
				</AuthProvider>
			</Providers>
		</ThemeProvider>
	);
}
