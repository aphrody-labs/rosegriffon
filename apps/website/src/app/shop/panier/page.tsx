import { ArrowLeft, ShoppingBag } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { getCart } from "@/lib/shop/cart";
import { CartLineItem } from "../_components/cart-line-item";
import { CheckoutButton } from "../_components/checkout-button";
import { PatreonDiscountBanner } from "../_components/patreon-discount-banner";
import { formatEuros } from "@/lib/shop/products";

export const metadata = {
	title: "Panier · Boutique Rose Griffon",
};

export default async function CartPage() {
	const cart = await getCart();

	if (cart.items.length === 0) {
		return (
			<main className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center px-4 py-16 text-center">
				<ShoppingBag className="size-16 text-[#d4af37]" />
				<h1 className="mt-6 text-3xl font-extrabold text-white">
					Ton panier est vide
				</h1>
				<p className="mt-3 max-w-md text-base text-white/70">
					Pas encore d'articles. Découvre nos packs personnage édition limitée,
					nos prints A5 et nos stickers chibi.
				</p>
				<Link
					href="/shop"
					className="mt-8 inline-flex h-12 items-center gap-2 rounded-full bg-[#d4af37] px-6 text-sm font-extrabold uppercase tracking-wider text-[#0c1730] shadow-[0_3px_0_0_rgba(0,0,0,0.5)] transition-transform motion-safe:duration-200 hover:-translate-y-0.5"
				>
					<ArrowLeft className="size-4" />
					Voir le catalogue
				</Link>
			</main>
		);
	}

	return (
		<main className="mx-auto max-w-6xl px-4 pb-16 pt-10 md:px-8 md:pt-16">
			<nav className="mb-6">
				<Link
					href="/shop"
					className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-white/70 hover:text-[#d4af37]"
				>
					<ArrowLeft className="size-4" />
					<span>Continuer mes achats</span>
				</Link>
			</nav>

			<header className="mb-8 flex items-end justify-between gap-4">
				<h1 className="text-fluid-headline-xl font-extrabold tracking-tight text-white">
					Mon panier
				</h1>
				<p className="text-sm font-semibold uppercase tracking-widest text-[#d4af37]">
					{cart.itemCount} article{cart.itemCount > 1 ? "s" : ""}
				</p>
			</header>

			<div className="grid gap-10 lg:grid-cols-[1fr_400px] lg:gap-12">
				<section aria-label="Articles du panier">
					<ul className="flex flex-col gap-3">
						{cart.items.map((item) => (
							<CartLineItem key={item.id} item={item} />
						))}
					</ul>
				</section>

				<aside className="lg:sticky lg:top-24 lg:self-start">
					<div className="flex flex-col gap-5 rounded-3xl border-2 border-[#d4af37]/50 bg-[#0c1730]/80 p-6 shadow-[0_4px_0_0_rgba(0,0,0,0.5)]">
						<h2 className="text-xs font-bold uppercase tracking-widest text-[#d4af37]">
							Récapitulatif
						</h2>

						<Suspense
							fallback={
								<div className="h-20 animate-pulse rounded-xl bg-[#0c1730]/60" />
							}
						>
							<PatreonDiscountBanner />
						</Suspense>

						<dl className="space-y-2 border-t border-[#d4af37]/20 pt-4 text-sm">
							<div className="flex items-center justify-between text-white/80">
								<dt>Sous-total</dt>
								<dd className="font-semibold text-white">
									{formatEuros(cart.subtotalCents)}
								</dd>
							</div>
							<div className="flex items-center justify-between text-white/60">
								<dt>Livraison</dt>
								<dd>Calculée à l'étape suivante</dd>
							</div>
							<div className="flex items-center justify-between text-white/60">
								<dt>Réduction Patron</dt>
								<dd>Appliquée auto au checkout</dd>
							</div>
						</dl>

						<div className="flex items-end justify-between gap-3 border-t-2 border-[#d4af37]/30 pt-4">
							<span className="text-xs font-bold uppercase tracking-widest text-[#d4af37]">
								À régler
							</span>
							<span className="text-3xl font-extrabold text-white">
								{formatEuros(cart.subtotalCents)}
							</span>
						</div>

						<CheckoutButton subtotalCents={cart.subtotalCents} />
					</div>
				</aside>
			</div>
		</main>
	);
}
