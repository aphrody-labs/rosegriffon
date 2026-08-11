"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { SidebarInset, SidebarProvider, Toaster, useBreakpoint, useSidebar } from "@rose-griffon/ui";
import { WebsiteNavigationRail } from "@/components/layout/WebsiteNavigationRail";

/** Largeur de la sidebar desktop — source unique (CSS var + décalage du bouton). */
const SIDEBAR_WIDTH = "14rem";

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

function SidebarWrapper({
	children,
	isMedium,
}: {
	children: React.ReactNode;
	isMedium: boolean;
}) {
	const { isOpen, setSidebarOpen } = useSidebarStore();
	// En « medium » le rail occupe déjà la colonne : la sidebar y est un tiroir
	// que l'on ouvre à la demande. Elle ne doit donc PAS suivre la préférence
	// persistée du desktop (sinon elle s'ouvrirait d'office par-dessus le rail).
	const [mediumOpen, setMediumOpen] = useState(false);

	const sidebarOpen = isMedium ? mediumOpen : isOpen;

	const handleOpenChange = (open: boolean) => {
		if (isMedium) {
			setMediumOpen(open);
			return;
		}
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

	// Le rail n'existe qu'au breakpoint « medium » ET hors pages sans chrome :
	// toute réservation de place doit suivre exactement cette condition.
	const showRail = isMedium && !shouldHideSidebar;

	return (
		<ThemeProvider>
			<Providers>
				<AuthProvider>
					<ProfileProvider>
						<SidebarWrapper isMedium={isMedium}>
							{/* Accessibilité: lien pour sauter au contenu principal */}
							<SkipToContent />

							{/* NAVIGATION RAIL (MEDIUM SCREENS) */}
							{showRail && <WebsiteNavigationRail />}

							{/* SIDEBAR — tiroir en compact, tiroir à la demande en medium
							    (le bouton « Menu » du rail l'ouvre), panneau fixe en expanded.
							    Elle doit être montée aussi en medium : sans elle, ce bouton
							    basculait un état sans panneau et ne faisait rien. */}
							{!shouldHideSidebar && <AppSidebar />}

							<SidebarNavigationHandler />
							<EdgeSwipeDetector />

							{/* Pas de marge gauche manuelle en expanded : <Sidebar> pose déjà un
							    « gap » de --sidebar-width dans le flux, qui décale l'inset. En
							    ajouter une seconde doublait le décalage et écrasait le contenu. */}
							<SidebarInset
								className={cn("transition-all duration-300 min-w-0", showRail && "ml-20")}
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
									{/* Le kit admin fournit son propre en-tête mobile : sans cette garde,
									    les deux se superposaient sur /admin (z-40 contre z-30). */}
									{/* Barre supérieure montée à TOUTES les tailles — même système que
									    le wiki. Elle n'existait qu'en mobile : sur desktop il n'y avait
									    ni recherche, ni statut de direct, et la bascule de menu se
									    réduisait à une pastille flottante de 20 px. */}
									{!shouldHideSidebar &&
										(isCompact ? (
											<Header isMobile showSearch={false} showCart={false} />
										) : (
											<Header showSidebarToggle />
										))}
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

						</SidebarWrapper>
						<Toaster richColors position="top-right" />
					</ProfileProvider>
				</AuthProvider>
			</Providers>
		</ThemeProvider>
	);
}
