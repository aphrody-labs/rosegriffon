"use client";

import "./globals.css";

import { usePathname } from "next/navigation";
import { BREAKPOINTS, SidebarInset, SidebarProvider, SidebarTrigger, Toaster, useBreakpoint } from "@rosegriffon/ui";
import { WebsiteNavigationRail } from "@/components/layout/WebsiteNavigationRail";

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
								<SidebarTrigger className="fixed top-4 left-4 z-50 rounded-lg border bg-background/80 shadow-md backdrop-blur-xs transition-[left] duration-200 peer-data-[state=expanded]:left-[calc(var(--sidebar-width)+16px)]" />
							)}

							<SidebarNavigationHandler />
							<EdgeSwipeDetector />
							<SidebarInset className={cn(
								"transition-all duration-300",
								isMedium && "ml-20",
								isExpanded && "ml-0" // Sidebar handles its own gap
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
