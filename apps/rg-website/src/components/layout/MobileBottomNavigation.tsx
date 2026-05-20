"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { RGTVIcon } from "@/components/sidebar/atoms/RGTVIcon";
import { useSidebar } from "@rosegriffon/ui";
import { Home, Menu, Sparkles, Users } from "@/lib/icons-config";
import { cn } from "@/lib/utils";

export const MobileBottomNavigation = () => {
	const pathname = usePathname();
	const { toggleSidebar, open, openMobile, isMobile } = useSidebar();

	const isMenuOpen = isMobile ? openMobile : open;

	const navItems = [
		{
			href: "/",
			icon: Home,
			label: "Accueil",
		},
		{
			href: "/projets",
			icon: Sparkles,
			label: "Projets",
		},
		{
			href: "/notre-equipe",
			icon: Users,
			label: "Staff",
		},
		{
			href: "/rose-griffon-tv",
			icon: RGTVIcon,
			label: "RG TV",
		},
	];

	return (
		<div className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/40 bg-background/95 backdrop-blur-xl pb-[env(safe-area-inset-bottom)] shadow-[0_-5px_20px_-5px_rgba(0,0,0,0.1)]">
			<nav className="flex h-16 items-center justify-around px-2">
				{navItems.map((item) => {
					const isActive = pathname
						? (item.href === "/"
							? pathname === "/"
							: pathname.startsWith(item.href))
						: false;
					const Icon = item.icon;

					return (
						<Link
							key={item.href}
							href={item.href}
							onClick={() => {
								if (navigator.vibrate) {navigator.vibrate(10);}
							}}
							className={cn(
								"relative flex flex-col items-center justify-center gap-1 rounded-xl p-2 transition-all duration-300 min-w-[60px]",
								isActive
									? "text-primary scale-110 font-semibold"
									: "text-muted-foreground hover:text-foreground active:scale-95",
							)}
							aria-label={item.label}
						>
							{/* Active Indicator Line */}
							{isActive && (
								<span className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-8 h-1 bg-primary rounded-b-full shadow-[0_2px_8px_rgba(var(--primary),0.5)]" />
							)}

							<Icon
								className={cn(
									"size-6 transition-transform duration-300",
									isActive && "animate-bounce-subtle",
								)}
							/>
							<span className="text-[11px] font-medium leading-none">
								{item.label}
							</span>
						</Link>
					);
				})}

				<button
					onClick={() => {
						toggleSidebar();
						if (navigator.vibrate) {navigator.vibrate(10);}
					}}
					className={cn(
						"relative flex flex-col items-center justify-center gap-1 rounded-xl p-2 transition-all duration-300 min-w-[60px]",
						isMenuOpen
							? "text-primary scale-110 font-semibold"
							: "text-muted-foreground hover:text-foreground active:scale-95",
					)}
					aria-label="Ouvrir le menu"
					aria-expanded={isMenuOpen}
				>
					{isMenuOpen && (
						<span className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-8 h-1 bg-primary rounded-b-full shadow-[0_2px_8px_rgba(var(--primary),0.5)]" />
					)}
					<Menu
						className={cn(
							"size-6 transition-transform duration-300",
							isMenuOpen && "rotate-90",
						)}
					/>
					<span className="text-[11px] font-medium leading-none">Menu</span>
				</button>
			</nav>
		</div>
	);
};
