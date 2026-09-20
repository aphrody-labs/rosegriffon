"use client";

import { CircleUser, LayoutDashboard, Menu, User } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useSidebar } from "@rosegriffon/ui";
import { ThemeToggle } from "./ThemeToggle";
import { UnifiedSearchBar } from "./UnifiedSearchBar";
import { BASE_ADMIN } from "../config/routes";
import { UniverseSwitch } from "./UniverseSwitch";

export interface UserProfile {
	username?: string | null;
	avatar_url?: string | null;
	role?: string | null;
}

export interface TopAppBarProps {
	appName?: string;
	logoSrc?: string;
	homeHref?: string;
	adminHref?: string;
	isAdmin?: boolean;
	showUniverseSwitch?: boolean;
	user?: unknown | null;
	profile?: UserProfile | null;
	searchSlot?: React.ReactNode;
	notificationsSlot?: React.ReactNode;
	themeToggleSlot?: React.ReactNode;
	loginSlot?: React.ReactNode;
	accountHref?: string;
	titleMap?: Record<string, string>;
	isMobile?: boolean;
	showSearch?: boolean;
	showCart?: boolean;
	showSidebarToggle?: boolean;
	showActions?: boolean;
	className?: string;
}

const DEFAULT_TITLE_MAP: Record<string, string> = {
	"/wiki": "Encyclopédie",
	"/search": "Recherche",
	"/news": "Actualités",
	"/patch-notes": "Patch Notes",
	"/chara": "Joueurs",
	"/skill": "Techniques",
	"/item": "Objets",
	"/aura": "Hyper Techniques",
	"/passive": "Passifs",
	"/tactic": "Tactiques",
	"/team": "Équipes",
	"/equipe": "Équipes",
	"/tools": "Outils",
	"/settings": "Paramètres",
	"/admin": "Administration",
	"/achillea": "E-Sport",
	"/achillea/clans": "Clans E-Sport",
	"/achillea/ranked": "Mode Classé",
	"/achillea/tournaments": "Tournois E-Sport",
	"/achillea/leagues": "Astral League",
	"/evenements": "Événements",
	"/community": "Communauté",
	"/shop": "Boutique",
	"/sondages": "Sondages",
	"/projets": "Projets",
	"/rose-griffon-tv": "Rose Griffon TV",
	"/profil": "Profil",
	"/a-propos": "À propos",
};

export function resolvePageTitle(pathname: string, titleMap = DEFAULT_TITLE_MAP): string {
	if (pathname === "/" || pathname === "") {
		return "";
	}
	for (const [prefix, title] of Object.entries(titleMap)) {
		if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
			return title;
		}
	}
	return "";
}

export function MobileHeader({
	appName = "Rose Griffon",
	logoSrc = "/logo.webp",
	homeHref = "/",
	adminHref = BASE_ADMIN,
	isAdmin = false,
	showUniverseSwitch = false,
	user = null,
	profile = null,
	notificationsSlot,
	themeToggleSlot,
	loginSlot,
	accountHref = "/settings",
	titleMap = DEFAULT_TITLE_MAP,
	className,
}: TopAppBarProps) {
	const router = useRouter();
	const { toggleSidebar, openMobile } = useSidebar();
	const [isScrolled, setIsScrolled] = useState(false);
	const pathname = usePathname() || "/";

	useEffect(() => {
		const handleScroll = () => setIsScrolled(window.scrollY > 0);
		window.addEventListener("scroll", handleScroll, { passive: true });
		return () => window.removeEventListener("scroll", handleScroll);
	}, []);

	const isHome = pathname === "/" || pathname === homeHref;
	const title = resolvePageTitle(pathname, titleMap);

	return (
		<header
			className={`fixed top-0 left-0 right-0 z-40 flex h-[calc(4rem+env(safe-area-inset-top))] items-center gap-2 px-4 pt-safe md:hidden transition-[background-color,box-shadow] duration-300 motion-standard ${
				isScrolled ? "bg-surface-container/90 backdrop-blur-xl elevation-1" : "bg-surface"
			} ${className ?? ""}`}
		>
			<button
				onClick={toggleSidebar}
				className="size-12 flex items-center justify-center text-on-surface hover:bg-on-surface/[0.08] rounded-full transition-colors -ml-1"
				aria-label="Ouvrir le menu"
				aria-expanded={openMobile}
			>
				<Menu size={24} aria-hidden="true" />
			</button>

			{isHome || !title ? (
				<Link href={homeHref} className="flex items-center gap-1.5 shrink-0 ml-1">
					<div className="relative size-7">
						<Image src={logoSrc} fill sizes="28px" alt={appName} className="object-contain" />
					</div>
					<span className="type-title-large text-on-surface">{appName}</span>
				</Link>
			) : (
				<span className="type-title-large text-on-surface truncate ml-1">{title}</span>
			)}

			<div className="flex-1" />
			<div className="flex items-center gap-0.5">
				{isAdmin && (
					<Link
						href={adminHref}
						className="size-12 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-on-surface/[0.08] active:bg-on-surface/[0.12] transition-colors"
						aria-label="Administration"
					>
						<LayoutDashboard size={24} aria-hidden="true" />
					</Link>
				)}

				{notificationsSlot}

				{themeToggleSlot ?? <ThemeToggle className="size-12" />}

				<div className="ml-1">
					{user ? (
						<button
							className="size-12 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden shrink-0 active:scale-95 transition-transform"
							onClick={() => router.push(accountHref)}
							aria-label="Mon compte"
						>
							{profile?.avatar_url ? (
								<Image
									src={profile.avatar_url}
									alt=""
									width={48}
									height={48}
									className="w-full h-full object-cover"
									unoptimized
								/>
							) : (
								<User size={24} className="text-primary" aria-hidden="true" />
							)}
						</button>
					) : (
						loginSlot ?? (
							<Link
								href="/login"
								className="size-12 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-on-surface/[0.08] active:bg-on-surface/[0.12] transition-colors"
								aria-label="Se connecter"
							>
								<CircleUser size={24} aria-hidden="true" />
							</Link>
						)
					)}
				</div>
			</div>
		</header>
	);
}

