"use client";

import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
	Avatar,
	AvatarFallback,
	AvatarImage,
	Skeleton,
} from "@rose-griffon/ui";
import { ChevronUp, LogIn, LogOut, ShieldCheck, User } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { ThemeToggle } from "@/components/shared/ThemeToggle";

import { useSidebarAuth } from "@/hooks/useSidebarAuth";
import { authClient } from "@/lib/auth-client";

/**
 * Footer compact de la sidebar : ThemeToggle à gauche + état d'auth à droite
 * (avatar+menu si connecté, bouton login icon-only sinon).
 *
 * Les hover états utilisent les tokens `sidebar-accent` (pas `bg-background` qui
 * vire blanc au survol) — fix du bug variant="outline".
 */
export function SidebarUser() {
	const { user, profile, loading } = useSidebarAuth();
	const router = useRouter();

	const displayName = profile?.username || user?.name || user?.email || "Membre";
	const handle = profile?.username ? `@${profile.username}` : user?.email;
	const avatarSrc = profile?.avatar_url || user?.image || "";
	const profileHref = profile?.username ? `/profil/${profile.username}` : "/dashboard/account";
	const isAdmin = profile?.role === "admin";

	const signOut = async () => {
		await authClient.signOut();
		router.refresh();
	};

	return (
		<div className="flex items-center gap-2">
			{loading ? (
				<Skeleton className="size-9 rounded-md" />
			) : !user ? (
				<Link
					href="/login"
					aria-label="Se connecter"
					className="inline-flex size-9 items-center justify-center rounded-md text-sidebar-foreground/85 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-sidebar-ring"
				>
					<LogIn className="size-5" aria-hidden="true" />
					<span className="sr-only">Se connecter</span>
				</Link>
			) : (
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<button
							type="button"
							aria-label="Menu du compte"
							className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-1.5 py-1 text-sm transition-colors hover:bg-sidebar-accent focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-sidebar-ring"
						>
							<Avatar className="size-8 border border-sidebar-border/40">
								<AvatarImage src={avatarSrc} alt="" />
								<AvatarFallback className="bg-sidebar-accent text-xs font-bold text-sidebar-foreground">
									{displayName[0]?.toUpperCase()}
								</AvatarFallback>
							</Avatar>
							<span className="max-w-[7rem] truncate font-semibold text-sidebar-foreground">
								{displayName}
							</span>
							<ChevronUp
								className="size-4 shrink-0 text-sidebar-foreground/75"
								aria-hidden="true"
							/>
						</button>
					</DropdownMenuTrigger>
					<DropdownMenuContent side="top" align="end" className="min-w-56">
						<DropdownMenuLabel className="font-normal">
							<p className="text-sm font-medium">{displayName}</p>
							<p className="truncate text-xs text-muted-foreground">{handle}</p>
						</DropdownMenuLabel>
						<DropdownMenuSeparator />
						<DropdownMenuItem asChild>
							<Link href={profileHref}>
								<User className="mr-2 size-4" aria-hidden="true" />
								Mon profil
							</Link>
						</DropdownMenuItem>
						<DropdownMenuItem asChild>
							<Link href="/dashboard/account">
								<User className="mr-2 size-4" aria-hidden="true" />
								Paramètres du compte
							</Link>
						</DropdownMenuItem>
						{isAdmin && (
							<DropdownMenuItem asChild>
								<Link href="/admin">
									<ShieldCheck className="mr-2 size-4" aria-hidden="true" />
									Administration
								</Link>
							</DropdownMenuItem>
						)}
						<DropdownMenuSeparator />
						<DropdownMenuItem
							onSelect={signOut}
							className="text-destructive focus:text-destructive"
						>
							<LogOut className="mr-2 size-4" aria-hidden="true" />
							Se déconnecter
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			)}

			<div className="ml-auto">
				<ThemeToggle />
			</div>
		</div>
	);
}
