import { DashboardGrid, QuickActionCard } from "@rosegriffon/ui";
import { BookOpen, Calendar, Image as ImageIcon, Settings, Shield, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface QuickAction {
	title: string;
	description: string;
	href: string;
	icon: LucideIcon;
	accent: string;
}

const ACTIONS: QuickAction[] = [
	{
		accent: "text-sky-500",
		description: "Comptes, rôles, sanctions",
		href: "/admin/users",
		icon: Users,
		title: "Utilisateurs",
	},
	{
		accent: "text-violet-500",
		description: "Articles, brouillons, séries",
		href: "/admin/chroniques",
		icon: BookOpen,
		title: "Chroniques",
	},
	{
		accent: "text-amber-500",
		description: "Calendrier et planning streams",
		href: "/admin/events",
		icon: Calendar,
		title: "Événements",
	},
	{
		accent: "text-emerald-500",
		description: "Membres équipe et rôles",
		href: "/admin/staff",
		icon: Shield,
		title: "Staff",
	},
	{
		accent: "text-rose-500",
		description: "Upload, galeries, modération",
		href: "/admin/media",
		icon: ImageIcon,
		title: "Médias",
	},
	{
		accent: "text-muted-foreground",
		description: "Site, intégrations, secrets",
		href: "/admin/settings",
		icon: Settings,
		title: "Configuration",
	},
];

export function QuickActions() {
	return (
		<DashboardGrid title="Modules" className="lg:grid-cols-3">
			{ACTIONS.map((action) => (
				<QuickActionCard key={action.href} {...action} />
			))}
		</DashboardGrid>
	);
}