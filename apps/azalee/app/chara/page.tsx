export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { parseSearchParams } from "@/lib/validations";
import { wikiService } from "@/lib/wiki-service";
import { PlayersClient } from "./players-client";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}): Promise<Metadata> {
  const rawParams = await searchParams;
  const { q, element, position, rarity, page } = parseSearchParams(rawParams);

  let title = "Liste des Joueurs";
  const filters: string[] = [];

  if (q) filters.push(`"${q}"`);
  if (element) filters.push(element.toString());
  if (position) filters.push(position.toString());
  if (rarity) filters.push(rarity.toString());

  if (filters.length > 0) {
    title += ` : ${filters.join(", ")}`;
  }

  const pageNum = page ? parseInt(page.toString(), 10) : 1;
  if (pageNum > 1) {
    title += ` (Page ${pageNum})`;
  }

  return {
    title: `${title} | Inazuma Eleven Victory Road - Azalée`,
    description: `Base de données des joueurs Inazuma Eleven: Victory Road. ${filters.length > 0 ? `Filtres : ${filters.join(", ")}. ` : ""}Retrouvez les stats, techniques et méthodes de recrutement de tous les personnages.`,
    alternates: {
      canonical: `/chara${rawParams ? `?${new URLSearchParams(rawParams as Record<string, string>).toString()}` : ""}`,
    },
    openGraph: {
      title: `${title} | Azalée`,
      description: "Encyclopédie complète Inazuma Eleven Victory Road",
      url: "/chara",
      siteName: "Azalée - Inazuma Eleven Victory Road Wiki",
      locale: "fr_FR",
      type: "website",
    },
  };
}

const DEFAULT_PER_PAGE = 200;
const ALLOWED_PER_PAGE = [50, 200];

export default async function PlayersPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const rawParams = await searchParams;
  const params = parseSearchParams(rawParams);
  const { q, element, position, rarity, gender, team, playstyle, series, status, role, page, perPage } =
    params;

  const pageNumber = page ? parseInt(page.toString(), 10) : 1;
  const itemsPerPage =
    perPage && ALLOWED_PER_PAGE.includes(Number(perPage)) ? Number(perPage) : DEFAULT_PER_PAGE;

  // Data First: Fetch paginated data from DB
  const { data: characters, total } = await wikiService.getCharactersList({
    q: q?.toString(),
    element: element?.toString(),
    position: position?.toString(),
    rarity: rarity?.toString(),
    gender: gender?.toString(),
    team: team?.toString(),
    playstyle: playstyle?.toString(),
    series: series?.toString(),
    status: status?.toString(),
    role: role?.toString(),
    page: pageNumber,
    limit: itemsPerPage,
  });

  // Fetch filter options
  const teams = await wikiService.getAllTeams();

  const collectionJsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Personnages - Inazuma Eleven: Victory Road",
    description: `Base de données de ${total.toLocaleString("fr-FR")} joueurs Inazuma Eleven: Victory Road.`,
    url: "https://azalee.rosegriffon.fr/chara",
    isPartOf: { "@type": "WebSite", name: "Azalée", url: "https://azalee.rosegriffon.fr" },
    numberOfItems: total,
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: total,
      itemListElement: characters.slice(0, 10).map((c, i) => ({
        "@type": "ListItem",
        position: (pageNumber - 1) * itemsPerPage + i + 1,
        url: `https://azalee.rosegriffon.fr/chara/${c.slug || c.charaId}`,
        name: c.names?.fr || c.names?.en || "Joueur",
      })),
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionJsonLd) }}
      />
      <PlayersClient
        paginatedCharacters={characters}
        totalItems={total}
        itemsPerPage={itemsPerPage}
        currentPage={pageNumber}
        allVariantsCount={total}
        teams={teams}
        showIncomplete={status === "all"}
        showControllable={status === "jouable"}
      />
    </>
  );
}
