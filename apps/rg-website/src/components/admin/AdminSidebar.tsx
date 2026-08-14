"use client";

import {
	BookOpen,
	BarChart3,
	Bot,
	Calendar,
	Database,
	Hash,
	Heart,
	Home,
	Image as ImageIcon,
	Settings,
	Shield,
	Users,
} from "lucide-react";
import type { NavItem } from "@rosegriffon/ui";
import { AdminSidebar as SharedAdminSidebar } from "@rosegriffon/ui";
import Link from "next/link";

const adminNavItems: NavItem[] = [
	{ exact: true, href: "/admin", icon: Home, title: "Tableau de bord" },
	{ href: "/admin/users", icon: Users, title: "Utilisateurs" },
	{
		badge: "Journal de bord",
		href: "/admin/chroniques",
		icon: BookOpen,
		title: "Chroniques du bouquet",
	},
	{ href: "/admin/staff", icon: Shield, title: "Staff" },
	{
		href: "/admin/events",
		icon: Calendar,
		submenu: [
			{ title: "Calendrier", href: "/admin/events" },
			{ title: "Planning Streams", href: "/admin/stream-schedule" },
		],
		title: "Événements",
	},
	{ href: "/admin/media", icon: ImageIcon, title: "Médias" },
	{ href: "/admin/iergday", icon: Hash, title: "Campagne hashtag" },
	{
		creatorOnly: true,
		href: "/admin/patreon",
		icon: Heart,
		title: "Patreon",
	},
	{ href: "/admin/stats", icon: BarChart3, title: "Statistiques" },
	// Le bot Discord n'avait aucune surface web : ses réglages ne se voyaient
	// que depuis `/administration réglages`, dans Discord, et son état
	// d'exécution nulle part. Les quatre pages vivent sous `/admin/bot` sauf
	// l'ordonnanceur, qui a son propre chemin parce qu'il n'est pas le bot —
	// c'est `rg-cron.service`, un troisième service.
	{
		href: "/admin/bot",
		icon: Bot,
		submenu: [
			{ title: "Vue d'ensemble", href: "/admin/bot" },
			{ title: "Membres", href: "/admin/bot/membres" },
			{ title: "Réglages", href: "/admin/bot/reglages" },
			{ title: "Commandes", href: "/admin/bot/commandes" },
			{ title: "Tâches planifiées", href: "/admin/cron" },
		],
		title: "Bot Discord",
	},
	{ href: "/admin/base", icon: Database, title: "Infrastructure" },
	{ href: "/admin/settings", icon: Settings, title: "Configuration" },
];

export default function AdminSidebar({ showPatreon = false }: { showPatreon?: boolean }) {
	return (
		<SharedAdminSidebar
			items={adminNavItems}
			showCreatorItems={showPatreon}
			// `/dashboard` n'est qu'une redirection vers `/profil/<pseudo>` : deux
			// chemins pour la même page. On pointe directement sur les paramètres du
			// compte, la seule destination distincte.
			footer={
				<Link
					href="/dashboard/account"
					className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
				>
					<Home className="size-4" />
					<span>Mon compte</span>
				</Link>
			}
		/>
	);
}
