"use client";

import { BookOpen, Calendar, Heart, Home, Image as ImageIcon, Settings, Shield, Users } from "lucide-react";
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
	{
		creatorOnly: true,
		href: "/admin/patreon",
		icon: Heart,
		title: "Patreon",
	},
	{ href: "/admin/settings", icon: Settings, title: "Configuration" },
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
