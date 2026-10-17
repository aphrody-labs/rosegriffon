"use client";

import { ShoppingBag } from "lucide-react";
import Link from "next/link";

export function CartIconButton({ initialCount }: { initialCount: number }) {
  const count = initialCount;

  return (
    <Link
      href="/shop/panier"
      aria-label={`Voir le panier (${count} article${count > 1 ? "s" : ""})`}
      className="group relative inline-flex size-11 items-center justify-center rounded-full border-2 border-rg-or bg-rg-marine text-rg-or shadow-[0_3px_0_0_rgba(0,0,0,0.5)] transition-transform motion-safe:duration-200 hover:-translate-y-0.5 hover:bg-rg-or hover:text-rg-marine outline-hidden focus-visible:ring-[3px] focus-visible:ring-rg-or/50"
    >
      <ShoppingBag className="size-5" aria-hidden />
      {count > 0 && (
        <span
          aria-hidden
          className="absolute -right-1 -top-1 grid min-h-5 min-w-5 place-items-center rounded-full bg-rg-brique px-1 text-[11px] font-extrabold leading-none text-white ring-2 ring-rg-marine"
        >
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}
