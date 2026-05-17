export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { parseSearchParams } from "@/lib/validations";
import { SearchClient } from "./search-client";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}): Promise<Metadata> {
  const { q } = parseSearchParams(await searchParams);

  return {
    title: q
      ? `"${q}" - Recherche | Azalée`
      : "Encyclopédie | Inazuma Eleven Victory Road - Azalée",
    description:
      "Explorez la base de données complète : joueurs, techniques, hyper techniques, objets, passifs, tactiques et équipes.",
  };
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { q } = parseSearchParams(await searchParams);

  return <SearchClient defaultQuery={q?.toString()} />;
}
