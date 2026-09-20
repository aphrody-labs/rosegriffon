"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Button } from "@rosegriffon/ui";

import { PrimeIcon } from "@/components/achillea/PrimeIcon";
import { useAchilleaAuth } from "@/lib/achillea";
import { cn } from "@/lib/utils";

/**
 * Sous-barre contextuelle d'Achilléa — les sections du domaine, rien d'autre.
 *
 * ── CE QU'ELLE NE FAIT PLUS ─────────────────────────────────────────────────
 * Elle était un en-tête complet de 64 px qui recopiait ce que le chrome Rose
 * Griffon porte déjà : logo cliquable vers l'accueil, nom du site, badge de
 * section, avatar, pseudo, bouton de déconnexion. Empilée sous la barre
 * supérieure globale (56 px) et au-dessus de ses propres onglets mobiles, elle
 * formait une TROISIÈME barre — l'audit de production relevait quatre couches
 * et trois `<nav>` sur la même page.
 *
 * Pire, les neuf liens étaient rendus DEUX FOIS : une `<nav>` `hidden lg:flex`
 * pour le bureau, une bande `lg:hidden` pour le mobile. Deux blocs de balisage
 * à maintenir en parallèle pour une seule liste, et deux occasions de diverger.
 *
 * ── CE QU'ELLE FAIT ─────────────────────────────────────────────────────────
 * Une seule bande d'onglets défilante, identique à toutes les tailles, haute de
 * 2,75 rem. Le seul contrôle de compte restant est celui qu'on ne trouve nulle
 * part ailleurs : la session ACHILLÉA, distincte de la session Rose Griffon
 * tant que les comptes ne sont pas unifiés. Le nom du site, le retour à
 * l'accueil et le thème restent du ressort du chrome global.
 */

/**
 * Noms PrimeIcons, ceux-là mêmes qu'utilise le front Angular
 * (`shared/components/header/header.ts`).
 */
export const ACHILLEA_NAV_LINKS = [
	{ exact: true, icon: "home", label: "Accueil", path: "/achillea" },
	{ icon: "users", label: "Clans", path: "/achillea/clans" },
	{ icon: "bolt", label: "Classé", path: "/achillea/ranked" },
	{ icon: "trophy", label: "Tournois", path: "/achillea/tournaments" },
	{ icon: "star", label: "Astral League", path: "/achillea/leagues/astral" },
	{ icon: "video", label: "Casts", path: "/achillea/casts" },
	{ icon: "id-card", label: "Licence", path: "/achillea/licence" },
	{ icon: "wallet", label: "Portefeuille", path: "/achillea/wallet" },
	{ icon: "book", label: "Guide", path: "/achillea/guide" },
] as const;

export function AchilleaNav() {
	const pathname = usePathname() ?? "";
	const { isAuthenticated, login, logout, user } = useAchilleaAuth();
	const isStaff = (user?.role ?? 0) >= 1;

	const onglets: readonly { icon: string; label: string; path: string; exact?: boolean }[] = [
		...ACHILLEA_NAV_LINKS,
		...(isStaff
			? [{ icon: "shield", label: "Admin", path: "/achillea/admins/dashboard" }]
			: []),
	];

	return (
		<div className="sticky top-0 z-30 flex h-11 items-center gap-2 border-b border-outline/10 bg-surface/85 px-3 backdrop-blur-md">
			{/*
			 * Défilement horizontal : sur mobile les neuf onglets dépassent. Le
			 * masque de dégradé à droite signale qu'il en reste — l'audit relevait
			 * « Licence », « Portefeuille » et « Guide » hors champ sans aucune
			 * affordance, donc introuvables.
			 */}
			<nav
				aria-label="Sections Achilléa"
				className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto scrollbar-none [mask-image:linear-gradient(to_right,black_calc(100%-1.5rem),transparent)]"
			>
				{onglets.map((onglet) => {
					const actif = onglet.exact
						? pathname === onglet.path
						: pathname === onglet.path || pathname.startsWith(`${onglet.path}/`);

					return (
						<Link
							aria-current={actif ? "page" : undefined}
							className={cn(
								"inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors",
								actif
									? "bg-[var(--achillea-primary)] text-white"
									: "text-on-surface-variant hover:bg-surface-variant/40 hover:text-on-surface"
							)}
							href={onglet.path}
							key={onglet.path}
						>
							<PrimeIcon className="text-sm" name={onglet.icon} />
							<span>{onglet.label}</span>
						</Link>
					);
				})}
			</nav>

			{/*
			 * Session Achilléa. Elle reste distincte de la session Rose Griffon —
			 * ce n'est donc pas un doublon du menu de compte global, et c'est le
			 * seul endroit où elle est visible. Un contrôle unique, là où il y en
			 * avait quatre.
			 */}
			<div className="shrink-0">
				{isAuthenticated && user ? (
					<Button
						aria-label={`Session Achilléa : ${user.username}. Se déconnecter.`}
						className="size-8 text-on-surface-variant hover:text-alerte"
						onClick={() => void logout()}
						size="icon"
						title={`${user.username} — se déconnecter`}
						variant="ghost"
					>
						<PrimeIcon className="text-sm" name="sign-out" />
					</Button>
				) : (
					<Button
						className="h-8 gap-1.5 rounded-lg bg-[var(--discord-blurple)] px-2.5 text-xs font-bold text-white hover:bg-[var(--discord-blurple-hover)]"
						onClick={() => login(pathname || "/achillea")}
						size="sm"
					>
						<PrimeIcon className="text-sm" name="sign-in" />
						<span className="max-sm:sr-only">Connexion</span>
					</Button>
				)}
			</div>
		</div>
	);
}
