// Navigation & Route Configurations
export {
	cheminsCliquables,
	construireAssociationItems,
	construireDashboardItems,
	construireEsportItems,
	construireMobileNavItems,
	construireMobileNavUnifiee,
	construireNavigation,
	construireNavigationItems,
	construireNavigationUnifiee,
	DOMAINES,
	domaineDeLaRoute,
	estItemActif,
	estRouteActive,
	parcourirNav,
	type Domaine,
	type NavItem,
	type SousCategorieNav,
} from "./config/navigation";
export {
	AZALEE_BASES,
	basesDepuisChemin,
	CHEMINS_ASSOCIATION,
	CHEMINS_ESPORT,
	CHEMINS_RACINE,
	CHEMINS_WIKI,
	estSousAdministration,
	joindreDomaine,
	joindreWiki,
	WEBSITE_BASES,
	type CheminAssociation,
	type CheminEsport,
	type CheminRacine,
	type CheminWiki,
	type NavBases,
} from "./config/routes";

// Icons & Translations
export { iconMap, type IconName, type LucideIcon } from "./lib/icons";
export { DICTIONNAIRE_NAV_FR, traduireNav } from "./lib/translations";

// Shared Chrome Components
export { Footer, AzaleeFooter, type FooterProps } from "./components/Footer";
export { NavigationRail, AzaleeNavigationRail, type NavigationRailProps } from "./components/NavigationRail";
export {
	MobileBottomNav,
	MaterialBottomNav,
	MobileBottomNavigation,
	type MobileBottomNavProps,
} from "./components/MobileBottomNav";
export { AppSidebar, WikiSidebar, type AppSidebarProps } from "./components/AppSidebar";
export {
	TopAppBar,
	DesktopTopBar,
	MobileHeader,
	Header,
	resolvePageTitle,
	type TopAppBarProps,
	type UserProfile,
} from "./components/TopAppBar";
export { ThemeToggle, DEFAULT_THEMES, type ThemeOption } from "./components/ThemeToggle";
export { Shell, AppShell, type ShellProps } from "./components/Shell";
export { UnifiedSearchBar, type UnifiedSearchBarProps } from "./components/UnifiedSearchBar";
export { UniverseSwitch, type UniverseSwitchProps } from "./components/UniverseSwitch";
