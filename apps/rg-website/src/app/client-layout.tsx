"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  sectionTheme,
  SidebarInset,
  SidebarProvider,
  THEME_PACKS,
  type ThemeType,
  Toaster,
  useBreakpoint,
  useTheme,
} from "@rosegriffon/ui";
import { ThemeToggle, domaineDeLaRoute, type NavItem } from "@rosegriffon/app-shell";
import { WebsiteNavigationRail } from "@/components/layout/WebsiteNavigationRail";

/** Largeur de la sidebar desktop — source unique (CSS var + décalage du bouton). */
const SIDEBAR_WIDTH = "14rem";

import { SkipToContent } from "@/components/accessibility/SkipToContent";
import { AppSidebar } from "@/components/app-sidebar";
import { PiedDePage } from "@/components/layout/PiedDePage";
import { Header } from "@/components/layout/Header";
import { isAdminRole } from "@/lib/auth-roles";
import { MobileBottomNavigation } from "@/components/layout/MobileBottomNavigation";
import { NavIcone } from "@/components/layout/NavIcone";
import { LanguageSwitcher } from "@/components/shared/LanguageSwitcher";
import SidebarNavigationHandler from "@/components/layout/SidebarNavigationHandler";
import EdgeSwipeDetector from "@/components/shared/EdgeSwipeDetector";
import MobileWatermark from "@/components/shared/MobileWatermark";
import { DynamicUniverseHead } from "@/components/layout/DynamicUniverseHead";
import { ThemeBackdrop } from "@/components/layout/ThemeBackdrop";
import { AuthProvider, useAuth } from "@/contexts/auth-context";
import { LanguageProvider, type Language, useLanguage } from "@/components/providers/language-provider";
import { ProfileProvider, useProfile } from "@/contexts/profile-context";
import { ThemeProvider } from "@/contexts/theme-context";
// Module direct, pas le baril `@/lib/achillea` : la coque ne doit pas embarquer le client API.
import { AchilleaAuthProvider, useAchilleaAuth } from "@/lib/achillea/auth-context";
import { Providers } from "@/lib/providers";
import { cn } from "@/lib/utils";
import { useSidebarStore } from "@/stores/sidebar-store";

