export interface NavItem {
	label: string;
	path: string;
	imageUrl?: string;
	commonSprite?: string;
	/** Cle d'une VRAIE icone de menu du jeu (cf. config/game-icons.ts). */
	gameIcon?: string;
	icon: string;
	adminOnly?: boolean;
	defaultOpen?: boolean;
	children?: NavItem[];
	/**
	 * Entête de groupe : l'item n'est PAS une destination, seulement un
	 * déclencheur de repli. Les quatre groupes du dashboard (`content`,
	 * `social`, `tools`, `security`) n'ont aucune route derrière eux — sans ce
	 * drapeau, `app-sidebar.tsx` en faisait des liens qui tombaient en 404.
	 */
	groupOnly?: boolean;
	/** Additional path prefixes that mark this item as active (for mobile nav) */
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
	if (path === "/") return pathname === "/";
	return pathname === path || pathname.startsWith(`${path}/`);
}

/**
 * Une entrée de menu est active quand on est sur sa route, sur une de ses routes
 * annexes (`activePaths`), ou sur la route d'un de ses enfants — un parent replié
 * doit se signaler quand la page courante est dans sa section.
 */
export function estItemActif(pathname: string, item: NavItem): boolean {
	if (item.activePaths?.some((p) => estRouteActive(pathname, p))) return true;
	if (!item.groupOnly && estRouteActive(pathname, item.path)) return true;
	return Boolean(item.children?.some((enfant) => estItemActif(pathname, enfant)));
}

