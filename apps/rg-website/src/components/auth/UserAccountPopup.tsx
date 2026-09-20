"use client";

import {
	Button,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
	Avatar,
	AvatarFallback,
	AvatarImage,
	Skeleton,
} from "@rosegriffon/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { authClient } from "@/lib/auth-client";
import { LogOut, Settings, ShieldCheck, UserCircle } from "@/lib/icons-config";
import { ADMIN_ROLES } from "@rosegriffon/types";
import type { PublicProfile } from "@rosegriffon/db";

type Profile = PublicProfile;

interface UserAccountPopupProps {
	user: {
		id: string;
		email?: string;
		/** Nom porté par la session Better Auth — remplace `profiles.full_name`,
		 *  devenu illisible côté client (colonne personnelle). */
		name?: string;
	};
	profile: Profile | null;
	loading?: boolean;
}

export function UserAccountPopup({ user, profile, loading = false }: UserAccountPopupProps) {
	const [isLoggingOut, setIsLoggingOut] = useState(false);
	// `ADMIN_ROLES` fait autorité : coder « admin » en dur excluait superadmin,
	// editor et moderator, qui ont pourtant accès à l'administration.
	//
	// La constante vient de `@rosegriffon/types` et non du helper `isAdmin` de
	// `@rosegriffon/auth` : ce paquet-là tire `@rosegriffon/db/service`, donc le
	// client Supabase en rôle service. L'importer depuis un composant client
	// l'embarquerait dans le bundle du navigateur.
	const estAdmin = (ADMIN_ROLES as readonly string[]).includes(profile?.role ?? "");
	const router = useRouter();

	const handleLogout = async () => {
		try {
			setIsLoggingOut(true);
			await authClient.signOut();
			router.push("/");
			router.refresh();
		} catch (error) {
			console.error("Erreur lors de la déconnexion:", error);
		} finally {
			setIsLoggingOut(false);
		}
	};

	if (loading) {
		return <Skeleton className="size-14 rounded-full" />;
	}

	// `full_name` n'est plus lisible côté client (colonne personnelle) : le nom
	// vient de la session Better Auth, qui est celle de l'utilisateur courant.
	const displayName = user.name || profile?.username || user.email?.split("@")[0] || "Utilisateur";
	const avatarUrl = profile?.avatar_url;
	const initials = displayName
		.split(" ")
		.map((n) => n[0])
		.join("")
		.toUpperCase()
		.slice(0, 2);

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					variant="ghost"
					className="relative size-10 rounded-full ring-2 ring-white/20 hover:ring-white/40 transition-all duration-200 shadow-md hover:shadow-lg bg-white dark:bg-slate-900"
				>
					<Avatar className="size-10">
						<AvatarImage src={avatarUrl || undefined} alt={displayName} />
						<AvatarFallback className="bg-linear-to-br from-[#a14b3f] to-gaelle-blue text-white text-sm font-bold">
							{initials}
						</AvatarFallback>
					</Avatar>
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent className="w-56" align="end" alignOffset={-5} sideOffset={8}>
				{/* Header avec info utilisateur */}
				<DropdownMenuLabel className="font-normal">
					<div className="flex flex-col space-y-1">
						<p className="text-sm font-medium leading-none truncate">{displayName}</p>
						<p className="text-xs text-muted-foreground truncate">{user.email}</p>
					</div>
				</DropdownMenuLabel>

				<DropdownMenuSeparator />

				{/* Navigation principale */}
				<DropdownMenuGroup>
					<DropdownMenuItem asChild>
						<Link href="/profil" className="flex cursor-pointer items-center gap-2">
							<UserCircle className="size-4" />
							<span>Mon profil</span>
						</Link>
					</DropdownMenuItem>

					<DropdownMenuItem asChild>
						<Link href="/settings" className="flex cursor-pointer items-center gap-2">
							<Settings className="size-4" />
							<span>Paramètres</span>
						</Link>
					</DropdownMenuItem>

					{/* L'accès à l'administration n'existait que dans le pied de la barre
					    latérale, retiré parce qu'il doublonnait ce menu. Il est repris ici
					    pour ne pas disparaître avec lui. */}
					{estAdmin && (
						<DropdownMenuItem asChild>
							<Link href="/admin" className="flex cursor-pointer items-center gap-2">
								<ShieldCheck className="size-4" />
								<span>Administration</span>
							</Link>
						</DropdownMenuItem>
					)}
				</DropdownMenuGroup>

				<DropdownMenuSeparator />

				{/* Déconnexion */}
				<DropdownMenuItem
					className="text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950/20 cursor-pointer"
					onClick={handleLogout}
					disabled={isLoggingOut}
				>
					<LogOut className="size-4 mr-2" />
					<span>{isLoggingOut ? "Déconnexion..." : "Se déconnecter"}</span>
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
