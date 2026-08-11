"use client";

import "./globals.css";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { SidebarInset, SidebarProvider, Toaster, useBreakpoint, useSidebar } from "@rose-griffon/ui";
import { WebsiteNavigationRail } from "@/components/layout/WebsiteNavigationRail";
import { ChevronLeft, ChevronRight } from "lucide-react";

/** Largeur de la sidebar desktop — source unique (CSS var + décalage du bouton). */
const SIDEBAR_WIDTH = "14rem";

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
				open ? "left-[calc(var(--sidebar-width)-10px)]" : "left-3"
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

	// Utilise l'état local/persisté pour toutes les tailles d'écran afin de permettre le masquage sur desktop
	const sidebarOpen = isOpen;

	const handleOpenChange = (open: boolean) => {
		setSidebarOpen(open);
	};

	return (
		<SidebarProvider
			open={sidebarOpen}
			onOpenChange={handleOpenChange}
			style={{ "--sidebar-width": SIDEBAR_WIDTH } as React.CSSProperties}
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

							{/* SIDEBAR — tiroir modal en compact, panneau fixe en expanded.
							    En medium c'est le rail qui prend le relais : monter la sidebar
							    ici la rendrait quand même visible (ses classes internes sont
							    `hidden md:flex`, donc dès 768px) par-dessus le contenu. */}
							{!shouldHideSidebar && !isMedium && <AppSidebar />}

							<SidebarNavigationHandler />
							<EdgeSwipeDetector />

							{/* Pas de marge gauche manuelle en expanded : <Sidebar> pose déjà un
							    « gap » de --sidebar-width dans le flux, qui décale l'inset. En
							    ajouter une seconde doublait le décalage et écrasait le contenu. */}
							<SidebarInset
								className={cn("transition-all duration-300 min-w-0", isMedium && "ml-20")}
							>
								{/* La réserve de 4rem en bas ne vaut que si la barre de navigation
								    basse est réellement montée (compact). Elle était coupée à `lg:`
								    (1024px) alors que la barre disparaît dès 600px : 4rem de vide
								    en bas de page sur toute la plage tablette. */}
								<div
									className={cn(
										"flex flex-col min-h-[100dvh] w-full",
										isCompact && !shouldHideSidebar && "pb-[calc(4rem+env(safe-area-inset-bottom))]"
									)}
								>
									{isCompact && <Header isMobile showSearch={false} showCart={false} />}
									<div className="flex-1 w-full">
										{/* `SidebarInset` est déjà un <main> : ici un <div> (un <main>
										    imbriqué est invalide et casse la cible du lien d'évitement). */}
										<div id="main-content" className="min-h-full w-full flex-1 overflow-x-hidden">
											{children}
										</div>
									</div>
									{/* /shop rend son propre pied de page (thémé DA boutique) dans
									    son layout : sans cette garde, les six routes du tunnel
									    d'achat empilaient deux `contentinfo` — rupture visuelle et
									    liens légaux annoncés deux fois par les lecteurs d'écran. */}
									{!isShopPage && <Footer />}
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
