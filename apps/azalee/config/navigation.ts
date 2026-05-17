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
		label: "nav.home",
		path: "/",
		icon: "home",
	},
	{
		label: "nav.news",
		path: "/news",
		icon: "newspaper",
		children: [
			{ label: "nav.news.articles", path: "/news", icon: "feed" },
			{ label: "nav.news.patch_notes", path: "/patch-notes", icon: "update" },
		],
	},
	{
		label: "nav.wiki.players",
		path: "/chara",
		icon: "groups",
		commonSprite: "chara",
	},
	{
		label: "nav.wiki.skills",
		path: "/skill",
		icon: "",
		commonSprite: "skill",
	},
	{
		label: "nav.wiki.hyper_skills",
		path: "/aura",
		icon: "",
		defaultOpen: true,
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
	},
	{
		label: "nav.wiki.items",
		path: "/item",
		icon: "backpack",
	},
	{
		label: "nav.wiki.tactics",
		path: "/tactic",
		icon: "strategy",
	},
	{
		label: "nav.wiki.passives",
		path: "/passive",
		icon: "auto_awesome",
		commonSprite: "tension",
	},
	{
		label: "nav.tools",
		path: "/tools",
		icon: "build",
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
		],
	},
	{
		label: "nav.settings",
		path: "/settings",
		icon: "settings",
	},
];

export const mobileNavItems: NavItem[] = [
	{ label: "nav.home", path: "/", icon: "home" },
	{
		label: "nav.wiki",
		path: "/search",
		icon: "search",
		activePaths: [
			"/chara",
			"/skill",
			"/item",
			"/aura",
			"/passive",
			"/tactic",
			"/wiki",
			"/search",
		],
	},
	{
		label: "nav.news",
		path: "/news",
		icon: "newspaper",
		activePaths: ["/news", "/patch-notes"],
	},
	{
		label: "nav.tools",
		path: "/tools",
		icon: "build",
		activePaths: ["/tools"],
	},
	{
		label: "nav.settings",
		path: "/settings",
		icon: "settings",
		activePaths: ["/settings"],
	},
];

export const dashboardItems: NavItem[] = [
	{
		label: "nav.dashboard.overview",
		path: "/dashboard",
		icon: "dashboard",
		adminOnly: true,
	},
	{
		label: "nav.dashboard.content",
		path: "/dashboard/content",
		icon: "edit_note",
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
	},
	{
		label: "nav.dashboard.social",
		path: "/dashboard/social",
		icon: "share",
		adminOnly: true,
		children: [
			{
				label: "nav.dashboard.social.tweets",
				path: "/dashboard/tweets",
				icon: "tag",
			},
		],
	},
	{
		label: "nav.dashboard.tools",
		path: "/dashboard/tools",
		icon: "build",
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
	},
	{
		label: "nav.dashboard.security",
		path: "/dashboard/security",
		icon: "shield",
		adminOnly: true,
		children: [
			{
				label: "nav.dashboard.security.audit",
				path: "/dashboard/audit",
				icon: "policy",
			},
		],
	},
	{
		label: "nav.dashboard.users",
		path: "/dashboard/users",
		icon: "group",
		adminOnly: true,
	},
	{
		label: "nav.dashboard.settings",
		path: "/dashboard/settings",
		icon: "settings",
		adminOnly: true,
	},
];
