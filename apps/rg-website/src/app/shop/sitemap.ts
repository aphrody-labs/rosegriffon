import type { MetadataRoute } from "next";

import { listerProduits } from "@/lib/shop/products";
import { SITE_URL } from "@/lib/site-url";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const produits = await listerProduits().catch(() => []);
  // Même origine que `app/sitemap.ts`, `app/robots.ts` et `app/wiki/sitemap.ts` :
  // dérivée de `NEXT_PUBLIC_BASE_URL`, pas figée. Ce fichier avait sa propre
  // constante en dur, seul des quatre plans de site à ne pas suivre l'env.
  const baseUrl = SITE_URL;
  const now = new Date();
  return [
    {
      changeFrequency: "weekly",
      lastModified: now,
      priority: 0.9,
      url: `${baseUrl}/shop`,
    },
    // `/shop/panier` a été retiré : le panier est en `noindex` (état personnel,
    // vide pour un robot). Le laisser ici revenait à demander l'indexation d'une
    // page qui refuse d'être indexée.
    ...produits.map(p => ({
      changeFrequency: "monthly" as const,
      lastModified: now,
      priority: 0.7,
      url: `${baseUrl}/shop/${p.slug}`,
    })),
  ];
}
