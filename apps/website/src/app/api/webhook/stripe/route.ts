import { type NextRequest, NextResponse } from "next/server";

import { getStripe } from "@/lib/shop/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Webhook Stripe — handle paiement confirmé.
 * Pour activer en prod : `stripe listen --forward-to localhost:3000/api/webhook/stripe`
 * (dev) + secret dans STRIPE_WEBHOOK_SECRET. En prod : configurer le webhook
 * sur dashboard.stripe.com/webhooks vers https://rosegriffon.fr/api/webhook/stripe.
 *
 * Events handled :
 *   - `checkout.session.completed` → marquer la commande payée, déclencher fulfillment
 *   - `charge.refunded` → noter le refund
 *   - `payment_intent.payment_failed` → alerte log
 */
export async function POST(req: NextRequest) {
	const secret = process.env.STRIPE_WEBHOOK_SECRET;
	if (!secret) {
		console.warn("[stripe-webhook] STRIPE_WEBHOOK_SECRET missing — rejecting");
		return NextResponse.json({ error: "Not configured" }, { status: 503 });
	}

	const sig = req.headers.get("stripe-signature");
	if (!sig) {
		return NextResponse.json({ error: "Missing signature" }, { status: 400 });
	}

	const stripe = getStripe();
	const body = await req.text();

	try {
		const event = stripe.webhooks.constructEvent(body, sig, secret);

		switch (event.type) {
			case "checkout.session.completed": {
				const session = event.data.object;
				console.info("[stripe-webhook] checkout completed", {
					id: session.id,
					email: session.customer_details?.email,
					amount: session.amount_total,
					patron: session.metadata?.patron_discount,
				});
				// TODO branchement DB orders ici quand la table sera créée.
				// Pour l'instant : Stripe est la source de vérité, on log + notif.
				break;
			}
			case "charge.refunded": {
				const charge = event.data.object;
				console.info("[stripe-webhook] refund", {
					id: charge.id,
					amount: charge.amount_refunded,
				});
				break;
			}
			case "payment_intent.payment_failed": {
				const pi = event.data.object;
				console.warn("[stripe-webhook] payment failed", {
					id: pi.id,
					reason: pi.last_payment_error?.message,
				});
				break;
			}
			default:
				// Ignore other events silently
				break;
		}

		return NextResponse.json({ received: true });
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		console.error("[stripe-webhook] signature verification failed:", msg);
		return NextResponse.json(
			{ error: `Webhook error: ${msg}` },
			{ status: 400 },
		);
	}
}
