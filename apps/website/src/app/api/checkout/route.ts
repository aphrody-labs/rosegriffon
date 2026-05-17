import { randomUUID } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { getStripeCouponForUser } from "@/lib/patreon/discount";
import { getStripe } from "@/lib/shop/stripe";
import { getCart } from "@/lib/shop/cart";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
	const cart = await getCart();
	if (cart.items.length === 0) {
		return NextResponse.json({ error: "Cart is empty" }, { status: 400 });
	}

	const stripe = getStripe();

	let userId: string | null = null;
	let userEmail: string | undefined;
	try {
		const supabase = await createClient();
		if (!supabase) {
			console.warn(
				"[checkout] createClient() returned null — anonymous checkout (no Patron discount)",
			);
		} else {
			const { data: auth, error: authErr } = await supabase.auth.getUser();
			if (authErr) {
				console.warn("[checkout] auth.getUser() failed", authErr.message);
			} else {
				userId = auth.user?.id ?? null;
				userEmail = auth.user?.email ?? undefined;
			}
		}
	} catch (e) {
		console.warn(
			"[checkout] supabase init threw — anonymous checkout",
			e instanceof Error ? e.message : String(e),
		);
	}

	const couponId = userId ? await getStripeCouponForUser(userId) : null;

	const origin =
		req.headers.get("origin") ??
		process.env.NEXT_PUBLIC_SITE_URL ??
		"https://rosegriffon.fr";

	// Idempotency key par requête — protège contre double-clic / retry réseau.
	// Inclut l'identifiant user + signature du panier pour différencier des
	// tentatives légitimement distinctes.
	const idempotencyKey =
		req.headers.get("x-idempotency-key") ?? `co_${randomUUID()}`;

	const session = await stripe.checkout.sessions.create(
		{
			mode: "payment",
			ui_mode: "hosted",
			// Pas de `payment_method_types` — dynamic payment methods activés (Stripe
			// pousse automatiquement card/Apple Pay/Google Pay/SEPA/Link selon eligibility
			// et géo, géré côté dashboard.stripe.com/settings/payment_methods).
			locale: "fr",
			customer_email: userEmail,
			allow_promotion_codes: true,
			automatic_tax: { enabled: true },
			billing_address_collection: "required",
			phone_number_collection: { enabled: true },
			shipping_address_collection: {
				allowed_countries: [
					"FR",
					"BE",
					"CH",
					"LU",
					"DE",
					"ES",
					"IT",
					"NL",
					"PT",
					"GB",
					"CA",
				],
			},
			shipping_options: [
				{
					shipping_rate_data: {
						type: "fixed_amount",
						fixed_amount: { amount: 490, currency: "eur" },
						display_name: "Lettre suivie France",
						delivery_estimate: {
							minimum: { unit: "business_day", value: 3 },
							maximum: { unit: "business_day", value: 7 },
						},
					},
				},
				{
					shipping_rate_data: {
						type: "fixed_amount",
						fixed_amount: { amount: 990, currency: "eur" },
						display_name: "Colissimo suivi (UE)",
						delivery_estimate: {
							minimum: { unit: "business_day", value: 4 },
							maximum: { unit: "business_day", value: 10 },
						},
					},
				},
			],
			line_items: cart.items.map((item) => ({
				quantity: item.qty,
				price_data: {
					currency: "eur",
					unit_amount: item.unitPriceCents,
					tax_behavior: "inclusive",
					product_data: {
						name: item.variantLabel
							? `${item.product.name} — ${item.variantLabel}`
							: item.product.name,
						description: item.product.tagline,
						images: [`${origin}${item.product.image}`],
						metadata: {
							slug: item.product.slug,
							variantId: item.variantId ?? "default",
						},
					},
				},
			})),
			discounts: couponId ? [{ coupon: couponId }] : undefined,
			metadata: {
				user_id: userId ?? "anonymous",
				source: "rosegriffon.fr/shop",
				patron_discount: couponId ? "yes" : "no",
				cart_signature: cart.items
					.map((i) => `${i.slug}:${i.variantId ?? "_"}x${i.qty}`)
					.join("|"),
			},
			success_url: `${origin}/shop/merci?session_id={CHECKOUT_SESSION_ID}`,
			cancel_url: `${origin}/shop/panier`,
		},
		{ idempotencyKey },
	);

	return NextResponse.json({ url: session.url });
}
