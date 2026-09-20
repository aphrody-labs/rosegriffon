import {
	CHEMINS_ESPORT,
	CHEMINS_WIKI,
	joindreDomaine,
	joindreWiki,
	type NavBases,
} from "./routes";

export interface NavItem {
	label: string;
	path: string;
	imageUrl?: string;
	commonSprite?: string;
	/** Clé d'une VRAIE icône de menu du jeu (cf. `config/game-icons.ts` des apps). */
	gameIcon?: string;
	icon: string;
	adminOnly?: boolean;
	defaultOpen?: boolean;
	children?: NavItem[];
	/**
	 * Entête de groupe : l'item n'est PAS une destination, seulement un
	 * déclencheur de repli. Les quatre groupes de l'administration (`content`,
	 * `social`, `tools`, `security`) n'ont aucune route derrière eux — sans ce
	 * drapeau, la barre latérale en faisait des liens qui tombaient en 404.
	 */
	groupOnly?: boolean;
	/** Préfixes supplémentaires qui rendent l'item actif (navigation mobile). */
	activePaths?: string[];
}

/**
 * Une route est-elle « sous » une entrée de menu ?
 *
 * Comparaison par SEGMENT, jamais par préfixe de chaîne : `/modeles` commence par
 * `/mode` sans être dedans, et les trois barres de navigation (colonne, rail,
 * barre du bas) testaient `pathname.startsWith(item.path)` — la page des modèles
 * allumait donc aussi l'entrée des modes. Symétriquement, un simple `===`
 * n'allumait rien du tout sur une fiche : `/chara/c05028001` laissait « Joueurs »
 * éteint. Les deux défauts se corrigent au même endroit.
 *
 * La racine est un cas à part : tout chemin lui est subordonné, seule l'égalité
 * la rend active.
 */
export function estRouteActive(pathname: string, path: string): boolean {
	if (path === "/") {
		return pathname === "/";
	}
	return pathname === path || pathname.startsWith(`${path}/`);
}

/**
 * Une entrée de menu est active quand on est sur sa route, sur une de ses routes
 * annexes (`activePaths`), ou sur la route d'un de ses enfants — un parent replié
 * doit se signaler quand la page courante est dans sa section.
 */
export function estItemActif(pathname: string, item: NavItem): boolean {
	if (item.activePaths?.some((p) => estRouteActive(pathname, p))) {
		return true;
	}
	if (!item.groupOnly && estRouteActive(pathname, item.path)) {
		return true;
	}
	return Boolean(item.children?.some((enfant) => estItemActif(pathname, enfant)));
}

/** Parcourt un arbre de navigation en profondeur. */
export function parcourirNav(items: NavItem[]): NavItem[] {
	return items.flatMap((item) => [item, ...parcourirNav(item.children ?? [])]);
}

/**
 * Tous les chemins réellement cliquables d'un arbre : les entêtes de groupe sont
 * exclues puisqu'elles ne pointent nulle part. C'est cette liste que le test de
 * non-régression confronte aux routes présentes sur le disque.
 */
export function cheminsCliquables(items: NavItem[]): string[] {
	return [...new Set(parcourirNav(items).filter((i) => !i.groupOnly).map((i) => i.path))];
}

/**
 * Navigation principale (barre latérale + rail), préfixée pour l'app hôte.
 *
 * `w()` préfixe les routes du wiki ; les routes de service (`/news`,
 * `/settings`) restent à la racine dans les deux apps et ne doivent JAMAIS être
 * préfixées — `/wiki/news` et `/wiki/settings` n'existent pas côté website.
 */
