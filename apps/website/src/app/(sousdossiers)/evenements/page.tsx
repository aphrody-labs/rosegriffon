"use client";

// External libraries
import { useState } from "react";

import { BreadcrumbSchema } from "@/components/shared/StructuredData";
import { Calendar, MapPin, Search, Tag, X } from "@/lib/icons-config";
import DiscordIcon from "@/shared/icons/discord";

// Internal components
import DiscordEventsList from "./_components/DiscordEventsList";
import EventsList from "./_components/EventsList";
import GoogleMapEvents from "./_components/GoogleMapEvents";
// Hooks
import { useDiscordEvents } from "./useDiscordEvents";
import { useEvents } from "./useEvents";

/**
 * Champ de recherche partagé par les deux listes (à venir / passés) : une seule
 * saisie filtre l'ensemble, d'où le bouton de réinitialisation commun.
 */
function EventSearch({
	value,
	onChange,
	onReset,
	label,
}: {
	value: string;
	onChange: (next: string) => void;
	onReset: () => void;
	label: string;
}) {
	return (
		<div className="flex w-full items-center gap-2 md:w-auto">
			<div className="relative flex-1 md:flex-initial">
				<Search
					className="absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground"
					aria-hidden
				/>
				<input
					type="search"
					placeholder="Rechercher…"
					aria-label={label}
					className="w-full rounded-xl border-2 border-input bg-background py-3 pr-4 pl-10 text-foreground transition-all placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:outline-hidden md:w-64"
					value={value}
					onChange={(e) => onChange(e.target.value)}
				/>
			</div>
			{value && (
				<button
					type="button"
					onClick={onReset}
					className="flex items-center gap-2 rounded-xl bg-muted px-4 py-3 text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
				>
					<X className="size-5" aria-hidden />
					<span className="hidden sm:inline">Réinitialiser</span>
				</button>
			)}
		</div>
	);
}

