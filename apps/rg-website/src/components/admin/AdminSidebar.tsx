"use client";

import {
	BookOpen,
	Calendar,
	ChevronDown,
	Heart,
	Home,
	Image as ImageIcon,
	Menu,
	Settings,
	Shield,
	Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import {
	Drawer,
	DrawerContent,
	DrawerDescription,
	DrawerHeader,
	DrawerTitle,
	DrawerTrigger,
} from "@/components/ui/drawer";
import { cn } from "@/lib/utils";

const adminNavItems = [
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
	const navItems = adminNavItems.filter(
		(item) => !item.creatorOnly || showPatreon,
	);
	const pathname = usePathname();
	const [openSubmenu, setOpenSubmenu] = useState<string | null>(null);
	const [isDrawerOpen, setIsDrawerOpen] = useState(false);

	const toggleSubmenu = (title: string) => {
		setOpenSubmenu(openSubmenu === title ? null : title);
	};

	const isActive = (href: string, exact?: boolean) =>
		exact ? pathname === href : (pathname || "").startsWith(href);

	const NavContent = ({ mobile = false }: { mobile?: boolean }) => (
		<nav
			className={cn("flex-1 space-y-1 overflow-y-auto p-3", mobile && "px-0")}
		>
			{navItems.map((item) => {
				const Icon = item.icon;
				const active = isActive(item.href, item.exact);
				const hasSubmenu = item.submenu && item.submenu.length > 0;
				const submenuOpen = openSubmenu === item.title;

				return (
					<div key={item.href}>
						{hasSubmenu ? (
							<button
								onClick={() => toggleSubmenu(item.title)}
								className={cn(
									"flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
									active
										? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
										: "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
								)}
							>
								<div className="flex items-center gap-3">
									<Icon className="size-4 shrink-0" />
									<span>{item.title}</span>
								</div>
								<ChevronDown
									className={cn(
										"h-3.5 w-3.5 transition-transform",
										submenuOpen && "rotate-180",
									)}
								/>
							</button>
						) : (
							<Link
								href={item.href}
								onClick={() => mobile && setIsDrawerOpen(false)}
								className={cn(
									"group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
									active
										? "bg-sidebar-accent text-sidebar-accent-foreground font-medium shadow-sm"
										: "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
								)}
							>
								<Icon className="size-4 shrink-0" />
								<span className="flex-1 truncate">{item.title}</span>
								{item.badge && (
									<span className="rounded-full bg-primary/20 px-2 py-0.5 text-xs font-medium uppercase tracking-wide text-primary">
										{item.badge}
									</span>
								)}
							</Link>
						)}

						{hasSubmenu && submenuOpen && (
							<div className="ml-3 mt-1 space-y-0.5 border-l border-sidebar-border pl-3">
								{item.submenu?.map((subitem) => (
									<Link
										key={subitem.href}
										href={subitem.href}
										onClick={() => mobile && setIsDrawerOpen(false)}
										className={cn(
											"block rounded-md px-3 py-2 text-sm transition-colors",
											pathname === subitem.href
												? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
												: "text-sidebar-foreground/70 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground",
										)}
									>
										{subitem.title}
									</Link>
								))}
							</div>
						)}
					</div>
				);
			})}
		</nav>
	);

	return (
		<>
			{/* Mobile Header */}
			<div className="fixed top-0 left-0 right-0 z-30 flex h-16 items-center justify-between border-b border-sidebar-border bg-sidebar px-4 shadow-sm lg:hidden">
				<Link href="/admin" className="flex items-center gap-2">
					<div className="flex size-8 items-center justify-center rounded-lg bg-sidebar-foreground/15">
						<Shield className="size-4 text-sidebar-foreground" />
					</div>
					<span className="font-bold text-sidebar-foreground">Admin</span>
				</Link>
			</div>

			{/* Desktop Sidebar */}
			<aside className="sticky top-0 hidden h-screen w-64 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
				<div className="border-b border-sidebar-border p-4">
					<Link href="/admin" className="flex items-center gap-3">
						<div className="flex size-9 items-center justify-center rounded-lg bg-sidebar-foreground/15">
							<Shield className="size-4 text-sidebar-foreground" />
						</div>
						<div className="min-w-0">
							<h2 className="truncate font-semibold text-sidebar-foreground">
								Gestion
							</h2>
							<p className="truncate text-xs text-sidebar-foreground/80">
								Rose Griffon
							</p>
						</div>
					</Link>
				</div>

				<NavContent />

				<div className="border-t border-sidebar-border p-3">
					<Link
						href="/dashboard"
						className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
					>
						<Home className="size-4" />
						<span>Compte personnel</span>
					</Link>
				</div>
			</aside>

			{/* Mobile Bottom Navigation */}
			<div className="pb-safe fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around border-t border-sidebar-border bg-sidebar px-4 py-2 lg:hidden">
				<Link
					href="/admin"
					className={cn(
						"flex flex-col items-center gap-1 rounded-lg p-2 transition-colors",
						pathname === "/admin"
							? "text-sidebar-foreground"
							: "text-sidebar-foreground/80",
					)}
				>
					<Home className="size-5" />
					<span className="text-[11px] font-medium leading-none">Accueil</span>
				</Link>
				<Link
					href="/admin/events"
					className={cn(
						"flex flex-col items-center gap-1 rounded-lg p-2 transition-colors",
						(pathname || "").startsWith("/admin/events")
							? "text-sidebar-foreground"
							: "text-sidebar-foreground/80",
					)}
				>
					<Calendar className="size-5" />
					<span className="text-[11px] font-medium leading-none">Events</span>
				</Link>
				<Link
					href="/admin/staff"
					className={cn(
						"flex flex-col items-center gap-1 rounded-lg p-2 transition-colors",
						(pathname || "").startsWith("/admin/staff")
							? "text-sidebar-foreground"
							: "text-sidebar-foreground/80",
					)}
				>
					<Shield className="size-5" />
					<span className="text-[11px] font-medium leading-none">Staff</span>
				</Link>

				<Drawer open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
					<DrawerTrigger asChild>
						<button className="flex flex-col items-center gap-1 rounded-lg p-2 text-sidebar-foreground/80 transition-colors hover:text-sidebar-foreground">
							<Menu className="size-5" />
							<span className="text-[11px] font-medium leading-none">Menu</span>
						</button>
					</DrawerTrigger>
					<DrawerContent className="max-h-[80vh]">
						<DrawerHeader>
							<DrawerTitle>Menu Navigation</DrawerTitle>
							<DrawerDescription>Accès rapide aux modules</DrawerDescription>
						</DrawerHeader>
						<div className="overflow-y-auto px-4 pb-8">
							<NavContent mobile={true} />
							<div className="mt-2 border-t border-border p-3">
								<Link
									href="/dashboard"
									onClick={() => setIsDrawerOpen(false)}
									className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-foreground/80 transition-colors hover:bg-muted"
								>
									<Home className="size-4" />
									<span>Compte personnel</span>
								</Link>
							</div>
						</div>
					</DrawerContent>
				</Drawer>
			</div>
		</>
	);
}
