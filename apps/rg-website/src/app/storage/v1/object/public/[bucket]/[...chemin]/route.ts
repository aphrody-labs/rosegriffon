// SPDX-License-Identifier: Apache-2.0
// Objets publics du stockage sur l'origine du site (URL relatives enregistrées en base).
// Remplace la réécriture `next.config.ts` vers rg-core / Supabase, qui recopiait le `400`
// « NoSuchKey » de Supabase pour un objet absent : ici, absent = 404.
import { relayerObjet } from "@/lib/storage-proxy";
import { rgUrl } from "@rosegriffon/config/rg-urls";

type Contexte = { params: Promise<{ bucket: string; chemin: string[] }> };

function origines() {
  return {
    medias: rgUrl(process.env, "cdn", "RG_MEDIA_PUBLIC_ORIGIN").trim(),
    supabase: process.env.NEXT_PUBLIC_SUPABASE_URL?.trim(),
  };
}

export async function GET(requete: Request, { params }: Contexte): Promise<Response> {
  const { bucket, chemin } = await params;
  return relayerObjet(requete, bucket, chemin, origines());
}

export const HEAD = GET;
