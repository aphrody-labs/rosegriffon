// SPDX-License-Identifier: Apache-2.0
// Les produits viennent de `merch_products` (base) ; les types et helpers de prix
// sont partagés via @rosegriffon/types. Aucun produit n'est écrit en dur.
import { getPgPool } from "@rosegriffon/db/pg";
import type { Product } from "@rosegriffon/types/shop";

export * from "@rosegriffon/types/shop";

interface LigneProduit {
  id: string;
  name: string;
  description: string | null;
  price: string | number;
  image_url: string | null;
}

function versProduit(ligne: LigneProduit): Product {
  const description = ligne.description?.trim() ?? "";
  return {
    description,
    image: ligne.image_url ?? "",
    name: ligne.name,
    priceCents: Math.round(Number(ligne.price) * 100),
    slug: ligne.id,
    tagline: description.split(/(?<=[.!?])\s/)[0] ?? "",
    tags: [],
  };
}

/** Produits actifs, du plus récent au plus ancien. Vide si la table l'est. */
export async function listerProduits(): Promise<Product[]> {
  const { rows } = await getPgPool().query<LigneProduit>(
    "SELECT id, name, description, price, image_url FROM merch_products WHERE is_active = true ORDER BY created_at DESC",
  );
  return rows.map(versProduit);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getProduct(slug: string): Promise<Product | undefined> {
  if (!UUID.test(slug)) return undefined;
  const { rows } = await getPgPool().query<LigneProduit>(
    "SELECT id, name, description, price, image_url FROM merch_products WHERE is_active = true AND id = $1",
    [slug],
  );
  return rows[0] ? versProduit(rows[0]) : undefined;
}
