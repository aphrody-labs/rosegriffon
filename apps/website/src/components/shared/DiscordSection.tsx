"use client";

import { Button, DiscordIcon } from "@rosegriffon/ui";
import Image from "next/image";
import { useEffect, useState } from "react";

import RgEmote from "@/components/shared/emotes/RgEmote";

/**
 * Section « communauté Discord » — implémentation UNIQUE du bloc Discord.
 *
 * Elle remplace l'ancien couple `DiscordBlock` (coquille + widget) et le corps
 * éditorial recopié dans `app/page.tsx` : les deux se partageaient un même bloc
 * en double, avec deux boutons « Rejoindre » et deux logos concurrents.
 *
 * Thème : toutes les surfaces et tous les textes passent par les tokens
 * (`bg-card`, `bg-muted`, `text-foreground`, `border-border`…), donc la section
 * suit les thèmes Roy, Gaëlle et Azalée. Seule l'identité de marque Discord —
 * le logo et l'aplat d'accent du bouton — conserve `bg-discord` / `text-discord`,
 * constantes de marque exposées en tokens par `@rosegriffon/ui`.
 */

/** Serveur Rose Griffon interrogé via le widget public de Discord. */
const ID_SERVEUR_DISCORD = "1072991720268111892";

/** Invitation unique de la communauté (le widget n'en renvoie pas toujours). */
export const INVITATION_DISCORD = "https://discord.gg/8X8eQfBMkt";

/** Points forts affichés sous la description. */
const ATOUTS = ["Discussion", "Gaming", "Événements"] as const;

/** Pastilles de présence — tokens sémantiques, jamais `bg-green-500` & co. */
const COULEUR_STATUT: Record<string, string> = {
	dnd: "bg-destructive",
	idle: "bg-alerte",
	offline: "bg-muted-foreground",
	online: "bg-succes",
};

interface MembreDiscord {
	id: string;
	username: string;
	avatar_url?: string;
	status: "online" | "idle" | "dnd" | "offline";
}

interface DonneesWidget {
	name: string;
	presence_count: number;
	member_count: number;
	instant_invite: string | null;
	members: MembreDiscord[];
}

interface DiscordSectionProps {
	/** Titre de la section (réglage `home_community_title`). */
	titre: string;
	/** Phrase d'accroche sous le titre (réglage `home_community_subtitle`). */
	sousTitre: string;
	/** Surtitre de la carte (réglage `home_community_description`). */
	accroche: string;
	/** Lien d'invitation, surchargeable depuis les réglages. */
	lienInvitation?: string;
}

/** Colonne de droite : membres en ligne, via le widget public du serveur. */
function WidgetDiscord({
	donnees,
	chargement,
	erreur,
	lienInvitation,
}: {
	donnees: DonneesWidget | null;
	chargement: boolean;
	erreur: boolean;
	lienInvitation: string;
}) {
	if (chargement) {
		return (
			<div className="flex size-full flex-col items-center justify-center gap-3 p-6 text-muted-foreground">
				<div className="size-10 animate-spin rounded-full border-2 border-border border-b-primary" />
				<p className="text-sm">Chargement du widget Discord…</p>
			</div>
		);
	}

	if (erreur || !donnees) {
		return (
			<div className="flex size-full flex-col items-center justify-center gap-4 p-6 text-center">
				<p className="text-base font-semibold text-foreground">Widget Discord indisponible</p>
				<p className="max-w-xs text-sm text-muted-foreground">
					Le widget ne peut pas être chargé pour le moment, mais l&apos;invitation reste ouverte.
				</p>
				<Button asChild className="bg-discord font-bold text-rg-sur-marine hover:bg-discord/90">
					<a href={lienInvitation} target="_blank" rel="noopener noreferrer">
						<DiscordIcon className="mr-2 size-4" />
						Rejoindre le Discord
					</a>
				</Button>
			</div>
		);
	}

	return (
		<div className="flex size-full flex-col p-4 sm:p-5">
			<div className="mb-4 flex flex-wrap items-center justify-between gap-3">
				<h3 className="text-base font-bold text-foreground sm:text-lg">{donnees.name}</h3>
				<Button
					asChild
					size="sm"
					className="bg-discord font-bold text-rg-sur-marine hover:bg-discord/90"
				>
					<a
						href={donnees.instant_invite ?? lienInvitation}
						target="_blank"
						rel="noopener noreferrer"
					>
						Rejoindre
					</a>
				</Button>
			</div>

			<p className="mb-3 text-sm text-muted-foreground">
				<span className="font-semibold text-foreground">{donnees.presence_count}</span> en ligne
				{" • "}
				<span className="font-semibold text-foreground">{donnees.member_count}</span> membres
				visibles
			</p>

			<ul className="min-h-0 grow space-y-2 overflow-y-auto pr-1">
				{donnees.members.map((membre) => (
					<li key={membre.id} className="flex items-center gap-3">
						<div className="relative shrink-0">
							<Image
								src={membre.avatar_url || "/default-avatar.webp"}
								alt=""
								width={32}
								height={32}
								className="size-8 rounded-full object-cover"
								unoptimized
							/>
							<span
								className={`absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-muted ${
									COULEUR_STATUT[membre.status] ?? COULEUR_STATUT.offline
								}`}
							/>
						</div>
						<span className="truncate text-sm text-foreground">{membre.username}</span>
					</li>
				))}
			</ul>
		</div>
	);
}

