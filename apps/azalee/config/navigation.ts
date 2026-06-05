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
		children: [
			{ label: "nav.news.articles", path: "/news", icon: "feed" },
			{ label: "nav.news.patch_notes", path: "/patch-notes", icon: "update" },
		],
		icon: "newspaper",
		label: "nav.news",
		path: "/news",
	},
	{
		commonSprite: "chara",
		icon: "groups",
		label: "nav.wiki.players",
		path: "/chara",
	},
	{
		commonSprite: "skill",
		icon: "",
		label: "nav.wiki.skills",
		path: "/skill",
	},
	{
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
		defaultOpen: true,
		icon: "",
		label: "nav.wiki.hyper_skills",
		path: "/aura",
	},
	{
		icon: "backpack",
		label: "nav.wiki.items",
		path: "/item",
	},
	{
		icon: "strategy",
		label: "nav.wiki.tactics",
		path: "/tactic",
	},
	{
		commonSprite: "tension",
		icon: "auto_awesome",
		label: "nav.wiki.passives",
		path: "/passive",
	},
	{
		icon: "image",
		label: "nav.wiki.gallery",
		path: "/gallery",
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
			"/aura",
			"/passive",
			"/tactic",
			"/gallery",
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
