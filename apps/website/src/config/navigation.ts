/**
 * Navigation de website — le wiki est monté sous `/wiki` de `rosegriffon.fr`,
 * l'administration sous `/admin`.
 *
 * La structure du menu vit dans `@rosegriffon/app-shell` : elle est partagée mot
 * pour mot avec `apps/azalee`, qui sert le même wiki à la racine. Seules les
 * bases de montage diffèrent, et elles sont déclarées ici. Ne PAS réintroduire
 * de liste d'items en dur : les deux copies manuelles précédentes avaient dérivé
 * (entrées oubliées d'un côté, chemins non préfixés de l'autre = 404).
 */
import { construireNavigation, WEBSITE_BASES } from "@rosegriffon/app-shell";

export { estItemActif, estRouteActive, type NavItem } from "@rosegriffon/app-shell";

const { dashboardItems, mobileNavItems, navigationItems } = construireNavigation(WEBSITE_BASES);

export { dashboardItems, mobileNavItems, navigationItems };
