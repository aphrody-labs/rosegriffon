import Image from "next/image";
import Link from "next/link";

import { formatEuros, CATEGORY_LABELS } from "@/lib/shop/products";
import type { Product } from "@/lib/shop/products";

const STOCK_LABEL = {
  limited: "Édition limitée",
  preorder: "Précommande",
} as const;

const STOCK_TONE: Record<keyof typeof STOCK_LABEL, string> = {
  limited: "bg-rose-200 text-rose-900 border-rose-400",
  preorder: "bg-sky-100 text-sky-800 border-sky-300",
};

export function ProductCard({ product }: { product: Product }) {
  const hasVariants = (product.variants?.length ?? 0) > 0;
  return (
    <Link
      href={`/shop/${product.slug}`}
      className="group relative isolate flex flex-col overflow-hidden rounded-3xl border-2 border-rg-or/40 bg-rg-marine text-white shadow-[0_4px_0_0_rgba(0,0,0,0.5)] transition-all motion-safe:duration-300 hover:-translate-y-1 hover:shadow-[0_8px_0_0_rgba(0,0,0,0.6)] hover:border-rg-or"
    >
      {/* Visual */}
      <div className="relative aspect-[4/3] overflow-hidden bg-rg-marine">
        <Image
          src={product.image}
          alt={product.name}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          className="object-cover transition-transform motion-safe:duration-500 group-hover:scale-105"
        />
        {/* Vignette */}
        <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-rg-marine via-transparent to-transparent" />
        {/* Stock badge */}
        {product.stockHint && (
          <span
            className={`absolute right-3 top-3 inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider shadow-md ${STOCK_TONE[product.stockHint]}`}
          >
            {STOCK_LABEL[product.stockHint]}
          </span>
        )}
        {/* Category tag */}
        <span className="absolute left-3 top-3 inline-flex items-center rounded-full border border-white/40 bg-rg-marine/80 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-rg-or backdrop-blur">
          {CATEGORY_LABELS[product.category]}
        </span>
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div>
          <h3 className="font-bold leading-tight text-white text-lg">{product.name}</h3>
          <p className="mt-1 text-sm text-white/70">{product.tagline}</p>
        </div>

        <div className="mt-auto flex items-end justify-between gap-3">
          <div>
            <span className="block text-[10px] font-bold uppercase tracking-widest text-rg-or">
              {hasVariants ? "À partir de" : "Prix"}
            </span>
            <span className="block text-2xl font-extrabold text-white">{formatEuros(product.priceCents)}</span>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-rg-or px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-rg-marine shadow-sm transition-transform motion-safe:duration-200 group-hover:scale-105">
            Voir →
          </span>
        </div>
      </div>
    </Link>
  );
}