export function construireNavigationItems(bases: NavBases): NavItem[] {
	const w = (chemin: string) => joindreWiki(bases.wiki, chemin);

	return [
		{ icon: "home", label: "nav.home", path: w("/") },
		{ icon: "sports_soccer", label: "nav.cross", path: w("/cross") },
		{
			children: [
				{ label: "nav.news.articles", path: "/news", icon: "feed" },
				{ label: "nav.news.patch_notes", path: w("/patch-notes"), icon: "update" },
			],
			icon: "newspaper",
			label: "nav.news",
			path: "/news",
		},
		// — Base de données (wiki curé) —
		{ commonSprite: "chara", icon: "groups", label: "nav.wiki.players", path: w("/chara") },
		{
			// Techniques, tactiques, passifs (capacités hors hyper).
			children: [
				{ label: "nav.wiki.skills", path: w("/skill"), icon: "sports_martial_arts", commonSprite: "skill" },
				{ label: "nav.wiki.tactics", path: w("/tactic"), icon: "strategy" },
				{ label: "nav.wiki.passives", path: w("/passive"), icon: "auto_awesome", commonSprite: "tension" },
			],
			icon: "sports_martial_arts",
			label: "nav.section.abilities",
			path: w("/skill"),
		},
		{
			// Hyper-techniques (5 familles d'auras).
			children: [
				{ label: "nav.wiki.auras.keshin", path: w("/aura/esprits-guerriers"), icon: "swords", commonSprite: "keshin" },
				{ label: "nav.wiki.auras.soul", path: w("/aura/totems"), icon: "pets", commonSprite: "soul" },
				{ label: "nav.wiki.auras.miximax", path: w("/aura/miximax"), icon: "group_add", commonSprite: "miximax" },
				{ label: "nav.wiki.auras.awakening", path: w("/aura/eveil"), icon: "wb_twilight", commonSprite: "eveil" },
				{ label: "nav.wiki.auras.mode", path: w("/aura/changement-mode"), icon: "change_circle", commonSprite: "mode_change" },
			],
			icon: "auto_awesome",
			label: "nav.wiki.hyper_skills",
			path: w("/aura"),
		},
		{
			// Équipes, entraîneurs, stades.
			children: [
				{ label: "nav.wiki.teams", path: w("/equipe"), icon: "shield", gameIcon: "emblem" },
				{ label: "nav.wiki.coaches", path: w("/entraineur"), icon: "sports", gameIcon: "medal" },
				{ label: "nav.wiki.stadiums", path: w("/stade"), icon: "stadium", gameIcon: "stadium" },
			],
			gameIcon: "emblem",
			icon: "shield",
			label: "nav.section.clubs",
			path: w("/equipe"),
		},
		{
			// Objets & moyens d'obtention (boutiques, capsules, drops).
			children: [
				{ label: "nav.wiki.items", path: w("/item"), icon: "backpack", gameIcon: "chest" },
				{ label: "nav.wiki.shops", path: w("/boutique"), icon: "storefront", gameIcon: "moneybag" },
				{ label: "nav.wiki.capsules", path: w("/capsule"), icon: "casino", gameIcon: "ticket" },
				{ label: "nav.wiki.invocation", path: w("/invocation"), icon: "stars", gameIcon: "star-token" },
				{ label: "nav.wiki.drops", path: w("/drops"), icon: "redeem" },
			],
			gameIcon: "chest",
			icon: "backpack",
			label: "nav.section.items",
			path: w("/item"),
		},
		{ icon: "task_alt", label: "nav.wiki.quests", path: w("/quete") },
		{
			// Table d'expérience du jeu (`inagle_exp_table`) : courbe + calculateurs.
			icon: "trending_up",
			label: "nav.wiki.levels",
			path: w("/niveau"),
		},
		{ icon: "emoji_events", label: "nav.wiki.trophies", path: w("/succes") },
		{
			// Médias : illustrations curées, corpus complet des textures, banques sonores,
			// cinématiques, et modèles 3D (esprits/armures + objets/animaux).
			children: [
				{ label: "nav.wiki.gallery", path: w("/gallery"), icon: "image" },
				{ label: "nav.wiki.textures", path: w("/textures"), icon: "texture" },
				{ label: "nav.wiki.sounds", path: w("/sons"), icon: "graphic_eq" },
				{ label: "nav.wiki.videos", path: w("/videos"), icon: "movie" },
				// `/keshin` a fusionné dans `/modeles` : une seule page couvre les 6 236 modèles du
				// jeu (personnages, techniques, objets, esprits, armures, animaux). L'ancienne URL
				// redirige, mais elle n'a plus à figurer au menu à côté de celle qui la contient.
				{ label: "nav.wiki.models", path: w("/modeles"), icon: "deployed_code" },
				// `/mode` figurait dans la sous-navigation média (`MediaShell`) mais nulle part
				// dans le menu : la sixième collection n'était atteignable qu'en passant par une
				// des cinq autres.
				{ label: "nav.wiki.modes", path: w("/mode"), icon: "stadia_controller" },
			],
			icon: "perm_media",
			label: "nav.section.media",
			path: w("/gallery"),
		},
		{
			children: [
				{ label: "nav.tools.stats", path: w("/tools/stats"), icon: "calculate" },
				{ label: "nav.tools.compare", path: w("/tools/compare"), icon: "compare_arrows" },
				{ label: "nav.tools.random_team", path: w("/tools/random-team"), icon: "casino" },
				{ label: "nav.tools.my_team", path: w("/tools/my-team"), icon: "stadium" },
				{ label: "nav.tools.translator", path: w("/tools/translator"), icon: "translate" },
				{ label: "nav.tools.save_reader", path: w("/save"), icon: "save" },
				{ label: "nav.tools.demo", path: w("/demo"), icon: "view_in_ar" },
			],
			icon: "build",
			label: "nav.tools",
			path: w("/tools"),
		},
		{ icon: "settings", label: "nav.settings", path: "/settings" },
	];
}

