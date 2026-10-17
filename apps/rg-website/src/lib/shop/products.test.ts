import { describe, expect, it } from "bun:test";

import { formatEuros, getVariantPrice } from "./products";
import type { Product } from "./products";

const produit: Product = {
  description: "Produit de test.",
  image: "/test.webp",
  name: "Produit de test",
  priceCents: 990,
  slug: "00000000-0000-4000-8000-000000000000",
  tagline: "Produit de test.",
  tags: [],
  variants: [
    { id: "petit", label: "Petit" },
    { id: "grand", label: "Grand", priceCentsOverride: 2490 },
  ],
};

describe("getVariantPrice", () => {
  it("retombe sur le prix de base sans variante demandée", () => {
    expect(getVariantPrice(produit)).toBe(990);
  });

  it("garde le prix de base pour une variante sans surcharge", () => {
    expect(getVariantPrice(produit, "petit")).toBe(990);
  });

  it("applique la surcharge de la variante", () => {
    expect(getVariantPrice(produit, "grand")).toBe(2490);
  });

  it("ignore une variante inconnue", () => {
    expect(getVariantPrice(produit, "fantome")).toBe(990);
  });

  it("renvoie le prix de base pour un produit sans variantes", () => {
    expect(getVariantPrice({ ...produit, variants: undefined }, "grand")).toBe(990);
  });
});

describe("formatEuros", () => {
  const normalise = (texte: string) => texte.replaceAll(/\s/g, " ");

  it("n'affiche pas de décimales quand le montant tombe juste", () => {
    expect(normalise(formatEuros(2000))).toBe("20 €");
  });

  it("affiche deux décimales sinon", () => {
    expect(normalise(formatEuros(990))).toBe("9,90 €");
  });
});
