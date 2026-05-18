"use client";

import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@rg/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@rg/ui";

import { Skeleton } from "@rg/ui";
import { authClient } from "@/lib/auth-client";
import { LogOut, Settings, UserCircle } from "@/lib/icons-config";
import type { Database } from "@rg/db";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

interface UserAccountPopupProps {
	user: {
		id: string;
		email?: string;
	};
	profile: Profile | null;
	loading?: boolean;
}

export function UserAccountPopup({
	user,
	profile,
	loading = false,
}: UserAccountPopupProps) {
	const [isLoggingOut, setIsLoggingOut] = useState(false);
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

	const displayName =
		profile?.full_name || user.email?.split("@")[0] || "Utilisateur";
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
			<DropdownMenuContent
				className="w-56"
				align="end"
				alignOffset={-5}
				sideOffset={8}
			>
				{/* Header avec info utilisateur */}
				<DropdownMenuLabel className="font-normal">
					<div className="flex flex-col space-y-1">
						<p className="text-sm font-medium leading-none truncate">
							{displayName}
						</p>
						<p className="text-xs text-muted-foreground truncate">
							{user.email}
						</p>
					</div>
				</DropdownMenuLabel>

				<DropdownMenuSeparator />

				{/* Navigation principale */}
				<DropdownMenuGroup>
					<DropdownMenuItem asChild>
						<Link
							href="/profil"
							className="flex items-center gap-2 cursor-pointer"
						>
							<UserCircle className="size-4" />
							<span>Mon Profil</span>
						</Link>
					</DropdownMenuItem>

					<DropdownMenuItem asChild>
						<Link
							href="/dashboard/account"
							className="flex items-center gap-2 cursor-pointer"
						>
							<Settings className="size-4" />
							<span>Paramètres</span>
						</Link>
					</DropdownMenuItem>
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