export const navigationItems: NavItem[] = [
	{
		icon: "home",
		label: "nav.home",
		path: "/wiki",
	},
	{
		icon: "sports_soccer",
		label: "nav.cross",
		path: "/wiki/cross",
	},
	{
		children: [
			{ label: "nav.news.articles", path: "/news", icon: "feed" },
			{ label: "nav.news.patch_notes", path: "/wiki/patch-notes", icon: "update" },
		],
		icon: "newspaper",
		label: "nav.news",
		path: "/news",
	},
	// — Base de données (wiki curé) —
	{
		commonSprite: "chara",
		icon: "groups",
		label: "nav.wiki.players",
		path: "/wiki/chara",
	},
	{
		// Techniques, tactiques, passifs (capacités hors hyper).
		children: [
			{ label: "nav.wiki.skills", path: "/wiki/skill", icon: "sports_martial_arts", commonSprite: "skill" },
			{ label: "nav.wiki.tactics", path: "/wiki/tactic", icon: "strategy" },
			{ label: "nav.wiki.passives", path: "/wiki/passive", icon: "auto_awesome", commonSprite: "tension" },
		],
		icon: "sports_martial_arts",
		label: "nav.section.abilities",
		path: "/wiki/skill",
	},
	{
		// Hyper-techniques (5 familles d'auras).
		children: [
			{
				label: "nav.wiki.auras.keshin",
				path: "/wiki/aura/esprits-guerriers",
				icon: "swords",
				commonSprite: "keshin",
			},
			{
				label: "nav.wiki.auras.soul",
				path: "/wiki/aura/totems",
				icon: "pets",
				commonSprite: "soul",
			},
			{
				label: "nav.wiki.auras.miximax",
				path: "/wiki/aura/miximax",
				icon: "group_add",
				commonSprite: "miximax",
			},
			{
				label: "nav.wiki.auras.awakening",
				path: "/wiki/aura/eveil",
				icon: "wb_twilight",
				commonSprite: "eveil",
			},
			{
				label: "nav.wiki.auras.mode",
				path: "/wiki/aura/changement-mode",
				icon: "change_circle",
				commonSprite: "mode_change",
			},
		],
		icon: "auto_awesome",
		label: "nav.wiki.hyper_skills",
		path: "/wiki/aura",
	},
	{
		// Équipes, entraîneurs, stades.
		children: [
			{ label: "nav.wiki.teams", path: "/wiki/equipe", icon: "shield", gameIcon: "emblem" },
			{ label: "nav.wiki.coaches", path: "/wiki/entraineur", icon: "sports", gameIcon: "medal" },
			{ label: "nav.wiki.stadiums", path: "/wiki/stade", icon: "stadium", gameIcon: "stadium" },
		],
		gameIcon: "emblem",
		icon: "shield",
		label: "nav.section.clubs",
		path: "/wiki/equipe",
	},
	{
		// Objets & moyens d'obtention (boutiques, capsules, drops).
		children: [
			{ label: "nav.wiki.items", path: "/wiki/item", icon: "backpack", gameIcon: "chest" },
			{ label: "nav.wiki.shops", path: "/wiki/boutique", icon: "storefront", gameIcon: "moneybag" },
			{ label: "nav.wiki.capsules", path: "/wiki/capsule", icon: "casino", gameIcon: "ticket" },
			{ label: "nav.wiki.invocation", path: "/wiki/invocation", icon: "stars", gameIcon: "star-token" },
			{ label: "nav.wiki.drops", path: "/wiki/drops", icon: "redeem" },
		],
		gameIcon: "chest",
		icon: "backpack",
		label: "nav.section.items",
		path: "/wiki/item",
	},
	{
		icon: "task_alt",
		label: "nav.wiki.quests",
		path: "/wiki/quete",
	},
	{
		// Table d'expérience du jeu (`inagle_exp_table`) : courbe + calculateurs.
		icon: "trending_up",
		label: "nav.wiki.levels",
		path: "/wiki/niveau",
	},
	{
		icon: "emoji_events",
		label: "nav.wiki.trophies",
		path: "/wiki/succes",
	},
	{
		// Médias : illustrations curées, corpus complet des textures, banques sonores,
		// cinématiques, et modèles 3D (esprits/armures + objets/animaux).
		children: [
			{ label: "nav.wiki.gallery", path: "/wiki/gallery", icon: "image" },
			{ label: "nav.wiki.textures", path: "/wiki/textures", icon: "texture" },
			{ label: "nav.wiki.sounds", path: "/wiki/sons", icon: "graphic_eq" },
			{ label: "nav.wiki.videos", path: "/wiki/videos", icon: "movie" },
			// `/keshin` a fusionné dans `/modeles` : une seule page couvre les 6 236 modèles du
			// jeu (personnages, techniques, objets, esprits, armures, animaux). L'ancienne URL
			// redirige, mais elle n'a plus à figurer au menu à côté de celle qui la contient.
			{ label: "nav.wiki.models", path: "/wiki/modeles", icon: "deployed_code" },
			// `/mode` figurait dans la sous-navigation média (`MediaShell`) mais nulle part
			// dans le menu : la sixième collection n'était atteignable qu'en passant par une
			// des cinq autres.
			{ label: "nav.wiki.modes", path: "/wiki/mode", icon: "stadia_controller" },
		],
		icon: "perm_media",
		label: "nav.section.media",
		path: "/wiki/gallery",
	},
	{
		children: [
			{
				label: "nav.tools.stats",
				path: "/wiki/tools/stats",
				icon: "calculate",
			},
			{
				label: "nav.tools.compare",
				path: "/wiki/tools/compare",
				icon: "compare_arrows",
			},
			{
				label: "nav.tools.random_team",
				path: "/wiki/tools/random-team",
				icon: "casino",
			},
			{ label: "nav.tools.my_team", path: "/wiki/tools/my-team", icon: "stadium" },
			{
				label: "nav.tools.translator",
				path: "/wiki/tools/translator",
				icon: "translate",
			},
			{
				label: "nav.tools.save_reader",
				path: "/wiki/save",
				icon: "save",
			},
			{ label: "nav.tools.demo", path: "/wiki/demo", icon: "view_in_ar" },
		],
		icon: "build",
		label: "nav.tools",
		path: "/wiki/tools",
	},
	{
		icon: "settings",
		label: "nav.settings",
		path: "/settings",
	},
];

