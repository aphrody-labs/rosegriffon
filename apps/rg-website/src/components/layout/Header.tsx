"use client";

import { Button } from "@rosegriffon/ui";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { LiveStatus } from "@/components/header/LiveStatus";
import { GlobalSearch } from "@/components/search/global-search";
import { ThemeToggle } from "@/components/shared/ThemeToggle";

import { Separator } from "@rosegriffon/ui";
import { useSidebarAuth } from "@/hooks/useSidebarAuth";
import { Home, ShieldCheck } from "@/lib/icons-config";
import { cn } from "@/lib/utils";

import GlobalBreadcrumb from "./GlobalBreadcrumb";
import { HeaderUserMenu } from "./HeaderUserMenu";

/**
 * Header principal de l'application
 * Responsive et optimisé pour mobile/desktop avec animations fluides
 */
interface HeaderProps {
	showSearch?: boolean;
	showCart?: boolean; // Pour désactiver le panier dans le Header (Phase future)
	showLiveStatus?: boolean;
	showThemeToggle?: boolean;
	showUserMenu?: boolean;
	isMobile?: boolean;
	className?: string;
}

export function Header({
	showSearch = true,
	showLiveStatus = true,
	showThemeToggle = true,
	showUserMenu = true,
	isMobile = false,
	className,
}: HeaderProps) {
	const { profile } = useSidebarAuth();
	const pathname = usePathname();
	const isAdmin = profile?.role === "admin";
	const isAdminPage = pathname?.startsWith("/admin");

	// Classes communes pour transitions fluides
	const baseClasses = cn(
		"sticky top-0 z-40",
		"bg-background/80 backdrop-blur-xl", // Unified style
		"border-b border-border/40",
		"shadow-sm",
		"transition-all duration-300 ease-in-out",
		"header-safe",
		className,
	);

	if (isMobile) {
		return (
			<header
				className={cn(
					baseClasses,
					"pt-[env(safe-area-inset-top)]", // Safe area for notch
				)}
			>
				<div className="flex items-center gap-2 px-3 py-2 min-h-[3.5rem]">
					{/* Logo du site - Responsive */}
					<Link
						href="/"
						className="shrink-0 flex items-center justify-center hover:scale-105 transition-transform active:scale-95"
					>
						<Image
							src="/RG_Logo_V2.5.webp"
							alt="Rose Griffon"
							width={36}
							height={36}
							className="object-contain drop-shadow-md"
							priority
						/>
					</Link>

					{/* Titre de la page courante (mobile only) */}
					<div className="flex-1 min-w-0 overflow-hidden px-2">
						<GlobalBreadcrumb mobileMode />
					</div>

					{/* Actions droite mobile avec séparateurs visuels */}
					<div className="flex items-center gap-1 shrink-0">
						{isAdmin && (
							<Button
								variant="ghost"
								size="icon"
								asChild
								className="text-muted-foreground hover:text-primary size-9"
							>
								<Link href="/admin" title="Administration">
									<ShieldCheck className="size-5" />
									<span className="sr-only">Administration</span>
								</Link>
							</Button>
						)}

						{showLiveStatus && <LiveStatus />}

						{showThemeToggle && <ThemeToggle />}

						{showUserMenu && <HeaderUserMenu />}
					</div>
				</div>
			</header>
		);
	}

	// Desktop Header avec meilleure organisation visuelle et responsive
	return (
		<header className={baseClasses}>
			<div className="flex items-center gap-2 md:gap-3 lg:gap-4 px-3 sm:px-4 md:px-5 py-2 md:py-3">
				{/* Spacer gauche - la sidebar indique déjà la page active */}
				<div className="flex-1 min-w-0" />

				{/* Section centre - Recherche (desktop uniquement) */}
				{showSearch && (
					<div className="hidden lg:flex shrink-0 w-full max-w-xs xl:max-w-md">
						<GlobalSearch />
					</div>
				)}

				{/* Section droite - Actions utilisateur avec spacing amélioré */}
				<div
					className="flex items-center gap-1 sm:gap-1.5 md:gap-2 lg:gap-3 shrink-0"
					role="toolbar"
					aria-label="Actions utilisateur"
				>
					{isAdminPage && (
						<Button
							variant="ghost"
							size="icon"
							asChild
							className="text-muted-foreground hover:text-primary"
						>
							<Link href="/" title="Retour à l'accueil">
								<Home className="size-5" />
								<span className="sr-only">Accueil</span>
							</Link>
						</Button>
					)}
					{isAdmin && !isAdminPage && (
						<Button
							variant="ghost"
							size="icon"
							asChild
							className="text-muted-foreground hover:text-primary hidden sm:flex"
						>
							<Link href="/admin" title="Administration">
								<ShieldCheck className="size-5" />
								<span className="sr-only">Administration</span>
							</Link>
						</Button>
					)}

					{showLiveStatus && (
						<>
							<LiveStatus />
							<Separator
								orientation="vertical"
								className="h-6 hidden md:block"
							/>
						</>
					)}

					{showThemeToggle && <ThemeToggle />}

					{showUserMenu && (
						<>
							{showThemeToggle && (
								<Separator
									orientation="vertical"
									className="h-6 hidden md:block"
								/>
							)}
							<HeaderUserMenu />
						</>
					)}
				</div>
			</div>
		</header>
	);
}