/**
 * Barre de navigation basse (compact).
 *
 * `activePaths` liste les routes préfixées ET, quand l'app monte le wiki sous un
 * préfixe, leurs équivalents à la racine : `rosegriffon.fr` sert encore les
 * anciennes URL par redirection permanente, et l'onglet doit rester allumé le
 * temps que la redirection se résolve.
 */
export function construireMobileNavItems(bases: NavBases): NavItem[] {
	const w = (chemin: string) => joindreWiki(bases.wiki, chemin);
	const cheminsWikiActifs = [
		...CHEMINS_WIKI.filter((c) => c !== "/" && !c.startsWith("/tools") && c !== "/demo" && c !== "/save" && c !== "/patch-notes" && c !== "/cross").map(w),
		...(bases.wiki ? CHEMINS_WIKI.filter((c) => c !== "/") : []),
		w("/"),
		"/search",
	];

	return [
		{ icon: "home", label: "nav.home", path: w("/") },
		{
			activePaths: [...new Set(cheminsWikiActifs)],
			icon: "search",
			label: "nav.wiki",
			path: "/search",
		},
		{
			activePaths: ["/news", "/chroniques", w("/patch-notes"), "/patch-notes"],
			icon: "newspaper",
			label: "nav.news",
			path: "/news",
		},
		{
			activePaths: [w("/tools"), "/tools", w("/demo"), "/demo", w("/save"), "/save"],
			icon: "build",
			label: "nav.tools",
			path: w("/tools"),
		},
		{ activePaths: ["/settings"], icon: "settings", label: "nav.settings", path: "/settings" },
	];
}

/**
 * Navigation mobile unifiée à 5 onglets pour les apps multi-domaines (website).
 *
 * 1. Accueil (Association)
 * 2. Wiki (Encyclopédie Azalée)
 * 3. E-Sport (Achilléa)
 * 4. Recherche (Global federated search)
 * 5. Paramètres / Compte
 */