export const mobileNavItems: NavItem[] = [
	{ icon: "home", label: "nav.home", path: "/" },
	{
		activePaths: [
			"/wiki/chara",
			"/wiki/skill",
			"/wiki/item",
			"/wiki/boutique",
			"/wiki/capsule",
			"/wiki/invocation",
			"/wiki/equipe",
			"/wiki/aura",
			"/wiki/passive",
			"/wiki/tactic",
			"/wiki/gallery",
			"/wiki/quete",
			"/wiki/succes",
			"/wiki/entraineur",
			"/wiki/stade",
			"/wiki/drops",
			"/wiki/niveau",
			"/wiki/keshin",
			"/wiki/modeles",
			"/wiki/mode",
			"/wiki/textures",
			"/wiki/sons",
			"/wiki/videos",
			"/wiki",
			"/search",
			"/chara",
			"/skill",
			"/item",
			"/boutique",
			"/capsule",
			"/invocation",
			"/equipe",
			"/aura",
			"/passive",
			"/tactic",
			"/gallery",
			"/quete",
			"/succes",
			"/entraineur",
			"/stade",
			"/drops",
			"/niveau",
			"/keshin",
			"/modeles",
			"/mode",
			"/textures",
			"/sons",
			"/videos",
		],
		icon: "search",
		label: "nav.wiki",
		path: "/search",
	},
	{
		activePaths: ["/news", "/chroniques", "/wiki/patch-notes", "/patch-notes"],
		icon: "newspaper",
		label: "nav.news",
		path: "/news",
	},
	{
		activePaths: ["/wiki/tools", "/tools", "/wiki/demo", "/demo", "/wiki/save", "/save"],
		icon: "build",
		label: "nav.tools",
		path: "/wiki/tools",
	},
	{
		activePaths: ["/settings"],
		icon: "settings",
		label: "nav.settings",
		path: "/settings",
	},
];

export const dashboardItems: NavItem[] = [
	{
		adminOnly: true,
		icon: "dashboard",
		label: "nav.dashboard.overview",
		path: "/admin",
	},
	{
		adminOnly: true,
		children: [
			{
				label: "nav.dashboard.content.news",
				path: "/admin/news",
				icon: "newspaper",
			},
			{
				label: "nav.dashboard.content.database",
				path: "/admin/database",
				icon: "database",
			},
			{
				label: "nav.dashboard.content.verification",
				path: "/admin/database/verification",
				icon: "verified",
			},
		],
		icon: "edit_note",
		groupOnly: true,
		label: "nav.dashboard.content",
		path: "/admin/content",
	},
	{
		adminOnly: true,
		children: [
			{
				label: "nav.dashboard.social.tweets",
				path: "/admin/tweets",
				icon: "tag",
			},
		],
		icon: "share",
		groupOnly: true,
		label: "nav.dashboard.social",
		path: "/admin/social",
	},
	{
		adminOnly: true,
		children: [
			{
				label: "nav.dashboard.tools.import_doc",
				path: "/admin/import-google-doc",
				icon: "description",
			},
			{
				label: "nav.dashboard.tools.import_sheet",
				path: "/admin/import-sheet",
				icon: "table_chart",
			},
		],
		icon: "build",
		groupOnly: true,
		label: "nav.dashboard.tools",
		path: "/admin/tools",
	},
	{
		adminOnly: true,
		children: [
			{
				label: "nav.dashboard.security.audit",
				path: "/admin/audit",
				icon: "policy",
			},
		],
		icon: "shield",
		groupOnly: true,
		label: "nav.dashboard.security",
		path: "/admin/security",
	},
	{
		adminOnly: true,
		icon: "group",
		label: "nav.dashboard.users",
		path: "/admin/users",
	},
	{
		adminOnly: true,
		icon: "settings",
		label: "nav.dashboard.settings",
		path: "/admin/settings",
	},
];
