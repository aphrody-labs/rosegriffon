/**
 * Navigation de website — le wiki est monté sous `/wiki` de `rosegriffon.fr`,
 * l'administration sous `/admin`.
 *
 * La structure du menu vit dans `@rosegriffon/app-shell`. Ne pas réintroduire
 * de liste d'items locale : Website est l'unique frontend et monte le wiki sous
 * `/wiki`.
 */
import { construireNavigation, WEBSITE_BASES } from "@rosegriffon/app-shell";

export { estItemActif, estRouteActive, type NavItem } from "@rosegriffon/app-shell";

const { dashboardItems, mobileNavItems, navigationItems } = construireNavigation(WEBSITE_BASES);

export { dashboardItems, mobileNavItems, navigationItems };
