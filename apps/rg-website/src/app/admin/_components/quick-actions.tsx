import {
	BookOpen,
	Calendar,
	Image as ImageIcon,
	type LucideIcon,
	Settings,
	Shield,
	Users,
} from "lucide-react";
import Link from "next/link";

import { Card, CardContent } from "@/components/ui/card";

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
		<section aria-labelledby="quick-actions-title">
			<h2
				id="quick-actions-title"
				className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground"
			>
				Modules
			</h2>
			<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
				{ACTIONS.map(({ title, description, href, icon: Icon, accent }) => (
					<Link key={href} href={href} className="group">
						<Card className="h-full transition-all group-hover:border-primary/40 group-hover:-translate-y-0.5 group-hover:shadow-md">
							<CardContent className="flex items-start gap-3 p-4">
								<div className={`mt-0.5 ${accent}`} aria-hidden="true">
									<Icon className="h-5 w-5" />
								</div>
								<div className="min-w-0 flex-1">
									<p className="font-semibold text-foreground">{title}</p>
									<p className="mt-0.5 text-xs text-muted-foreground">
										{description}
									</p>
								</div>
							</CardContent>
						</Card>
					</Link>
				))}
			</div>
		</section>
	);
}