export default function DiscordSection({
	titre,
	sousTitre,
	accroche,
	lienInvitation = INVITATION_DISCORD,
}: DiscordSectionProps) {
	const [donnees, setDonnees] = useState<DonneesWidget | null>(null);
	const [chargement, setChargement] = useState(true);
	const [erreur, setErreur] = useState(false);

	useEffect(() => {
		let annule = false;

		const recuperer = async () => {
			try {
				const reponse = await fetch(
					`https://discord.com/api/guilds/${ID_SERVEUR_DISCORD}/widget.json`
				);
				if (!reponse.ok) {
					throw new Error(`Widget Discord indisponible (${reponse.status})`);
				}
				const brut = await reponse.json();
				if (annule) {
					return;
				}
				setDonnees({
					instant_invite: brut.instant_invite ?? null,
					member_count: brut.members?.length ?? 0,
					members: (brut.members ?? []).map((m: MembreDiscord) => ({
						avatar_url: m.avatar_url,
						id: m.id,
						status: m.status ?? "offline",
						username: m.username,
					})),
					name: brut.name,
					presence_count: brut.presence_count ?? 0,
				});
			} catch (error) {
				if (!annule) {
					console.error("Récupération du widget Discord impossible :", error);
					setErreur(true);
				}
			} finally {
				if (!annule) {
					setChargement(false);
				}
			}
		};

		void recuperer();

		return () => {
			annule = true;
		};
	}, []);

	return (
		<div className="w-full space-y-6 md:space-y-8">
			<div className="mx-auto max-w-7xl space-y-2 px-4 text-center">
				<h2 id="community-heading" className="text-2xl font-bold text-foreground md:text-3xl">
					{titre}
				</h2>
				<p className="mx-auto max-w-2xl text-base text-muted-foreground md:text-lg">{sousTitre}</p>
			</div>

			<div className="mx-auto w-full max-w-7xl px-4">
				<div className="grid w-full overflow-hidden rounded-3xl border border-border bg-card shadow-lg transition-shadow duration-300 hover:shadow-xl lg:grid-cols-2">
					{/* Contenu éditorial */}
					<div className="order-2 flex flex-col justify-center gap-4 p-6 sm:p-8 lg:order-1 lg:p-10">
						<div className="flex items-center gap-3">
							<div className="rounded-xl bg-discord/10 p-2.5">
								<RgEmote name="roy-salut" size={32} animated className="size-8" />
							</div>
							<div className="min-w-0">
								<h3 className="text-xl font-bold text-discord">Discord</h3>
								<p className="truncate text-xs font-medium text-muted-foreground">{accroche}</p>
							</div>
						</div>

						<p className="text-base leading-relaxed text-muted-foreground">
							Rejoignez notre serveur Discord pour discuter avec la communauté Rose Griffon,
							participer à nos événements et rester informés de toutes nos actualités en temps réel.
						</p>

						<ul className="flex flex-wrap gap-2">
							{ATOUTS.map((atout) => (
								<li
									key={atout}
									className="rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground"
								>
									{atout}
								</li>
							))}
						</ul>

						<div className="pt-1">
							<Button
								asChild
								className="h-10 w-full bg-discord font-bold text-rg-sur-marine hover:bg-discord/90 sm:w-auto"
							>
								<a href={lienInvitation} target="_blank" rel="noopener noreferrer">
									<DiscordIcon className="mr-2 size-4" />
									Rejoindre le serveur
								</a>
							</Button>
						</div>
					</div>

					{/* Widget des membres en ligne */}
					<div className="order-1 h-[22rem] border-b border-border bg-muted sm:h-[26rem] lg:order-2 lg:h-[31.25rem] lg:border-b-0 lg:border-l">
						<WidgetDiscord
							donnees={donnees}
							chargement={chargement}
							erreur={erreur}
							lienInvitation={lienInvitation}
						/>
					</div>
				</div>
			</div>
		</div>
	);
}