/** En-tête de section : pastille d'icône + titre + sous-titre. */
function SectionHeading({
	icon,
	iconClassName,
	title,
	subtitle,
	action,
}: {
	icon: React.ReactNode;
	iconClassName: string;
	title: string;
	subtitle?: string;
	action?: React.ReactNode;
}) {
	return (
		<div className="mb-6 flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
			<div className="flex items-center gap-3">
				<div className={`rounded-lg p-2 shadow-lg ${iconClassName}`}>{icon}</div>
				<div>
					<h2 className="text-3xl font-bold text-foreground md:text-4xl">{title}</h2>
					{subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
				</div>
			</div>
			{action}
		</div>
	);
}

/** Carte de section : surface thématisée, jamais un blanc codé en dur. */
function SectionCard({ children }: { children: React.ReactNode }) {
	return (
		<section className="rounded-2xl border border-border bg-card p-6 shadow-xl transition-shadow duration-300 hover:shadow-2xl">
			{children}
		</section>
	);
}

export default function PresencesPage() {
	const { events, isLoading } = useEvents();
	const { events: discordEvents, isLoading: isLoadingDiscord } = useDiscordEvents();
	const [searchFilter, setSearchFilter] = useState("");

	// Filtrer par recherche (tous les événements)
	const filteredEvents = searchFilter
		? events.filter(
				(event) =>
					event.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
					event.category.toLowerCase().includes(searchFilter.toLowerCase())
			)
		: events;

	// Filtrer uniquement les événements à venir parmi les événements filtrés
	const upcomingFilteredEvents = filteredEvents.filter(
		(event) => event.type === "upcoming" || event.type === "today"
	);

	const pastFilteredEvents = filteredEvents.filter((event) => event.type === "past");

	const conventionsCount = events.filter((e) => e.category === "Conventions").length;

	// Fonction pour réinitialiser le filtre
	const resetFilter = () => setSearchFilter("");
	const filterConventions = () => setSearchFilter("Convention");

	return (
		<div className="container mx-auto space-y-12 px-4 py-8">
			<BreadcrumbSchema
				items={[
					{ item: "/", name: "Accueil" },
					{ item: "/evenements", name: "Événements" },
				]}
			/>

			{/* Hero — DA Rose Griffon : marine, brique, or. Volontairement constant
			    d'un thème à l'autre : c'est une bannière de marque, pas une surface. */}
			<div className="relative overflow-hidden rounded-3xl bg-linear-to-br from-rg-marine via-rg-marine-clair to-rg-brique p-6 shadow-2xl xs:p-8 md:p-12 lg:p-16">
				<div className="absolute inset-0 bg-grid-white/[0.05] bg-[size:20px_20px]" />
				<div className="relative z-10">
					<div className="mb-4 flex items-center gap-3">
						<Calendar className="size-7 shrink-0 text-rg-or md:size-8" aria-hidden />
						<span className="text-xs font-semibold tracking-wide text-rg-or uppercase sm:text-sm md:text-base">
							{isLoading
								? "Chargement du calendrier…"
								: `${conventionsCount} convention${conventionsCount > 1 ? "s" : ""} répertoriée${conventionsCount > 1 ? "s" : ""}`}
						</span>
					</div>
					<h1 className="mb-4 text-fluid-display-lg font-bold tracking-tight text-rg-sur-marine md:mb-6">
						Événements Rose Griffon
					</h1>
					<p className="max-w-3xl text-fluid-body-lg leading-relaxed text-rg-sur-marine/85">
						Retrouvez Rose Griffon lors de différents événements tout au long de l&apos;année. Notre
						association participe à de nombreux évènements pour promouvoir nos activités et
						rencontrer notre public.
					</p>

					{conventionsCount > 0 && (
						<div className="mt-8 flex flex-wrap gap-3">
							<button
								type="button"
								onClick={filterConventions}
								className="flex min-h-11 items-center gap-2 rounded-full border border-rg-or/60 bg-rg-sur-marine/10 px-6 py-2.5 text-sm font-bold text-rg-sur-marine backdrop-blur-sm transition-all hover:border-rg-or hover:bg-rg-sur-marine/20"
							>
								<Tag className="size-4 shrink-0" aria-hidden />
								Voir uniquement les Conventions
							</button>
						</div>
					)}
				</div>
			</div>

			{/* Carte des événements */}
			<SectionCard>
				<SectionHeading
					icon={<MapPin className="size-6" aria-hidden />}
					iconClassName="bg-primary text-primary-foreground shadow-primary/20"
					title="Carte des événements"
					subtitle="Localisez Rose Griffon sur la carte de France"
				/>
				<GoogleMapEvents events={events} isLoading={isLoading} />
			</SectionCard>

			{/* Événements Discord */}
			<SectionCard>
				<SectionHeading
					icon={<DiscordIcon className="size-6" aria-hidden />}
					iconClassName="bg-discord text-rg-sur-marine shadow-discord/20"
					title="Événements Discord"
					subtitle="Rejoignez-nous lors de nos événements communautaires sur Discord"
				/>
				<DiscordEventsList events={discordEvents} isLoading={isLoadingDiscord} />
			</SectionCard>

			{/* Recherche UNIQUE : elle pilote les deux listes ci-dessous. Un second
			    champ par section partagerait le même state — deux contrôles pour une
			    seule valeur, donc deux fois le même bouton de réinitialisation. */}
			<SectionCard>
				<SectionHeading
					icon={<Calendar className="size-6" aria-hidden />}
					iconClassName="bg-secondary text-secondary-foreground shadow-secondary/20"
					title="Prochains événements"
					subtitle={
						searchFilter
							? `Filtre actif : « ${searchFilter} » — ${upcomingFilteredEvents.length} à venir, ${pastFilteredEvents.length} passé(s)`
							: undefined
					}
					action={
						<EventSearch
							value={searchFilter}
							onChange={setSearchFilter}
							onReset={resetFilter}
							label="Rechercher parmi tous les événements"
						/>
					}
				/>
				<EventsList
					events={upcomingFilteredEvents}
					isLoading={isLoading}
					isFiltered={!!searchFilter}
				/>
			</SectionCard>

			{/* Liste des événements passés */}
			<SectionCard>
				<SectionHeading
					icon={<Calendar className="size-6" aria-hidden />}
					iconClassName="bg-muted text-muted-foreground shadow-black/5"
					title="Événements passés"
				/>
				<EventsList events={pastFilteredEvents} isLoading={isLoading} isFiltered={!!searchFilter} />
			</SectionCard>
		</div>
	);
}