export function construireMobileNavUnifiee(bases: NavBases): NavItem[] {
	const w = (chemin: string) => joindreWiki(bases.wiki, chemin);
	const e = (chemin: string) => joindreDomaine(bases.esport ?? "/achillea", chemin);
	const a = (chemin: string) => joindreDomaine(bases.association ?? "", chemin);

	const cheminsWikiActifs = [
		...CHEMINS_WIKI.filter((c) => c !== "/").map(w),
		...(bases.wiki ? CHEMINS_WIKI.filter((c) => c !== "/") : []),
		w("/"),
	];

	const cheminsEsportActifs = [
		...CHEMINS_ESPORT.map(e),
		...(bases.esport ? CHEMINS_ESPORT.map((c) => `/achillea${c === "/" ? "" : c}`) : []),
	];

	return [
		{
			activePaths: ["/", a("/")],
			icon: "home",
			label: "nav.home",
			path: a("/"),
		},
		{
			activePaths: [...new Set(cheminsWikiActifs)],
			icon: "menu_book",
			label: "nav.wiki",
			path: w("/"),
		},
		{
			activePaths: [...new Set(cheminsEsportActifs)],
			icon: "sports_esports",
			label: "nav.domaine.esport",
			path: e("/"),
		},
		{
			activePaths: ["/search"],
			icon: "search",
			label: "nav.search",
			path: "/search",
		},
		{
			activePaths: ["/settings", "/login", "/profile"],
			icon: "settings",
			label: "nav.settings",
			path: "/settings",
		},
	];
}


/** Navigation de l'espace d'administration, enracinée sur `bases.admin`. */
export function construireDashboardItems(bases: NavBases): NavItem[] {
	const a = (chemin: string) => `${bases.admin}${chemin}`;

	return [
		{ adminOnly: true, icon: "dashboard", label: "nav.dashboard.overview", path: bases.admin },
		{
			adminOnly: true,
			children: [
				{ label: "nav.dashboard.content.news", path: a("/news"), icon: "newspaper" },
				{ label: "nav.dashboard.content.database", path: a("/database"), icon: "database" },
				{ label: "nav.dashboard.content.verification", path: a("/database/verification"), icon: "verified" },
			],
			icon: "edit_note",
			groupOnly: true,
			label: "nav.dashboard.content",
			path: a("/content"),
		},
		{
			adminOnly: true,
			children: [{ label: "nav.dashboard.social.tweets", path: a("/tweets"), icon: "tag" }],
			icon: "share",
			groupOnly: true,
			label: "nav.dashboard.social",
			path: a("/social"),
		},
		{
			adminOnly: true,
			children: [
				{ label: "nav.dashboard.tools.import_doc", path: a("/import-google-doc"), icon: "description" },
				{ label: "nav.dashboard.tools.import_sheet", path: a("/import-sheet"), icon: "table_chart" },
			],
			icon: "build",
			groupOnly: true,
			label: "nav.dashboard.tools",
			path: a("/tools"),
		},
		{
			adminOnly: true,
			children: [{ label: "nav.dashboard.security.audit", path: a("/audit"), icon: "policy" }],
			icon: "shield",
			groupOnly: true,
			label: "nav.dashboard.security",
			path: a("/security"),
		},
		{ adminOnly: true, icon: "group", label: "nav.dashboard.users", path: a("/users") },
		{ adminOnly: true, icon: "settings", label: "nav.dashboard.settings", path: a("/settings") },
	];
}

/** Construit les trois arbres d'un coup. */
export function construireNavigation(bases: NavBases) {
	return {
		dashboardItems: construireDashboardItems(bases),
		mobileNavItems: construireMobileNavItems(bases),
		navigationItems: construireNavigationItems(bases),
	};
}

