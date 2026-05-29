import { createAdminClient } from "@/lib/supabase/server";

/**
 * Pourcentage de réduction accordé aux patrons actifs sur la boutique Stripe RG.
 * Constante unique : reflète la décision produit "patrons = -20% partout".
 * Utilisée côté UI (badge, tarif barré) ET côté checkout (Stripe Coupon).
 */
export const PATRON_DISCOUNT_PERCENT = 20;

/**
 * Coupon Stripe `Patron Rose Griffon · -20%` (percent_off=20, duration=forever),
 * créé via MCP le 2026-05-02. ID auto-généré par Stripe (pas un slug custom).
 * Le checkout injecte `discounts: [{ coupon: PATRON_STRIPE_COUPON_ID }]`
 * quand l'utilisateur est `active_patron`.
 *
 * Surcharger via `STRIPE_COUPON_PATRON` si l'ID Stripe diffère par environnement.
 */
export const PATRON_STRIPE_COUPON_ID = process.env.STRIPE_COUPON_PATRON ?? "kVTx74qC";

export interface PatronDiscount {
	active: boolean;
	percent: number;
	stripeCouponId: string;
	patronStatus: string | null;
	tierTitles: string[];
	currentlyEntitledCents: number | null;
}

/**
 * Snapshot de l'état Patreon d'un user RG, utilisé pour décider d'appliquer
 * la réduction 20% sur la boutique Stripe.
 *
 * - `active` est `true` ssi `patreon_memberships.patron_status = 'active_patron'`.
 * - On retourne aussi le tier et le montant pour permettre à l'UI d'afficher
 *   un badge contextuel ("Patron Niveau Evans → -20%").
 */
export async function getPatronDiscount(userId: string): Promise<PatronDiscount> {
	const empty: PatronDiscount = {
		active: false,
		currentlyEntitledCents: null,
		patronStatus: null,
		percent: PATRON_DISCOUNT_PERCENT,
		stripeCouponId: PATRON_STRIPE_COUPON_ID,
		tierTitles: [],
	};

	const supabase = createAdminClient();
	if (!supabase) {
		return empty;
	}

	const { data, error } = await supabase
		.from("patreon_memberships")
		.select("patron_status, tier_titles, currently_entitled_cents")
		.eq("user_id", userId)
		.order("currently_entitled_cents", { ascending: false })
		.limit(1)
		.maybeSingle();

	if (error || !data) {
		return empty;
	}

	return {
		active: data.patron_status === "active_patron",
		currentlyEntitledCents: (data.currently_entitled_cents as number | null) ?? null,
		patronStatus: data.patron_status ?? null,
		percent: PATRON_DISCOUNT_PERCENT,
		stripeCouponId: PATRON_STRIPE_COUPON_ID,
		tierTitles: (data.tier_titles ?? []) as string[],
	};
}

/**
 * Helper court pour décider d'appliquer la réduction au moment du checkout
 * Stripe. Renvoie l'ID coupon à passer à `stripe.checkout.sessions.create`,
 * ou `null` si pas de réduction.
 */
export async function getStripeCouponForUser(userId: string): Promise<string | null> {
	const d = await getPatronDiscount(userId);
	return d.active ? d.stripeCouponId : null;
}
