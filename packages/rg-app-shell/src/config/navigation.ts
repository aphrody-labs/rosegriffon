import { CHEMINS_WIKI, joindreWiki, type NavBases } from "./routes";

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