// ─── NAVIGATION UNIFIÉE — TROIS DOMAINES ─────────────────────────────────────
//
// Depuis la fusion des trois sites sous `rosegriffon.fr`, un seul menu doit
// porter le wiki Azalée, l'e-sport Achilléa et le portail de l'association.
// Les empiler à plat donnerait une cinquantaine d'entrées sans hiérarchie :
// on les groupe donc en trois sous-catégories repliables.
//
// TOUT EST ADDITIF. `construireNavigationItems` et ses sœurs ne changent pas de
// signature ni de résultat : les apps migrent quand elles veulent, et rien ne
// casse entre-temps.

/** Les trois domaines du réseau, dans l'ordre d'affichage du menu. */
export const DOMAINES = ["association", "wiki", "esport"] as const;

export type Domaine = (typeof DOMAINES)[number];

export interface SousCategorieNav {
	/** Domaine, pour cibler un style ou un thème par section. */
	domaine: Domaine;
	/** Entrée racine repliable, avec ses enfants. */
	item: NavItem;
}

/**
 * Menu de l'e-sport (Achilléa).
 *
 * Rend `null` si l'app ne monte pas ce domaine : mieux vaut une sous-catégorie
 * absente qu'une sous-catégorie pleine de liens morts. C'est le cas d'`azalee`,
 * qui ne sert que le wiki.
 */
export function construireEsportItems(bases: NavBases): NavItem[] {
	if (bases.esport === undefined) return [];
	const e = (chemin: string) => joindreDomaine(bases.esport, chemin);

	return [
		{
			// Logo Achilléa officiel (`public/achillea/logo1.svg`).
			icon: "sports_esports",
			imageUrl: "/achillea/logo1.svg",
			label: "nav.esport.home",
			path: e("/"),
		},
		{
			children: [
				{ icon: "groups", label: "nav.esport.clans.list", path: e("/clans") },
				{ icon: "add_circle", label: "nav.esport.clans.create", path: e("/clans/create") },
				{ icon: "shield", label: "nav.esport.clans.dashboard", path: e("/clans/dashboard") },
			],
			icon: "groups",
			label: "nav.esport.clans",
			path: e("/clans"),
		},
		{
			children: [
				{ icon: "swords", label: "nav.esport.ranked.play", path: e("/ranked") },
				{ icon: "leaderboard", label: "nav.esport.ranked.leaderboard", path: e("/ranked/leaderboard") },
				{ icon: "military_tech", label: "nav.esport.ranked.tiers", path: e("/ranked/tiers") },
				{ icon: "history", label: "nav.esport.ranked.history", path: e("/ranked/history") },
			],
			icon: "swords",
			label: "nav.esport.ranked",
			path: e("/ranked"),
		},
		{
			children: [
				{ icon: "emoji_events", label: "nav.esport.tournaments.list", path: e("/tournaments") },
				{ icon: "add_circle", label: "nav.esport.tournaments.create", path: e("/tournaments/create") },
				{ icon: "trending_up", label: "nav.esport.tournaments.circuit", path: e("/tournaments/circuit/ranking") },
			],
			icon: "emoji_events",
			label: "nav.esport.tournaments",
			path: e("/tournaments"),
		},
		{
			// Marque de l'Astral League (`public/achillea/leagues/astral-logo-mark.png`).
			icon: "stadium",
			imageUrl: "/achillea/leagues/astral-logo-mark.png",
			label: "nav.esport.leagues",
			path: e("/leagues/astral"),
		},
		{ icon: "videocam", label: "nav.esport.casts", path: e("/casts") },
		{ icon: "badge", label: "nav.esport.licence", path: e("/licence") },
		{ icon: "account_balance_wallet", label: "nav.esport.wallet", path: e("/wallet") },
		{ icon: "menu_book", label: "nav.esport.guide", path: e("/guide") },
	];
}

