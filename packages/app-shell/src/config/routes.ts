/**
 * Registre canonique des routes du chrome applicatif.
 *
 * Le wiki Azalée est servi sous `/wiki` par l'unique application Website.
 *
 * Ce module isole donc ce qui varie (`NavBases`) de ce qui ne varie pas (la
 * structure du menu), pour que les deux barres latérales, les deux rails et les
 * deux barres de navigation basses soient interchangeables et synchronisés par
 * construction.
 */

/** Emplacements où l'app monte ses trois domaines et l'administration. */
export interface NavBases {
	/** Préfixe du wiki. */
	wiki: string;
	/** Racine de l'administration. */
	admin: string;
	/**
	 * Préfixe de l'e-sport (Achilléa).
	 *
	 * OPTIONNEL À DESSEIN : la navigation unifiée est arrivée après les deux
	 * apps, et les rendre obligatoires aurait cassé tous les appelants d'un
	 * coup. Une base absente signifie « ce domaine n'est pas monté ici » — la
	 * sous-catégorie correspondante disparaît du menu au lieu de produire des
	 * liens vers des pages inexistantes.
	 */
	esport?: string;
	/** Préfixe de l'espace association (portail). Racine du site par défaut. */
	association?: string;
	/** Expose les surfaces techniques et médias désormais hébergées hors d'Azalée. */
	surfacesNiers?: boolean;
}

export const WEBSITE_BASES: NavBases = {
	admin: "/admin",
	association: "",
	esport: "/achillea",
	wiki: "/wiki",
	surfacesNiers: true,
};

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

/** Routes lourdes migrées vers niers, encore montées sous `/wiki` par website. */
export const CHEMINS_NIERS = [
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

export function cheminsWikiPour(bases: NavBases): readonly string[] {
	return bases.surfacesNiers
		? CHEMINS_WIKI
		: CHEMINS_WIKI.filter(
				(chemin) => !CHEMINS_NIERS.includes(chemin as (typeof CHEMINS_NIERS)[number])
			);
}

/**
 * Routes servies à la racine dans LES DEUX apps : elles ne prennent jamais le
 * préfixe du wiki. Les préfixer était la cause des 404 sur `/wiki/news` et
 * `/wiki/settings` côté website.
 */
export const CHEMINS_RACINE = ["/news", "/settings", "/search", "/login"] as const;

/**
 * Routes de l'e-sport (Achilléa), exprimées SANS préfixe.
 *
 * Même raison d'être que `CHEMINS_WIKI` : la structure ne bouge pas, seul le
 * point de montage varie. Achilléa a vécu à la racine d'`achillea.rosegriffon.fr`
 * avant d'être monté sous `/achillea` ; exprimer les chemins relativement évite
 * de figer le second dans le menu.
 *
 * Seules les routes RÉELLEMENT servies figurent ici : `liens.test.ts` confronte
 * chaque entrée aux pages présentes sous `app/**`, et un lien sans page fait
 * échouer les tests plutôt que la production.
 */
export const CHEMINS_ESPORT = [
	"/",
	"/clans",
	"/clans/create",
	"/clans/dashboard",
	"/ranked",
	"/ranked/leaderboard",
	"/ranked/tiers",
	"/ranked/history",
	"/ranked/match",
	"/tournaments",
	"/tournaments/create",
	"/tournaments/circuit/ranking",
	"/leagues/astral",
	"/casts",
	"/licence",
	"/wallet",
	"/organizations/create",
	"/guide",
	"/guide/brand",
] as const;

/**
 * Routes de l'espace association (portail Rose Griffon), SANS préfixe.
 *
 * L'association est montée à la racine du site : son préfixe est `""`. Le champ
 * existe quand même, pour que le jour où le portail passe sous un préfixe, le
 * menu suive sans réécriture.
 */
export const CHEMINS_ASSOCIATION = [
	"/",
	"/chroniques",
	"/news",
	"/evenements",
	"/shop",
	"/community",
	"/sondages",
	"/iergday",
	"/rose-griffon-tv",
	"/notre-equipe",
	"/projets",
	"/a-propos",
	"/nous-soutenir",
	"/charte-engagements",
	"/cellule-de-mediation",
	"/emotes-showcase",
	"/epita-map",
] as const;

export type CheminWiki = (typeof CHEMINS_WIKI)[number];
export type CheminRacine = (typeof CHEMINS_RACINE)[number];
export type CheminEsport = (typeof CHEMINS_ESPORT)[number];
export type CheminAssociation = (typeof CHEMINS_ASSOCIATION)[number];

/**
 * Compose un chemin d'un domaine avec son préfixe.
 *
 * Généralise `joindreWiki` aux trois domaines. Même piège : une base vide doit
 * rendre `/` et non `""`, qui n'est pas une URL valide pour `next/link`.
 */
export function joindreDomaine(base: string | undefined, chemin: string): string {
	return joindreWiki(base ?? "", chemin);
}

/**
 * Le chemin est-il dans l'espace d'administration ?
 *
 * Website est l'unique application et monte l'administration sous `/admin`.
 */
export function estSousAdministration(pathname: string): boolean {
	const base = WEBSITE_BASES.admin;
	return pathname === base || pathname.startsWith(`${base}/`);
}

/**
 * Retourne les bases de l'unique application Website.
 */
export function basesDepuisChemin(pathname: string): NavBases {
	void pathname;
	return WEBSITE_BASES;
}
