"use client";

import { Button, Skeleton } from "@rose-griffon/ui";
import Link from "next/link";

import { UserAccountPopup } from "@/components/auth/UserAccountPopup";

import { useSidebarAuth } from "@/hooks/useSidebarAuth";
import { Loader2, UserCircle } from "@/lib/icons-config";
import { cn } from "@/lib/utils";

/**
 * Menu utilisateur dans le header
 * Affiche bouton connexion ou popup compte utilisateur
 * Optimisé avec gestion d'erreur robuste et animations fluides
 */
export function HeaderUserMenu() {
	const { user, profile, loading, error } = useSidebarAuth();

	// État de chargement avec skeleton animé
	if (loading) {
		return (
			<Skeleton
				className={cn("h-8 sm:h-9 md:h-10 w-8 sm:w-9 md:w-10 rounded-full", "animate-pulse")}
				aria-label="Chargement du profil utilisateur"
			/>
		);
	}

	// État d'erreur (rare)
	if (error) {
		return (
			<Button
				variant="ghost"
				size="icon"
				className="h-8 sm:h-9 md:h-10 w-8 sm:w-9 md:w-10 text-destructive hover:text-destructive/90"
				onClick={() => window.location.reload()}
				title="Cliquez pour recharger"
				aria-label="Erreur de chargement du profil"
			>
				<Loader2 className="h-5 sm:h-6 md:h-7 w-5 sm:w-6 md:w-7 animate-spin" />
			</Button>
		);
	}

	// Utilisateur connecté - Afficher popup compte (profile peut être null si en cours de chargement)
	if (user) {
		return <UserAccountPopup user={user} profile={profile} />;
	}

	// Non connecté - Bouton connexion avec gradient RG
	return (
		<Link href="/login" className="group">
			<Button
				size="icon"
				className={cn(
					"h-8 sm:h-9 md:h-10 w-8 sm:w-9 md:w-10",
					"bg-linear-to-r from-[#a14b3f] to-gaelle-blue",
					"hover:from-[#8a3f34] hover:to-[#1e4a63]",
					"text-white font-medium shadow-md",
					"hover:shadow-lg hover:scale-105",
					"active:scale-95",
					"transition-all duration-300 ease-in-out",
					"focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#a14b3f]"
				)}
				aria-label="Se connecter à votre compte"
			>
				<UserCircle className="h-5 sm:h-6 md:h-7 w-5 sm:w-6 md:w-7 group-hover:animate-pulse" />
			</Button>
		</Link>
	);
}