/** Menu du portail de l'association. */
export function construireAssociationItems(bases: NavBases): NavItem[] {
	if (bases.association === undefined) return [];
	const a = (chemin: string) => joindreDomaine(bases.association, chemin);

	return [
		{ icon: "home", label: "nav.association.home", path: a("/") },
		{
			children: [
				{ icon: "feed", label: "nav.association.news", path: a("/news") },
				{ icon: "auto_stories", label: "nav.association.chronicles", path: a("/chroniques") },
			],
			icon: "newspaper",
			label: "nav.association.editorial",
			path: a("/chroniques"),
		},
		{ icon: "event", label: "nav.association.events", path: a("/evenements") },
		{
			// L'image officielle de la webTV, pas un pictogramme générique : elle
			// est livrée dans `public/rgtv/rgtv.webp` et porte l'identité de la
			// chaîne. `imageUrl` a la priorité sur `icon` dans la barre latérale.
			icon: "live_tv",
			imageUrl: "/rgtv/rgtv.webp",
			label: "nav.association.rgtv",
			path: a("/rose-griffon-tv"),
		},
		{
			children: [
				{ icon: "forum", label: "nav.association.community", path: a("/community") },
				{ icon: "how_to_vote", label: "nav.association.polls", path: a("/sondages") },
				{ icon: "celebration", label: "nav.association.iergday", path: a("/iergday") },
			],
			icon: "forum",
			label: "nav.association.life",
			path: a("/community"),
		},
		/*
		 * L'association en UNE entrée.
		 *
		 * « À propos », « Notre équipe » et les partenaires décrivaient la même
		 * chose découpée en trois pages, dont deux quasi vides (`notre-equipe`
		 * fait 7 lignes). Trois entrées de menu pour un seul sujet, c'est trois
		 * fois plus de place occupée et un choix à faire là où il n'y a rien à
		 * choisir. `/a-propos` les réunit ; les projets et le soutien restent
		 * distincts, ce sont de vraies destinations.
		 */
		{
			children: [
				{ icon: "rocket_launch", label: "nav.association.projects", path: a("/projets") },
				{ icon: "volunteer_activism", label: "nav.association.support", path: a("/nous-soutenir") },
			],
			icon: "diversity_3",
			label: "nav.association.about_us",
			path: a("/a-propos"),
		},
	];
}

/**
 * Menu complet, groupé en trois sous-catégories.
 *
 * Une sous-catégorie sans enfant est OMISE, pas rendue vide : une app qui ne
 * monte qu'un domaine (azalee) obtient un menu d'un seul groupe, et non trois
 * accordéons dont deux ne s'ouvrent sur rien.
 *
 * `groupOnly` sur l'entête : le groupe n'est pas une destination, seulement un
 * déclencheur de repli — sans ce drapeau la barre latérale en ferait un lien
 * vers une page qui n'existe pas.
 */
export function construireNavigationUnifiee(bases: NavBases): SousCategorieNav[] {
	const groupes: { domaine: Domaine; enfants: NavItem[]; icon: string; label: string }[] = [
		{
			domaine: "association",
			enfants: construireAssociationItems(bases),
			icon: "diversity_3",
			label: "nav.domaine.association",
		},
		{
			domaine: "wiki",
			enfants: construireNavigationItems(bases),
			icon: "menu_book",
			label: "nav.domaine.wiki",
		},
		{
			domaine: "esport",
			enfants: construireEsportItems(bases),
			icon: "sports_esports",
			label: "nav.domaine.esport",
		},
	];

	return groupes
		.filter((groupe) => groupe.enfants.length > 0)
		.map((groupe) => ({
			domaine: groupe.domaine,
			item: {
				children: groupe.enfants,
				defaultOpen: true,
				groupOnly: true,
				icon: groupe.icon,
				label: groupe.label,
				path: `#${groupe.domaine}`,
			},
		}));
}

/**
 * Domaine auquel appartient une route.
 *
 * Sert à ouvrir la bonne sous-catégorie au chargement et à appliquer le thème
 * de section. L'ordre du test compte : l'e-sport et le wiki sont préfixés, donc
 * testés d'abord ; l'association est la racine et récupère tout le reste.
 */
