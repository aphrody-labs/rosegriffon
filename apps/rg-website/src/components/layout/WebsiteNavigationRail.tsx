"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NavigationRail, NavigationRailItem, useSidebar } from "@rosegriffon/ui";
import { Home, Menu, Sparkles, Users } from "@/lib/icons-config";
import { RGTVIcon } from "@/components/sidebar/atoms/RGTVIcon";

export function WebsiteNavigationRail() {
	const pathname = usePathname();
	const { toggleSidebar, open } = useSidebar();

	const navItems = [
		{ href: "/", icon: Home, label: "Accueil" },
		{ href: "/projets", icon: Sparkles, label: "Projets" },
		{ href: "/notre-equipe", icon: Users, label: "Staff" },
		{ href: "/rose-griffon-tv", icon: RGTVIcon, label: "RG TV" },
	];

	// Visibilité pilotée par le layout, qui ne monte le rail qu'au breakpoint
	// « medium » (600–839px). Les classes `hidden md:flex lg:hidden` qui étaient
	// posées ici en plus laissaient, entre 600 et 767px, une bande de 80px vide :
	// le layout réservait la place (`ml-20`) d'un rail que le CSS masquait.
	return (
		<NavigationRail
			aria-label="Navigation principale"
			className="fixed left-0 top-0 bottom-0 z-50 flex border-r border-border/40 bg-background/95 backdrop-blur-xl"
		>
			<div className="pt-4 pb-2">
				<NavigationRailItem
					icon={<Menu size={24} />}
					label="Menu"
					onClick={toggleSidebar}
					active={open}
				/>
			</div>

			{navItems.map((item) => {
				const Icon = item.icon;
				const isActive =
					pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));

				return (
					<Link key={item.href} href={item.href} passHref legacyBehavior>
						<NavigationRailItem active={isActive} icon={<Icon size={24} />} label={item.label} />
					</Link>
				);
			})}
		</NavigationRail>
	);
}
