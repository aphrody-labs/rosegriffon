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
    <div className="container mx-auto py-8 px-4 space-y-12">
      <BreadcrumbSchema
        items={[
          { name: "Accueil", item: "/" },
          { name: "Événements", item: "/evenements" },
        ]}
      />
      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-3xl bg-linear-to-br from-gaelle-blue via-blue-600 to-purple-600 p-8 md:p-12 lg:p-16 shadow-2xl">
        <div className="absolute inset-0 bg-grid-white/[0.05] bg-[size:20px_20px]" />
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <Calendar className="size-8 text-yellow-300" />
            <span className="text-yellow-300 font-semibold text-sm md:text-base uppercase tracking-wide">
              {conventionsCount} Conventions répertoriées
            </span>
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 text-white tracking-tight">
            Événements Rose Griffon
          </h1>
          <p className="text-lg md:text-xl text-blue-50 max-w-3xl leading-relaxed opacity-90">
            Retrouvez Rose Griffon lors de différents événements tout au long de l&apos;année. Notre
            association participe à de nombreux évènements pour promouvoir nos activités et
            rencontrer notre public.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <button
              onClick={filterConventions}
              className="px-6 py-2.5 bg-muted hover:bg-muted border border-border rounded-full text-white text-sm font-bold backdrop-blur-sm transition-all flex items-center gap-2"
            >
              <Tag className="size-4" />
              Voir uniquement les Conventions
            </button>
          </div>
        </div>
      </div>

      {/* Carte des événements */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl p-6 border-2 border-blue-500/30 hover:shadow-2xl transition-all duration-300">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-lg bg-blue-600 text-white shadow-lg shadow-blue-500/20">
            <MapPin className="size-6" />
          </div>
          <div>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white">
              Carte des événements
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Localisez Rose Griffon sur la carte de France
            </p>
          </div>
        </div>
        <GoogleMapEvents events={events} isLoading={isLoading} />
      </div>

      {/* Événements Discord */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl p-6 border-2 border-purple-500/30 hover:shadow-2xl transition-all duration-300">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-lg bg-purple-600 text-white shadow-lg shadow-purple-500/20">
            <DiscordIcon className="size-6" />
          </div>
          <div>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white">
              Événements Discord
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Rejoignez-nous lors de nos événements communautaires sur Discord
            </p>
          </div>
        </div>
        <DiscordEventsList events={discordEvents} isLoading={isLoadingDiscord} />
      </div>

      {/* Liste des événements à venir */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl p-6 border-2 border-green-500/30 hover:shadow-2xl transition-all duration-300">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-500 text-white shadow-lg shadow-green-500/20">
              <Calendar className="size-6" />
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white">
              Prochains événements
            </h2>
          </div>
          <div className="flex items-center gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:flex-initial">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-gray-400" />
              <input
                type="text"
                placeholder="Rechercher..."
                className="pl-10 pr-4 py-3 border-2 border-gray-200 dark:border-gray-700 rounded-xl w-full md:w-64 focus:border-green-500 focus:ring-2 focus:ring-green-500/20 transition-all dark:bg-gray-800 dark:text-white"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
              />
            </div>
            {searchFilter && (
              <button
                onClick={resetFilter}
                className="px-4 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex items-center gap-2"
              >
                <X className="size-5" />
                <span className="hidden sm:inline">Réinitialiser</span>
              </button>
            )}
          </div>
        </div>
        <EventsList events={upcomingFilteredEvents} isLoading={isLoading} />
      </div>

      {/* Liste des événements passés */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl p-6 border-2 border-red-500/30 hover:shadow-2xl transition-all duration-300">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-500 text-white shadow-lg shadow-red-500/20">
              <Calendar className="size-6" />
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white">
              Événements passés
            </h2>
          </div>
          <div className="flex items-center gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:flex-initial">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-gray-400" />
              <input
                type="text"
                placeholder="Rechercher..."
                className="pl-10 pr-4 py-3 border-2 border-gray-200 dark:border-gray-700 rounded-xl w-full md:w-64 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 transition-all dark:bg-gray-800 dark:text-white"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
              />
            </div>
            {searchFilter && (
              <button
                onClick={resetFilter}
                className="px-4 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex items-center gap-2"
              >
                <X className="size-5" />
                <span className="hidden sm:inline">Réinitialiser</span>
              </button>
            )}
          </div>
        </div>
        <EventsList events={pastFilteredEvents} isLoading={isLoading} />
      </div>
    </div>
  );
}
