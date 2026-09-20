"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { useAchilleaAuth } from "@/lib/achillea";
import { Button, Badge } from "@rosegriffon/ui";
import {
	Home,
	Users,
	Zap,
	Trophy,
	Star,
	Video,
	IdCard,
	Wallet,
	BookOpen,
	ShieldAlert,
	LogIn,
	LogOut,
} from "lucide-react";

export const ACHILLEA_NAV_LINKS = [
	{ label: "Accueil", path: "/achillea", icon: Home, exact: true },
	{ label: "Clans", path: "/achillea/clans", icon: Users },
	{ label: "Ranked", path: "/achillea/ranked", icon: Zap },
	{ label: "Tournois", path: "/achillea/tournaments", icon: Trophy },
	{ label: "Astral League", path: "/achillea/leagues/astral", icon: Star },
	{ label: "Casts", path: "/achillea/casts", icon: Video },
	{ label: "Licence", path: "/achillea/licence", icon: IdCard },
	{ label: "Wallet", path: "/achillea/wallet", icon: Wallet },
	{ label: "Guide", path: "/achillea/guide", icon: BookOpen },
];

export function AchilleaNav() {
	const pathname = usePathname();
	const { user, isAuthenticated, login, logout } = useAchilleaAuth();

	const isStaff = (user?.role ?? 0) >= 1;

	return (
		<header className="sticky top-0 z-40 w-full border-b border-outline/15 bg-surface/80 backdrop-blur-md">
			<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
				{/* Brand Logo & Switcher */}
				<div className="flex items-center gap-3">
					<Link href="/achillea" className="flex items-center gap-2.5 group">
						<div className="relative size-8 shrink-0">
							<Image
								src="/achillea/logo1.svg"
								alt="Logo Achilléa"
								fill
								className="object-contain drop-shadow-[0_0_8px_rgba(var(--achillea-lime-rgb),0.5)]"
							/>
						</div>
						<span className="font-black text-lg tracking-wider text-on-surface group-hover:text-primary transition-colors">
							ACHILLÉA
						</span>
						<Badge
							variant="secondary"
							className="hidden sm:inline-flex text-[10px] uppercase font-bold bg-[var(--achillea-primary)]/15 text-[var(--achillea-primary)] border border-[var(--achillea-primary)]/30"
						>
							Esport
						</Badge>
					</Link>
				</div>

				{/* Desktop nav links */}
				<nav className="hidden lg:flex items-center gap-1 overflow-x-auto py-1">
					{ACHILLEA_NAV_LINKS.map((link) => {
						const Icon = link.icon;
						const isActive = link.exact
							? pathname === link.path
							: pathname === link.path || pathname?.startsWith(`${link.path}/`);

						return (
							<Link
								key={link.path}
								href={link.path}
								className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
									isActive
										? "bg-primary text-on-primary shadow-sm"
										: "text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/40"
								}`}
							>
								<Icon className="size-3.5" />
								<span>{link.label}</span>
							</Link>
						);
					})}

					{isStaff && (
						<Link
							href="/achillea/admins/dashboard"
							className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
								pathname?.startsWith("/achillea/admins")
									? "bg-[var(--achillea-primary)] text-white shadow-sm"
									: "text-[var(--achillea-primary)] hover:bg-amber-500/10"
							}`}
						>
							<ShieldAlert className="size-3.5" />
							<span>Admin</span>
						</Link>
					)}
				</nav>

				{/* User Action */}
				<div className="flex items-center gap-2 shrink-0">
					{isAuthenticated && user ? (
						<div className="flex items-center gap-2">
							<Link
								href={`/achillea/users/${user.id}`}
								className="flex items-center gap-2 p-1 rounded-full hover:bg-surface-variant/50 transition-colors"
							>
								{user.avatar ? (
									<img
										src={user.avatar}
										alt={user.username}
										className="size-7 rounded-full object-cover border border-outline/30"
									/>
								) : (
									<div className="size-7 rounded-full bg-primary text-on-primary flex items-center justify-center text-xs font-bold">
										{user.username.charAt(0).toUpperCase()}
									</div>
								)}
								<span className="hidden sm:inline text-xs font-bold text-on-surface max-w-[100px] truncate">
									{user.username}
								</span>
							</Link>

							<Button
								variant="ghost"
								size="icon"
								onClick={() => void logout()}
								className="size-8 text-on-surface-variant hover:text-red-500"
								title="Se déconnecter"
								aria-label="Se déconnecter"
							>
								<LogOut className="size-4" />
							</Button>
						</div>
					) : (
						<Button
							size="sm"
							onClick={() => login(pathname || "/achillea")}
							className="bg-[var(--discord-blurple)] hover:bg-[var(--discord-blurple-hover)] text-white font-bold text-xs gap-1.5 rounded-xl shadow-sm"
						>
							<LogIn className="size-3.5" />
							<span>Discord</span>
						</Button>
					)}
				</div>
			</div>

			{/* Sub-nav mobile bar */}
			<div className="lg:hidden border-t border-outline/10 px-3 py-2 overflow-x-auto flex items-center gap-1.5 scrollbar-none">
				{ACHILLEA_NAV_LINKS.map((link) => {
					const Icon = link.icon;
					const isActive = link.exact
						? pathname === link.path
						: pathname === link.path || pathname?.startsWith(`${link.path}/`);

					return (
						<Link
							key={link.path}
							href={link.path}
							className={`shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium ${
								isActive
									? "bg-primary text-on-primary font-bold"
									: "text-on-surface-variant hover:bg-surface-variant/30"
							}`}
						>
							<Icon className="size-3" />
							<span>{link.label}</span>
						</Link>
					);
				})}
				{isStaff && (
					<Link
						href="/achillea/admins/dashboard"
						className={`shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium text-[var(--achillea-primary)] ${
							pathname?.startsWith("/achillea/admins")
								? "bg-[var(--achillea-primary)] text-white font-bold"
								: "hover:bg-amber-500/10"
						}`}
					>
						<ShieldAlert className="size-3" />
						<span>Admin</span>
					</Link>
				)}
			</div>
		</header>
	);
}