export function domaineDeLaRoute(pathname: string, bases: NavBases): Domaine {
	if (bases.esport && estRouteActive(pathname, bases.esport)) return "esport";
	if (bases.wiki && estRouteActive(pathname, bases.wiki)) return "wiki";
	if (pathname === "/news" || pathname.startsWith("/news/")) return "wiki";
	return "association";
}

// ─── BARRE SUPÉRIEURE ET NAVIGATION MOBILE — PAGES VITALES ───────────────────
//
// PRINCIPE DE RÉPARTITION
// Trois surfaces, trois rôles, et surtout trois BUDGETS d'espace différents :
//
//   - la barre supérieure et la barre du bas sont toujours visibles. Elles
//     coûtent de la place sur CHAQUE page, donc elles ne portent que ce qui
//     doit rester à un geste : les trois domaines et l'actualité ;
//   - la barre latérale est dépliable. Elle peut porter l'arborescence
//     complète, y compris les sous-catégories ;
//   - le pied de page porte ce qui se consulte une fois : mentions légales,
//     boutique, présentation de l'association.
//
// CE QUI SORT DE LA NAVIGATION
// `/shop` et `/a-propos` quittent le menu. Ce ne sont pas des destinations de
// parcours : on arrive sur la boutique depuis une campagne ou le pied de page,
// et sur la présentation de l'association une fois, au premier passage. Les
// laisser dans une barre toujours visible coûtait deux emplacements sur cinq
// pour des pages consultées marginalement.

/** Au plus cinq entrées : au-delà, les cibles tactiles passent sous 48 px. */
const MAX_ONGLETS_MOBILE = 5;

/**
 * Entrées de la barre supérieure : les trois domaines, plus l'actualité.
 *
 * On n'y met JAMAIS de sous-niveau. Un menu déroulant dans une barre
 * permanente rend la cible instable au survol et ne survit pas au tactile ;
 * c'est le rôle de la barre latérale.
 */
export function construireItemsBarreSuperieure(bases: NavBases): NavItem[] {
	const items: NavItem[] = [
		{ icon: "home", label: "nav.association.home", path: joindreDomaine(bases.association, "/") },
	];

	if (bases.wiki !== undefined) {
		items.push({
			activePaths: [joindreWiki(bases.wiki, "/")],
			icon: "menu_book",
			label: "nav.domaine.wiki",
			path: joindreWiki(bases.wiki, "/"),
		});
	}

	if (bases.esport !== undefined) {
		items.push({
			activePaths: [bases.esport],
			icon: "sports_esports",
			label: "nav.domaine.esport",
			path: joindreDomaine(bases.esport, "/"),
		});
	}

	items.push({
		activePaths: ["/news", "/chroniques"],
		icon: "newspaper",
		label: "nav.association.editorial",
		path: "/news",
	});

	return items;
}

/**
 * Onglets de la barre du bas, sur mobile.
 *
 * Mêmes destinations que la barre supérieure, plus le compte : sur mobile la
 * barre supérieure se réduit au titre et au menu, c'est donc la barre du bas
 * qui porte la navigation. Garder les deux surfaces cohérentes évite qu'une
 * entrée n'existe que dans une orientation d'écran.
 */
export function construireOngletsMobile(bases: NavBases): NavItem[] {
	const vitaux = construireItemsBarreSuperieure(bases);
	const compte: NavItem = {
		activePaths: ["/settings", "/profil"],
		icon: "account_circle",
		label: "nav.account",
		path: "/settings",
	};

	// Le compte est le dernier onglet, toujours. S'il fallait couper, ce serait
	// dans les domaines — jamais dans l'accès au compte, qui n'a pas d'autre
	// point d'entrée sur mobile.
	return [...vitaux.slice(0, MAX_ONGLETS_MOBILE - 1), compte];
}
