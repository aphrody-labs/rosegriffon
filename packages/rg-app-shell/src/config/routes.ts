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

/** Emplacements où l'app monte ses trois domaines et l'administration. */
export interface NavBases {
	/** Préfixe du wiki : `""` (azalee, à la racine) ou `"/wiki"` (website). */
	wiki: string;
	/** Racine de l'administration : `"/dashboard"` (azalee) ou `"/admin"` (website). */
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
}

export const AZALEE_BASES: NavBases = { admin: "/dashboard", wiki: "" };
export const WEBSITE_BASES: NavBases = {
	admin: "/admin",
	association: "",
	esport: "/achillea",
	wiki: "/wiki",
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
 * Les deux apps l'enracinent différemment (`/dashboard` côté azalee, `/admin`
 * côté website) et le chrome partagé doit le reconnaître dans les deux cas :
 * la barre latérale du wiki bascule sur le menu d'administration ici, et une
 * version qui ne testait qu'une seule racine laissait l'autre app afficher le
 * menu public par-dessus la barre d'administration.
 */
export function estSousAdministration(pathname: string): boolean {
	return [AZALEE_BASES.admin, WEBSITE_BASES.admin].some(
		(base) => pathname === base || pathname.startsWith(`${base}/`)
	);
}

/**
 * Déduit les bases de navigation du chemin courant.
 *
 * LE BUG QUE ÇA CORRIGE
 * Les trois composants de chrome — barre latérale, rail, barre du bas —
 * répétaient à l'identique `pathname.startsWith("/wiki") || startsWith("/admin")`
 * pour décider s'ils étaient dans `website` ou dans `azalee`. Trois copies d'une
 * heuristique qui ne connaissait que deux préfixes : depuis la fusion des trois
 * sites, une route `/achillea/**` ne correspond à aucun des deux et retombait
 * donc silencieusement sur `AZALEE_BASES` — c'est-à-dire un wiki monté à la
 * racine. La barre latérale affichait alors des liens `/chara`, `/skill`,
 * `/equipe` qui n'existent pas sur `rosegriffon.fr` : des 404 servis par le
 * menu lui-même, et seulement sur l'e-sport.
 *
 * La décision vit désormais ici, en un seul endroit, et couvre les trois
 * domaines. `azalee` reste le cas par défaut parce que c'est la seule app qui
 * sert le wiki à la racine : tout chemin non préfixé y est légitime.
 */
export function basesDepuisChemin(pathname: string): NavBases {
	const prefixesWebsite = [
		WEBSITE_BASES.wiki,
		WEBSITE_BASES.admin,
		WEBSITE_BASES.esport ?? "",
	].filter(Boolean);

	const estWebsite = prefixesWebsite.some(
		(prefixe) => pathname === prefixe || pathname.startsWith(`${prefixe}/`)
	);

	return estWebsite ? WEBSITE_BASES : AZALEE_BASES;
}
