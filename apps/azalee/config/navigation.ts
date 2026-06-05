export interface NavItem {
	label: string;
	path: string;
	imageUrl?: string;
	commonSprite?: string;
	icon: string;
	adminOnly?: boolean;
	defaultOpen?: boolean;
	children?: NavItem[];
	/** Additional path prefixes that mark this item as active (for mobile nav) */
	activePaths?: string[];
}

export const navigationItems: NavItem[] = [
	{
		icon: "home",
		label: "nav.home",
		path: "/",
	},
	{
		icon: "sports_soccer",
		label: "nav.cross",
		path: "/cross",
	},
	{
		children: [
			{ label: "nav.news.articles", path: "/news", icon: "feed" },
			{ label: "nav.news.patch_notes", path: "/patch-notes", icon: "update" },
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
		path: "/chara",
	},
	{
		// Techniques, tactiques, passifs (capacités hors hyper).
		children: [
			{ label: "nav.wiki.skills", path: "/skill", icon: "sports_martial_arts", commonSprite: "skill" },
			{ label: "nav.wiki.tactics", path: "/tactic", icon: "strategy" },
			{ label: "nav.wiki.passives", path: "/passive", icon: "auto_awesome", commonSprite: "tension" },
		],
		icon: "sports_martial_arts",
		label: "nav.section.abilities",
		path: "/skill",
	},
	{
		// Hyper-techniques (5 familles d'auras).
		children: [
			{
				label: "nav.wiki.auras.keshin",
				path: "/aura/esprits-guerriers",
				icon: "swords",
				commonSprite: "keshin",
			},
			{
				label: "nav.wiki.auras.soul",
				path: "/aura/totems",
				icon: "pets",
				commonSprite: "soul",
			},
			{
				label: "nav.wiki.auras.miximax",
				path: "/aura/miximax",
				icon: "group_add",
				commonSprite: "miximax",
			},
			{
				label: "nav.wiki.auras.awakening",
				path: "/aura/eveil",
				icon: "wb_twilight",
				commonSprite: "eveil",
			},
			{
				label: "nav.wiki.auras.mode",
				path: "/aura/changement-mode",
				icon: "change_circle",
				commonSprite: "mode_change",
			},
		],
		icon: "auto_awesome",
		label: "nav.wiki.hyper_skills",
		path: "/aura",
	},
	{
		// Équipes, entraîneurs, stades.
		children: [
			{ label: "nav.wiki.teams", path: "/equipe", icon: "shield" },
			{ label: "nav.wiki.coaches", path: "/entraineur", icon: "sports" },
			{ label: "nav.wiki.stadiums", path: "/stade", icon: "stadium" },
		],
		icon: "shield",
		label: "nav.section.clubs",
		path: "/equipe",
	},
	{
		// Objets & moyens d'obtention (boutiques, capsules, drops).
		children: [
			{ label: "nav.wiki.items", path: "/item", icon: "backpack" },
			{ label: "nav.wiki.shops", path: "/boutique", icon: "storefront" },
			{ label: "nav.wiki.capsules", path: "/capsule", icon: "casino" },
			{ label: "nav.wiki.drops", path: "/drops", icon: "redeem" },
		],
		icon: "backpack",
		label: "nav.section.items",
		path: "/item",
	},
	{
		icon: "task_alt",
		label: "nav.wiki.quests",
		path: "/quete",
	},
	{
		// Médias : galerie d'illustrations + modèles 3D.
		children: [
			{ label: "nav.wiki.gallery", path: "/gallery", icon: "image" },
			{ label: "nav.wiki.keshin_models", path: "/keshin", icon: "view_in_ar" },
		],
		icon: "perm_media",
		label: "nav.section.media",
		path: "/gallery",
	},
	{
		// Explorer le jeu : données brutes des CPK + écrans de menu reconstruits.
		children: [
			{ label: "nav.wiki.cpk_browser", path: "/cpk", icon: "account_tree" },
			{ label: "nav.wiki.game_menus", path: "/menu/100_mainmenu", icon: "grid_view" },
		],
		icon: "travel_explore",
		label: "nav.section.explore",
		path: "/cpk",
	},
	{
		children: [
			{
				label: "nav.tools.compare",
				path: "/tools/compare",
				icon: "compare_arrows",
			},
			{
				label: "nav.tools.random_team",
				path: "/tools/random-team",
				icon: "casino",
			},
			{ label: "nav.tools.my_team", path: "/tools/my-team", icon: "stadium" },
			{
				label: "nav.tools.translator",
				path: "/tools/translator",
				icon: "translate",
			},
			{
				label: "nav.tools.save_reader",
				path: "/save",
				icon: "save",
			},
		],
		icon: "build",
		label: "nav.tools",
		path: "/tools",
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
			"/chara",
			"/skill",
			"/item",
			"/boutique",
			"/capsule",
			"/equipe",
			"/aura",
			"/passive",
			"/tactic",
			"/gallery",
			"/quete",
			"/entraineur",
			"/stade",
			"/drops",
			"/keshin",
			"/menu",
			"/cpk",
			"/wiki",
			"/search",
		],
		icon: "search",
		label: "nav.wiki",
		path: "/search",
	},
	{
		activePaths: ["/news", "/patch-notes"],
		icon: "newspaper",
		label: "nav.news",
		path: "/news",
	},
	{
		activePaths: ["/tools"],
		icon: "build",
		label: "nav.tools",
		path: "/tools",
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
		path: "/dashboard",
	},
	{
		adminOnly: true,
		children: [
			{
				label: "nav.dashboard.content.news",
				path: "/dashboard/news",
				icon: "newspaper",
			},
			{
				label: "nav.dashboard.content.database",
				path: "/dashboard/database",
				icon: "database",
			},
			{
				label: "nav.dashboard.content.verification",
				path: "/dashboard/database/verification",
				icon: "verified",
			},
		],
		icon: "edit_note",
		label: "nav.dashboard.content",
		path: "/dashboard/content",
	},
	{
		adminOnly: true,
		children: [
			{
				label: "nav.dashboard.social.tweets",
				path: "/dashboard/tweets",
				icon: "tag",
			},
		],
		icon: "share",
		label: "nav.dashboard.social",
		path: "/dashboard/social",
	},
	{
		adminOnly: true,
		children: [
			{
				label: "nav.dashboard.tools.import_doc",
				path: "/dashboard/import-google-doc",
				icon: "description",
			},
			{
				label: "nav.dashboard.tools.import_sheet",
				path: "/dashboard/import-sheet",
				icon: "table_chart",
			},
		],
		icon: "build",
		label: "nav.dashboard.tools",
		path: "/dashboard/tools",
	},
	{
		adminOnly: true,
		children: [
			{
				label: "nav.dashboard.security.audit",
				path: "/dashboard/audit",
				icon: "policy",
			},
		],
		icon: "shield",
		label: "nav.dashboard.security",
		path: "/dashboard/security",
	},
	{
		adminOnly: true,
		icon: "group",
		label: "nav.dashboard.users",
		path: "/dashboard/users",
	},
	{
		adminOnly: true,
		icon: "settings",
		label: "nav.dashboard.settings",
		path: "/dashboard/settings",
	},
];
