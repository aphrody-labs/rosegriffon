/**
 * Instance Stripe partagée pour le shop Rose Griffon.
 * Singleton process-level (Vercel/serverless re-use entre invocations chaudes).
 * Mode auto : utilise STRIPE_SECRET_KEY (sk_test_… ou sk_live_…).
 */
import Stripe from "stripe";

let cached: Stripe | null = null;

export function getStripe(): Stripe {
	if (cached) return cached;
	const key = process.env.STRIPE_SECRET_KEY;
	if (!key) {
		throw new Error(
			"[shop] STRIPE_SECRET_KEY missing — voir .env.example pour la config Stripe.",
		);
	}
	cached = new Stripe(key, {
		apiVersion: "2025-08-27.basil",
		typescript: true,
		appInfo: {
			name: "rosegriffon.fr",
			url: "https://rosegriffon.fr",
		},
	});
	return cached;
}
