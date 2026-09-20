import { BASE_ESPORT, BASE_WIKI, CHEMINS_ESPORT, CHEMINS_WIKI, esport, wiki } from "./routes";

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
	return [
		...new Set(
			parcourirNav(items)
				.filter((i) => !i.groupOnly)
				.map((i) => i.path)
		),
	];
}

/**
 * Navigation principale (barre latérale + rail), préfixée pour l'app hôte.
 *
 * `w()` préfixe les routes du wiki ; les routes de service (`/news`,
 * `/settings`) restent à la racine dans les deux apps et ne doivent JAMAIS être
 * préfixées — `/wiki/news` et `/wiki/settings` n'existent pas côté website.
 */
export function construireNavigationItems(): NavItem[] {
	const w = wiki;

	return [
		{ icon: "home", label: "nav.home", path: w("/") },
		{ icon: "sports_soccer", label: "nav.cross", path: w("/cross") },
		// Les articles vivent dans la catégorie « Actualité » : les répéter ici
		// donnait deux accordéons pour une même destination. Seules les notes de
		// version restent, elles décrivent le jeu et non la vie du site.
		{ icon: "update", label: "nav.news.patch_notes", path: w("/patch-notes") },
		// — Base de données (wiki curé) —
		{ commonSprite: "chara", icon: "groups", label: "nav.wiki.players", path: w("/chara") },
		{
			// Techniques, tactiques, passifs (capacités hors hyper).
			children: [
				{
					label: "nav.wiki.skills",
					path: w("/skill"),
					icon: "sports_martial_arts",
					commonSprite: "skill",
				},
				{ label: "nav.wiki.tactics", path: w("/tactic"), icon: "strategy" },
				{
					label: "nav.wiki.passives",
					path: w("/passive"),
					icon: "auto_awesome",
					commonSprite: "tension",
				},
			],
			icon: "sports_martial_arts",
			label: "nav.section.abilities",
			path: w("/skill"),
		},
		{
			// Hyper-techniques (5 familles d'auras).
			children: [
				{
					label: "nav.wiki.auras.keshin",
					path: w("/aura/esprits-guerriers"),
					icon: "swords",
					commonSprite: "keshin",
				},
				{
					label: "nav.wiki.auras.soul",
					path: w("/aura/totems"),
					icon: "pets",
					commonSprite: "soul",
				},
				{
					label: "nav.wiki.auras.miximax",
					path: w("/aura/miximax"),
					icon: "group_add",
					commonSprite: "miximax",
				},
				{
					label: "nav.wiki.auras.awakening",
					path: w("/aura/eveil"),
					icon: "wb_twilight",
					commonSprite: "eveil",
				},
				{
					label: "nav.wiki.auras.mode",
					path: w("/aura/changement-mode"),
					icon: "change_circle",
					commonSprite: "mode_change",
				},
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
				{
					label: "nav.wiki.invocation",
					path: w("/invocation"),
					icon: "stars",
					gameIcon: "star-token",
				},
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
			// Médias : illustrations curées, corpus complet des textures, banques
			// sonores, cinématiques, et modèles 3D (esprits/armures + objets/animaux).
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
 * Navigation mobile unifiée à 5 onglets pour les apps multi-domaines (website).
 *
 * 1. Accueil (Association)
 * 2. Wiki (Encyclopédie Azalée)
 * 3. E-Sport (Achilléa)
 * 4. Recherche (Global federated search)
 * 5. Paramètres / Compte
 */
export function construireMobileNavUnifiee(): NavItem[] {
	// Les chemins NON préfixés restent dans `activePaths` : `rosegriffon.fr`
	// sert encore les anciennes URL d'azalee.rosegriffon.fr par redirection
	// permanente, et l'onglet doit rester allumé le temps qu'elle se résolve.
	const cheminsWikiActifs = [
		...CHEMINS_WIKI.filter((c) => c !== "/").map(wiki),
		...CHEMINS_WIKI.filter((c) => c !== "/"),
		BASE_WIKI,
	];

	const cheminsEsportActifs = CHEMINS_ESPORT.map(esport);

	return [
		{
			activePaths: ["/"],
			icon: "home",
			label: "nav.home",
			path: "/",
		},
		{
			activePaths: [...new Set(cheminsWikiActifs)],
			icon: "menu_book",
			label: "nav.wiki",
			path: BASE_WIKI,
		},
		{
			activePaths: [...new Set(cheminsEsportActifs)],
			icon: "sports_esports",
			label: "nav.domaine.esport",
			path: BASE_ESPORT,
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

/**
 * Les trois domaines du réseau — unité de THÈME, pas de menu.
 *
 * Le menu compte quatre catégories (cf. `GROUPES_NAV`) : « Actualité » est un
 * regroupement éditorial, pas un univers visuel, et les articles gardent le
 * thème de l'association.
 */
export const DOMAINES = ["association", "wiki", "esport"] as const;

export type Domaine = (typeof DOMAINES)[number];

/** Les quatre catégories de premier niveau du menu, dans l'ordre d'affichage. */
export const GROUPES_NAV = ["actualite", "association", "wiki", "esport"] as const;

export type GroupeNav = (typeof GROUPES_NAV)[number];

export interface SousCategorieNav {
	/** Catégorie de menu, pour cibler un style ou ouvrir le bon accordéon. */
	domaine: GroupeNav;
	/** Entrée racine repliable, avec ses enfants. */
	item: NavItem;
}

/** Menu de l'e-sport (Achilléa). */
export function construireEsportItems(): NavItem[] {
	const e = esport;

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
				{
					icon: "leaderboard",
					label: "nav.esport.ranked.leaderboard",
					path: e("/ranked/leaderboard"),
				},
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
				{
					icon: "add_circle",
					label: "nav.esport.tournaments.create",
					path: e("/tournaments/create"),
				},
				{
					icon: "trending_up",
					label: "nav.esport.tournaments.circuit",
					path: e("/tournaments/circuit/ranking"),
				},
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

/**
 * Menu « Actualité ».
 *
 * Quatrième catégorie de premier niveau, extraite de l'association : les
 * articles, les chroniques, les événements et la webTV sont ce qu'on vient
 * consulter RÉGULIÈREMENT, alors que la présentation de l'association se lit
 * une fois. Les mélanger enfouissait le flux éditorial sous un accordéon
 * institutionnel.
 */
export function construireActualiteItems(): NavItem[] {
	return [
		{ icon: "feed", label: "nav.association.news", path: "/news" },
		{ icon: "auto_stories", label: "nav.association.chronicles", path: "/chroniques" },
		{ icon: "event", label: "nav.association.events", path: "/evenements" },
		{
			// L'image officielle de la webTV, pas un pictogramme générique : elle
			// est livrée dans `public/rgtv/rgtv.webp` et porte l'identité de la
			// chaîne. `imageUrl` a la priorité sur `icon` dans la barre latérale.
			icon: "live_tv",
			imageUrl: "/rgtv/rgtv.webp",
			label: "nav.association.rgtv",
			path: "/rose-griffon-tv",
		},
	];
}

/**
 * Menu de l'association.
 *
 * « Vie de la communauté » et « L'association » n'en font plus qu'UNE. Deux
 * accordéons pour six destinations, c'est deux clics pour arriver à la page des
 * membres là où un seul suffit — et la distinction entre « la communauté » et
 * « l'association » n'existe que dans l'organigramme, pas pour le visiteur.
 */
export function construireAssociationItems(): NavItem[] {
	return [
		{ icon: "home", label: "nav.association.home", path: "/" },
		{ icon: "diversity_3", label: "nav.association.about_us", path: "/a-propos" },
		{ icon: "forum", label: "nav.association.community", path: "/community" },
		{ icon: "how_to_vote", label: "nav.association.polls", path: "/sondages" },
		{ icon: "celebration", label: "nav.association.iergday", path: "/iergday" },
		{ icon: "rocket_launch", label: "nav.association.projects", path: "/projets" },
		{ icon: "volunteer_activism", label: "nav.association.support", path: "/nous-soutenir" },
	];
}

/**
 * Menu complet, groupé en QUATRE catégories : actualité, association, wiki,
 * e-sport.
 *
 * `groupOnly` sur l'entête : le groupe n'est pas une destination, seulement un
 * déclencheur de repli — sans ce drapeau la barre latérale en ferait un lien
 * vers une page qui n'existe pas.
 */
export function construireNavigationUnifiee(): SousCategorieNav[] {
	const groupes: { domaine: GroupeNav; enfants: NavItem[]; icon: string; label: string }[] = [
		{
			domaine: "actualite",
			enfants: construireActualiteItems(),
			icon: "newspaper",
			label: "nav.domaine.actualite",
		},
		{
			domaine: "association",
			enfants: construireAssociationItems(),
			icon: "diversity_3",
			label: "nav.domaine.association",
		},
		{
			domaine: "wiki",
			enfants: construireNavigationItems(),
			icon: "menu_book",
			label: "nav.domaine.wiki",
		},
		{
			domaine: "esport",
			enfants: construireEsportItems(),
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
export function domaineDeLaRoute(pathname: string): Domaine {
	if (estRouteActive(pathname, BASE_ESPORT)) return "esport";
	if (estRouteActive(pathname, BASE_WIKI)) return "wiki";
	if (pathname === "/news" || pathname.startsWith("/news/")) return "wiki";
	return "association";
}

/**
 * Arbre rendu par les TROIS surfaces de navigation (barre latérale, rail,
 * barre du bas).
 *
 * Ce bloc de résolution était recopié à l'identique dans les trois composants,
 * avec chacun sa branche `bases.esport !== undefined` et son repli vers
 * `construireDashboardItems` — lequel n'était jamais rendu, l'administration
 * ayant sa propre barre latérale (`AdminSidebar`). Une seule fonction, donc.
 */
export function itemsDeNavigation(): NavItem[] {
	return construireNavigationUnifiee().map((groupe) => groupe.item);
}
