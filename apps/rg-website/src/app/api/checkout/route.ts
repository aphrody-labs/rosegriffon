import { type NextRequest, NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { getStripeCouponForUser } from "@/lib/patreon/discount";
import { getStripe } from "@/lib/shop/stripe";
import { getCart } from "@/lib/shop/cart";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(_req: NextRequest) {
	const cart = await getCart();
	if (cart.items.length === 0) {
		return NextResponse.json({ error: "Cart is empty" }, { status: 400 });
	}

	const stripe = getStripe();

	let userId: string | null = null;
	let userEmail: string | undefined;
	try {
		const supabase = await createClient();
		const { data: auth } = await supabase.auth.getUser();
		userId = auth.user?.id ?? null;
		userEmail = auth.user?.email ?? undefined;
	} catch {
		// Anonymous checkout is allowed — discount Patron only if logged in
	}

	const couponId = userId ? await getStripeCouponForUser(userId) : null;

	const origin =
		_req.headers.get("origin") ??
		process.env.NEXT_PUBLIC_SITE_URL ??
		"https://rosegriffon.fr";

	const session = await stripe.checkout.sessions.create({
		mode: "payment",
		ui_mode: "hosted",
		payment_method_types: ["card", "link"],
		locale: "fr",
		customer_email: userEmail,
		allow_promotion_codes: true,
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
		},
		success_url: `${origin}/shop/merci?session_id={CHECKOUT_SESSION_ID}`,
		cancel_url: `${origin}/shop/panier`,
	});

	return NextResponse.json({ url: session.url });
}
