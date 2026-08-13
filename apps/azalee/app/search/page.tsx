export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { parseSearchParams } from "@/lib/validations";
import { SearchClient } from "./search-client";

export async function generateMetadata({
	searchParams,
}: {
	searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
	const { q } = parseSearchParams(await searchParams);

	return {
		// La requête reste dans le canonique (chaque recherche est une page distincte) ;
		// sans `q`, on canonicalise vers l'URL nue — jamais vers un `/search?` vide.
		alternates: { canonical: q ? `/search?q=${encodeURIComponent(q.toString())}` : "/search" },
		description:
			"Explorez la base de données complète : joueurs, techniques, hyper techniques, objets, passifs, tactiques et équipes.",
		title: q
			? `"${q}" - Recherche | Azalée`
			: "Encyclopédie | Inazuma Eleven Victory Road - Azalée",
	};
}

export default async function SearchPage({
	searchParams,
}: {
	searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
	const { q } = parseSearchParams(await searchParams);

	return <SearchClient defaultQuery={q?.toString()} />;
}
