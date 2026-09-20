/**
 * Registre canonique des routes du chrome applicatif.
 *
 * Le wiki Azalée est servi à DEUX emplacements : à la racine sur
 * `azalee.rosegriffon.fr` et sous `/wiki` sur `rosegriffon.fr`. Les deux apps
 * maintenaient jusqu'ici deux copies manuelles de `config/navigation.ts` qui ne
 * différaient QUE par ce préfixe — et qui dérivaient à chaque ajout de page
 * (entrées oubliées d'un côté, chemins non préfixés de l'autre = 404).
 *
 * Ce module isole donc ce qui varie (`NavBases`) de ce qui ne varie pas (la
 * structure du menu), pour que les deux barres latérales, les deux rails et les
 * deux barres de navigation basses soient interchangeables et synchronisés par
 * construction.
 */

/** Emplacements où l'app monte le wiki et l'administration. */
export interface NavBases {
	/** Préfixe du wiki : `""` (azalee, à la racine) ou `"/wiki"` (website). */
	wiki: string;
	/** Racine de l'administration : `"/dashboard"` (azalee) ou `"/admin"` (website). */
	admin: string;
}

export const AZALEE_BASES: NavBases = { admin: "/dashboard", wiki: "" };
export const WEBSITE_BASES: NavBases = { admin: "/admin", wiki: "/wiki" };

/**
 * Compose un chemin du wiki avec le préfixe de l'app.
 *
 * `joindreWiki("", "/")` doit rendre `/` et non `""` : une chaîne vide n'est pas
 * une URL valide pour `next/link` et cassait silencieusement le lien d'accueil.
 */
export function joindreWiki(base: string, chemin: string): string {
	const prefixe = base.replace(/\/$/, "");
	if (chemin === "/") {
		return prefixe || "/";
	}
	return `${prefixe}${chemin}`;
}

/**
 * Routes du wiki, exprimées SANS préfixe. Source unique pour la navigation, les
 * `activePaths` mobiles et les tests de non-régression des liens.
 */
export const CHEMINS_WIKI = [
	"/",
	"/cross",
	"/patch-notes",
	"/chara",
	"/skill",
	"/tactic",
	"/passive",
	"/aura",
	"/aura/esprits-guerriers",
	"/aura/totems",
	"/aura/miximax",
	"/aura/eveil",
	"/aura/changement-mode",
	"/equipe",
	"/entraineur",
	"/stade",
	"/item",
	"/boutique",
	"/capsule",
	"/invocation",
	"/drops",
	"/quete",
	"/niveau",
	"/succes",
	"/gallery",
	"/textures",
	"/sons",
	"/videos",
	"/modeles",
	"/keshin",
	"/mode",
	"/tools",
	"/tools/stats",
	"/tools/compare",
	"/tools/random-team",
	"/tools/my-team",
	"/tools/translator",
	"/save",
	"/demo",
] as const;

/**
 * Routes servies à la racine dans LES DEUX apps : elles ne prennent jamais le
 * préfixe du wiki. Les préfixer était la cause des 404 sur `/wiki/news` et
 * `/wiki/settings` côté website.
 */
export const CHEMINS_RACINE = ["/news", "/settings", "/search", "/login"] as const;

export type CheminWiki = (typeof CHEMINS_WIKI)[number];
export type CheminRacine = (typeof CHEMINS_RACINE)[number];