export function DesktopTopBar({
	appName = "Rose Griffon",
	logoSrc = "/logo.webp",
	homeHref = "/",
	adminHref = BASE_ADMIN,
	isAdmin = false,
	showUniverseSwitch = true,
	user = null,
	profile = null,
	searchSlot,
	showSearch = true,
	notificationsSlot,
	themeToggleSlot,
	loginSlot,
	accountHref = "/settings",
	titleMap = DEFAULT_TITLE_MAP,
	className,
}: TopAppBarProps) {
	const pathname = usePathname() || "/";
	const router = useRouter();
	const { toggleSidebar, open } = useSidebar();
	const title = resolvePageTitle(pathname, titleMap);

	return (
		<header
			className={`fixed top-0 left-0 right-0 z-[60] flex h-14 items-center justify-between px-4 bg-surface/80 backdrop-blur-xl border-b border-outline-variant/5 max-md:hidden ${
				className ?? ""
			}`}
		>
			{/* Left: Burger + Logo + UniverseSwitch + (Optional) Title */}
			<div className="flex items-center gap-1.5 min-w-[220px]">
				<button
					onClick={toggleSidebar}
					className="size-10 rounded-full flex items-center justify-center text-on-surface hover:bg-on-surface/[0.08] active:bg-on-surface/[0.12] transition-colors"
					aria-label="Ouvrir le menu"
					aria-expanded={open}
				>
					<Menu size={24} aria-hidden="true" />
				</button>
				<Link href={homeHref} className="flex items-center gap-2 group px-2">
					<div className="relative size-7 shrink-0 transition-transform group-hover:scale-105">
						<Image src={logoSrc} fill sizes="28px" alt={appName} className="object-contain" />
					</div>
					<span className="font-expressive-title text-xl text-on-surface transition-all duration-500 group-hover:text-primary group-hover:font-width-expanded">
						{appName}
					</span>
				</Link>

				{showUniverseSwitch && (
					<div className="ml-2 hidden xl:flex items-center">
						<UniverseSwitch />
					</div>
				)}

				{title && (
					<div className="flex items-center gap-2 ml-2 animate-in fade-in slide-in-from-left-2 duration-300">
						<span className="size-1 rounded-full bg-outline-variant/40" />
						<span className="font-bold text-sm text-on-surface-variant tracking-wide opacity-80 mt-0.5 truncate max-w-[160px]">
							{title}
						</span>
					</div>
				)}
			</div>

			{/* Center: Search Bar Slot or default UnifiedSearchBar */}
			<div className="flex items-center justify-center flex-1 max-w-[560px] px-4">
				{showSearch && (searchSlot ?? <UnifiedSearchBar />)}
			</div>

			{/* Right: Actions */}
			<div className="flex items-center justify-end gap-1 min-w-[200px]">
				{isAdmin && (
					<Link
						href={adminHref}
						className="size-10 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-on-surface/[0.08] active:bg-on-surface/[0.12] transition-colors"
						aria-label="Administration"
						title="Administration"
					>
						<LayoutDashboard size={20} aria-hidden="true" />
					</Link>
				)}

				{notificationsSlot}

				{themeToggleSlot ?? <ThemeToggle />}

				<div className="ml-2">
					{user ? (
						<div
							className="size-9 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden transition-all duration-200 cursor-pointer hover:ring-2 hover:ring-primary/20 active:scale-95"
							onClick={() => router.push(accountHref)}
							role="button"
							tabIndex={0}
							aria-label={profile?.username || "Mon compte"}
							onKeyDown={(e) => {
								if (e.key === "Enter" || e.key === " ") {
									router.push(accountHref);
								}
							}}
						>
							{profile?.avatar_url ? (
								<Image
									src={profile.avatar_url}
									alt=""
									width={36}
									height={36}
									className="w-full h-full object-cover"
									unoptimized
								/>
							) : (
								<User size={18} className="text-primary" aria-hidden="true" />
							)}
						</div>
					) : (
						loginSlot ?? (
							<Link
								href="/login"
								className="h-9 px-4 rounded-full flex items-center gap-2 text-primary type-label-large hover:bg-primary/[0.08] active:bg-primary/[0.12] transition-colors duration-200"
							>
								<CircleUser size={20} aria-hidden="true" />
								Connexion
							</Link>
						)
					)}
				</div>
			</div>
		</header>
	);
}

export function TopAppBar(props: TopAppBarProps) {
	if (props.isMobile) {
		return <MobileHeader {...props} />;
	}
	return <DesktopTopBar {...props} />;
}

export { TopAppBar as Header };
export default TopAppBar;
