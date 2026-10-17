import { Suspense } from "react";

import { listerProduits } from "@/lib/shop/products";
import { PacksPatreon } from "./_components/packs-patreon";
import { PatreonDiscountBanner } from "./_components/patreon-discount-banner";
import { ProductCard } from "./_components/product-card";

export const dynamic = "force-dynamic";

export default async function ShopIndexPage() {
  const produits = await listerProduits().catch(() => []);

  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 pt-4 min-[600px]:px-6 min-[600px]:pt-6">
      <section className="mb-6 grid gap-4 border-b border-rg-or/30 pb-4 min-[840px]:grid-cols-12 min-[840px]:items-center">
        <header className="min-[840px]:col-span-8">
          <h1 className="text-2xl font-extrabold tracking-tight text-white min-[840px]:text-3xl">
            Boutique <span className="text-rg-or">Rose Griffon</span>
          </h1>
        </header>

        <aside className="min-[840px]:col-span-4">
          <Suspense
            fallback={<div className="h-24 animate-pulse rounded-2xl border-2 border-rg-or/30 bg-rg-marine/60" />}
          >
            <PatreonDiscountBanner />
          </Suspense>
        </aside>
      </section>

      {produits.length > 0 ? (
        <section
          aria-label="Catalogue produits"
          className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        >
          {produits.map(p => (
            <ProductCard key={p.slug} product={p} />
          ))}
        </section>
      ) : (
        <p className="mb-6 rounded-2xl border border-rg-or/30 bg-rg-marine/60 p-4 text-sm text-white/80">
          La vente en ligne n'a pas encore ouvert : aucun produit n'est en vente pour le moment.
        </p>
      )}

      <div className={produits.length > 0 ? "mt-10" : undefined}>
        <PacksPatreon />
      </div>
    </div>
  );
}
