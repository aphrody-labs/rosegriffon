import { DashboardGrid, QuickActionCard } from "@rg/ui";
import {
	BookOpen,
	Calendar,
	Image as ImageIcon,
	type LucideIcon,
	Settings,
	Shield,
	Users,
} from "lucide-react";

interface QuickAction {
	title: string;
	description: string;
	href: string;
	icon: LucideIcon;
	accent: string;
}

const ACTIONS: QuickAction[] = [
	{
		title: "Utilisateurs",
		description: "Comptes, rôles, sanctions",
		href: "/admin/users",
		icon: Users,
		accent: "text-sky-500",
	},
	{
		title: "Chroniques",
		description: "Articles, brouillons, séries",
		href: "/admin/chroniques",
		icon: BookOpen,
		accent: "text-violet-500",
	},
	{
		title: "Événements",
		description: "Calendrier et planning streams",
		href: "/admin/events",
		icon: Calendar,
		accent: "text-amber-500",
	},
	{
		title: "Staff",
		description: "Membres équipe et rôles",
		href: "/admin/staff",
		icon: Shield,
		accent: "text-emerald-500",
	},
	{
		title: "Médias",
		description: "Upload, galeries, modération",
		href: "/admin/media",
		icon: ImageIcon,
		accent: "text-rose-500",
	},
	{
		title: "Configuration",
		description: "Site, intégrations, secrets",
		href: "/admin/settings",
		icon: Settings,
		accent: "text-muted-foreground",
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