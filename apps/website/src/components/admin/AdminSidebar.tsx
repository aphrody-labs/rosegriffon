"use client";

import { Home, Shield, BookOpen, Users, Calendar, Image as ImageIcon, Heart, Settings } from "lucide-react";
import { AdminSidebar as SharedAdminSidebar, NavItem } from "@rosegriffon/ui";
import Link from "next/link";

const adminNavItems: NavItem[] = [
	{ title: "Tableau de bord", href: "/admin", icon: Home, exact: true },
	{ title: "Utilisateurs", href: "/admin/users", icon: Users },
	{
		title: "Chroniques du bouquet",
		href: "/admin/chroniques",
		icon: BookOpen,
		badge: "Journal de bord",
	},
	{ title: "Staff", href: "/admin/staff", icon: Shield },
	{
		title: "Événements",
		href: "/admin/events",
		icon: Calendar,
		submenu: [
			{ title: "Calendrier", href: "/admin/events" },
			{ title: "Planning Streams", href: "/admin/stream-schedule" },
		],
	},
	{ title: "Médias", href: "/admin/media", icon: ImageIcon },
	{
		title: "Patreon",
		href: "/admin/patreon",
		icon: Heart,
		creatorOnly: true,
	},
	{ title: "Configuration", href: "/admin/settings", icon: Settings },
];

export default function AdminSidebar({
	showPatreon = false,
}: {
	showPatreon?: boolean;
}) {
	return (
		<SharedAdminSidebar
			items={adminNavItems}
			showCreatorItems={showPatreon}
			footer={
				<Link
					href="/dashboard"
					className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
				>
					<Home className="size-4" />
					<span>Compte personnel</span>
				</Link>
			}
		/>
	);
}
