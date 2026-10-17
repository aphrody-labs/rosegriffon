/**
 * Types et helpers du catalogue Rose Griffon. Les produits vivent en base
 * (`merch_products`) ; aucun produit n'est écrit en dur.
 *
 * Convention prix : `priceCents` en centimes d'euros (Stripe-native).
 * Chaque produit peut avoir des `variants` (taille, artiste, etc.) qui agissent
 * comme des SKUs séparés au checkout. Si pas de variant, l'achat est direct.
 *
 * Images : référencer un asset déjà présent dans `apps/website/public/`.
 * `tags` servent au filtrage côté UI (chip filter dans /shop).
 */

export type ProductCategory =
  "pack-patreon" | "print" | "sticker" | "marque-page" | "badge" | "textile" | "affiche" | "carte" | "digital";

export interface ProductVariant {
  id: string;
  label: string;
  priceCentsOverride?: number;
  image?: string;
}

export interface Product {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  priceCents: number;
  /** Absente tant que `merch_products` ne porte pas de catégorie. */
  category?: ProductCategory;
  image: string;
  gallery?: string[];
  variants?: ProductVariant[];
  tags: string[];
  /** Propriété du produit (tirage limité, précommande) — jamais un état de stock inventé. */
  stockHint?: "preorder" | "limited";
  patreonExclusive?: boolean;
  highlights?: string[];
}

export function getVariantPrice(product: Product, variantId?: string): number {
  if (!variantId || !product.variants) {
    return product.priceCents;
  }
  const v = product.variants.find(v => v.id === variantId);
  return v?.priceCentsOverride ?? product.priceCents;
}

export const CATEGORY_LABELS: Record<ProductCategory, string> = {
  affiche: "Affiches",
  badge: "Badges",
  carte: "Cartes",
  digital: "Digital",
  "marque-page": "Marque-pages",
  "pack-patreon": "Packs Patreon",
  print: "Prints",
  sticker: "Stickers",
  textile: "Textile",
};

export function formatEuros(cents: number): string {
  return new Intl.NumberFormat("fr-FR", {
    currency: "EUR",
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    style: "currency",
  }).format(cents / 100);
}
