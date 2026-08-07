"use client";

import "./globals.css";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import {
	BREAKPOINTS,
	SidebarInset,
	SidebarProvider,
	Toaster,
	useBreakpoint,
	useSidebar,
} from "@rose-griffon/ui";
import { WebsiteNavigationRail } from "@/components/layout/WebsiteNavigationRail";
import { Menu, ChevronLeft, ChevronRight } from "lucide-react";

function CustomSidebarTrigger() {
	const { open, toggleSidebar } = useSidebar();
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		setMounted(true);
	}, []);

	if (!mounted) return null;

	return (
		<button
			onClick={toggleSidebar}
			className={cn(
				"fixed top-[26px] z-50 rounded-full flex items-center justify-center transition-all duration-300 ease-in-out",
				"size-5 text-foreground/50 hover:text-foreground hover:bg-foreground/10 active:bg-foreground/20 cursor-pointer",
				"bg-background/80 backdrop-blur-xs border border-border/40 shadow-xs",
				"opacity-60 hover:opacity-100 hover:scale-105 active:scale-95",
				open ? "left-[214px]" : "left-3"
			)}
			aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
		>
			{open ? <ChevronLeft size={12} /> : <ChevronRight size={12} />}
		</button>
	);
}

import { SkipToContent } from "@/components/accessibility/SkipToContent";
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
		<SidebarProvider
			open={sidebarOpen}
			onOpenChange={handleOpenChange}
			style={{ "--sidebar-width": "14rem" } as React.CSSProperties}
		>
			{children}
		</SidebarProvider>
	);
}

export default function ClientLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	const { isOpen } = useSidebarStore();
	const breakpoint = useBreakpoint();
	const isCompact = breakpoint === "compact";
	const isMedium = breakpoint === "medium";
	const isExpanded = breakpoint === "expanded" || breakpoint === "large";

	const pathname = usePathname();
	const isAdminPage = pathname?.startsWith("/admin");
	const isShopPage = pathname?.startsWith("/shop");
	const isAuthPage =
		pathname?.startsWith("/login") ||
		pathname?.startsWith("/register") ||
		pathname?.startsWith("/auth");

	const shouldHideSidebar = isAdminPage || isShopPage || isAuthPage;

	return (
		<ThemeProvider>
			<Providers>
				<AuthProvider>
					<ProfileProvider>
						<SidebarWrapper>
							{/* Accessibilité: lien pour sauter au contenu principal */}
							<SkipToContent />

							{/* NAVIGATION RAIL (MEDIUM SCREENS) */}
							{isMedium && !shouldHideSidebar && <WebsiteNavigationRail />}

							{/* SIDEBAR (EXPANDED SCREENS) */}
							{!shouldHideSidebar && <AppSidebar className={cn("hidden", isExpanded && "block")} />}

							<SidebarNavigationHandler />
							<EdgeSwipeDetector />

							<SidebarInset
								className={cn(
									"transition-all duration-300 min-w-0",
									isMedium && "ml-20",
									isExpanded && isOpen && "ml-[224px]"
								)}
							>
								<div
									className={cn(
										"flex flex-col min-h-[100dvh] w-full",
										"pb-[calc(4rem+env(safe-area-inset-bottom))] lg:pb-0"
									)}
								>
									{isCompact && <Header isMobile showSearch={false} showCart={false} />}
									<div className="flex-1 w-full">
										<div className="min-h-full w-full overflow-x-hidden">
											<main id="main-content" className="flex-1 w-full">
												{children}
											</main>
										</div>
									</div>
									<Footer />
									<MobileWatermark />
									{/* Affiche la barre de nav du bas uniquement sur mobile, hors shop/auth/admin */}
									{isCompact && !shouldHideSidebar && <MobileBottomNavigation />}
								</div>
							</SidebarInset>

							{!shouldHideSidebar && isExpanded && <CustomSidebarTrigger />}
						</SidebarWrapper>
						<Toaster richColors position="top-right" />
					</ProfileProvider>
				</AuthProvider>
			</Providers>
		</ThemeProvider>
	);
}