function SidebarWrapper({ children, isMedium }: { children: React.ReactNode; isMedium: boolean }) {
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

/**
 * Classe de thème à appliquer sur la zone de contenu, selon le domaine.
 *
 * POURQUOI PAS `setTheme()`
 * La version précédente appelait `setTheme("achillea")` en entrant sur
 * `/achillea` et `setTheme("roy")` en en sortant. `next-themes` PERSISTE ce
 * choix : une seule visite sur l'e-sport écrasait définitivement la préférence
 * de l'utilisateur, et le retour au portail la remplaçait par `roy` — donc
 * quelqu'un qui avait choisi « Gaëlle » la perdait en traversant le site. Une
 * navigation ne doit pas réécrire un réglage de compte.
 *
 * Poser la classe sur le conteneur donne le même rendu — les trois jeux de
 * jetons sont définis sur `.theme-*`, pas seulement sur `:root` — sans toucher
 * à `localStorage`, sans effet de bord au retour, et sans le scintillement
 * d'un changement de thème après hydratation.
 */
function classeThemeDuDomaine(pathname: string): string | undefined {
  const impose = sectionTheme(domaineDeLaRoute(pathname));
  return impose ? `theme-${impose}` : undefined;
}

function RoutedHeader({ isMobile, showSidebarToggle }: { isMobile?: boolean; showSidebarToggle?: boolean }) {
  const pathname = usePathname() || "/";
  const activeDomaine = domaineDeLaRoute(pathname);
  const { user: rgUser } = useAuth();
  const { profile: rgProfile } = useProfile();
  const isEsport = activeDomaine === "esport";
  const isWiki = activeDomaine === "wiki";
  // Thème effectif : celui imposé par la section, sinon celui de l’utilisateur.
  // Son pack fournit le nom et le logo du chrome.
  const { theme } = useTheme();
  const pack = THEME_PACKS[sectionTheme(activeDomaine) ?? (theme as ThemeType)] ?? THEME_PACKS.roy;

  // L'identité affichée dans le chrome est toujours celle de la session RG.
  // Le jeton Achilléa est une capacité dérivée pour l'API e-sport, pas une
  // seconde connexion : le laisser piloter la topbar faisait « disparaître »
  // un membre connecté dès que le bot/API Achilléa redémarrait.
  const user = rgUser;
  const profile = rgProfile;

  const appName = pack.title;
  const logoSrc = pack.logo;
  const homeHref = isEsport ? "/achillea" : isWiki ? "/wiki" : "/";
  const accountHref = profile?.username ? `/profil/${encodeURIComponent(profile.username)}` : "/profil";

  return (
    <Header
      isMobile={isMobile}
      showSearch={!isMobile}
      showCart={false}
      showSidebarToggle={showSidebarToggle}
      showUniverseSwitch={false}
      showSettings={!isMobile}
      appName={appName}
      logoSrc={logoSrc}
      homeHref={homeHref}
      portalHref="/"
      accountHref={accountHref}
      themeToggleSlot={
        <div className="flex items-center gap-1 text-sidebar-foreground">
          <LanguageSwitcher />
          <ThemeToggle className="!text-sidebar-foreground hover:!bg-sidebar-accent" />
        </div>
      }
      user={user}
      profile={profile}
      isAdmin={isAdminRole(profile?.role)}
      adminHref="/admin"
    />
  );
}

/**
 * Le menu est une aide de parcours, jamais un contrôle d'accès : les routes et
 * mutations Achilléa conservent leur vérification côté API. Cette lecture de
 * `/clans/role` sert uniquement à proposer le tableau de bord aux officiers
 * réellement reconnus par la base, sans confondre « joueur connecté » et
 * « chef de clan ».
 */
function useAchilleaNavigationVisibility(pathname: string) {
  const { user, isAuthenticated } = useAchilleaAuth();
  const [clanRole, setClanRole] = useState<number | null>(null);
  const isEsport = domaineDeLaRoute(pathname) === "esport";

  const [requestIdentity1, setRequestIdentity1] = useState<readonly unknown[]>([isAuthenticated, isEsport, user?.id]);
  if ([isAuthenticated, isEsport, user?.id].some((value, position) => !Object.is(value, requestIdentity1[position]))) {
    setRequestIdentity1([isAuthenticated, isEsport, user?.id]);
    (() => {
      if (!isEsport || !isAuthenticated) {
        setClanRole(null);
        return;
      }
      setClanRole(null);
    })();
  }
  useEffect(() => {
    if (!isEsport || !isAuthenticated) {
      return;
    }

    let cancelled = false;

    // Import différé : seul un membre connecté sur l'e-sport en a besoin.
    void import("@/lib/achillea/client")
      .then(({ createAchilleaClient }) => createAchilleaClient({ credentials: "include" }).clans.myRole())
      .then(result => {
        if (!cancelled && result.ok) setClanRole(result.value.role);
      });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, isEsport, user?.id]);

  return (item: NavItem): boolean => {
    const access = item.access;
    if (!access) return true;
    if (access.requiresAuthentication && !isAuthenticated) return false;
    const achilleaRole = Number(user?.role ?? 0);
    if (access.minimumAchilleaRole !== undefined && (!isAuthenticated || achilleaRole < access.minimumAchilleaRole)) {
      return false;
    }
    if (
      access.minimumClanRole !== undefined &&
      (!isAuthenticated || clanRole === null || clanRole < access.minimumClanRole)
    ) {
      return false;
    }
    return true;
  };
}

function RoutedSidebar() {
  const { t } = useLanguage();
  const pathname = usePathname() || "/";
  const canView = useAchilleaNavigationVisibility(pathname);
  return <AppSidebar canView={canView} renderIcon={NavIcone} headerSlot={null} t={t} />;
}

function RoutedNavigationRail() {
  const { t } = useLanguage();
  return <WebsiteNavigationRail renderIcon={NavIcone} t={t} />;
}

function RoutedMobileNavigation() {
  const { t } = useLanguage();
  return <MobileBottomNavigation renderIcon={NavIcone} t={t} />;
}

export default function ClientLayout({
  children,
  initialLanguage,
}: Readonly<{
  children: React.ReactNode;
  initialLanguage: Language;
}>) {
  const breakpoint = useBreakpoint();
  const isCompact = breakpoint === "compact";
  const isMedium = breakpoint === "medium";

  const pathname = usePathname();
  const themeSection = classeThemeDuDomaine(pathname || "/");
  const isAdminPage = pathname?.startsWith("/admin");
  const isShopPage = pathname?.startsWith("/shop");
  const isAuthPage =
    pathname?.startsWith("/login") || pathname?.startsWith("/register") || pathname?.startsWith("/auth");

  const shouldHideSidebar = isAdminPage || isShopPage || isAuthPage;

  // Le rail n'existe qu'au breakpoint « medium » ET hors pages sans chrome :
  // toute réservation de place doit suivre exactement cette condition.
  const showRail = isMedium && !shouldHideSidebar;

  return (
    <ThemeProvider>
      <Providers>
        <AuthProvider>
          <ProfileProvider>
            <LanguageProvider initialLanguage={initialLanguage}>
              <AchilleaAuthProvider>
                <SidebarWrapper isMedium={isMedium}>
                  {/* Gestionnaire dynamique de Favicon, Titre et SEO selon l'univers */}
                  <DynamicUniverseHead />
                  <ThemeBackdrop />

                  {/* Accessibilité: lien pour sauter au contenu principal */}
                  <SkipToContent />

                  {/* NAVIGATION RAIL (MEDIUM SCREENS) */}
                  {showRail && <RoutedNavigationRail />}

                  {/* SIDEBAR — tiroir en compact, tiroir à la demande en medium
								    (le bouton « Menu » du rail l'ouvre), panneau fixe en expanded.
								    Elle doit être montée aussi en medium : sans elle, ce bouton
								    basculait un état sans panneau et ne faisait rien. */}
                  {/* L'identité de l'univers est déjà portée par la topbar. Le header
											    interne de la sidebar était un doublon masqué sous cette barre fixe. */}
                  {!shouldHideSidebar && <RoutedSidebar />}

                  <SidebarNavigationHandler />
                  <EdgeSwipeDetector />

                  {/* Pas de marge gauche manuelle en expanded : <Sidebar> pose déjà un
								    « gap » de --sidebar-width dans le flux, qui décale l'inset. En
								    ajouter une seconde doublait le décalage et écrasait le contenu. */}
                  <SidebarInset className={cn("transition-all duration-300 min-w-0", showRail && "ml-20")}>
                    {/* La réserve en haut compense le Header fixe (4rem+safe-area en mobile, 14 (3.5rem) sur desktop/tablette).
									    La réserve en bas compense la barre de navigation basse (5rem+safe-area) uniquement montée en compact. */}
                    <div
                      className={cn(
                        "flex flex-col min-h-[100dvh] w-full",
                        // Section à thème imposé : la réserve du header fixe prend le
                        // fond de la section, sinon une bande du thème utilisateur
                        // apparaît au-dessus du contenu (vu sur /achillea).
                        themeSection && cn(themeSection, "bg-background text-foreground"),
                        !shouldHideSidebar && "pt-[calc(4rem+env(safe-area-inset-top))] md:pt-14",
                        isCompact && !shouldHideSidebar && "pb-[calc(5.5rem+env(safe-area-inset-bottom))]",
                      )}
                    >
                      {/* Le kit admin fournit son propre en-tête mobile : sans cette garde,
										    les deux se superposaient sur /admin (z-40 contre z-30). */}
                      {/* Barre supérieure unifiée et routée selon le domaine actif */}
                      {!shouldHideSidebar &&
                        (isCompact ? (
                          <RoutedHeader isMobile showSidebarToggle={false} />
                        ) : (
                          <RoutedHeader showSidebarToggle />
                        ))}
                      <div className="flex-1 w-full">
                        {/* `SidebarInset` est déjà un <main> : ici un <div> (un <main>
											    imbriqué est invalide et casse la cible du lien d'évitement). */}
                        {/* La classe de thème du domaine est posée ICI, sur la zone
											    de contenu : le chrome partagé (barre latérale, barres de
											    navigation) garde le thème choisi par l'utilisateur, et
											    seule la section prend l'identité de son domaine. */}
                        <div
                          id="main-content"
                          className={cn(
                            "min-h-full w-full flex-1 overflow-x-hidden",
                            themeSection,
                          )}
                        >
                          {children}
                        </div>
                      </div>
                      {/* /shop rend son propre pied de page (thémé DA boutique) dans
										    son layout : sans cette garde, les six routes du tunnel
										    d'achat empilaient deux `contentinfo` — rupture visuelle et
										    liens légaux annoncés deux fois par les lecteurs d'écran. */}
                      {/* En compact, la barre basse porte déjà la navigation : le grand footer
											    du site ferait doublon et ajouterait plusieurs écrans de défilement. */}
                      {!isShopPage && !isCompact && (
                        <PiedDePage />
                      )}
                      <MobileWatermark />
                      {/* Affiche la barre de nav du bas uniquement sur mobile, hors shop/auth/admin */}
                      {isCompact && !shouldHideSidebar && <RoutedMobileNavigation />}
                    </div>
                  </SidebarInset>
                </SidebarWrapper>
              </AchilleaAuthProvider>
            </LanguageProvider>
            <Toaster richColors position="top-right" />
          </ProfileProvider>
        </AuthProvider>
      </Providers>
    </ThemeProvider>
  );
}
