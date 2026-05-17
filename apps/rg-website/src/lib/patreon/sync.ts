import {
	fetchIdentity,
	parseIdentityWithMemberships,
	refreshAccessToken,
} from "@/lib/patreon/client";
import { decryptToken, encryptToken } from "@/lib/patreon/encryption";
import { SCOPES_PATRON } from "@/lib/patreon/types";
import { createAdminClient } from "@/lib/supabase/server";
import type { ParsedIdentity } from "@/lib/patreon/types";

type AdminClient = NonNullable<ReturnType<typeof createAdminClient>>;

interface TokenRow {
	id: string;
	user_id: string | null;
	patreon_user_id: string;
	access_token_enc: string;
	refresh_token_enc: string;
	expires_at: string;
	scope: string;
}

/**
 * Si le token expire dans moins de `marginMs`, on le rafraîchit via OAuth
 * `grant_type=refresh_token` et on stocke la nouvelle paire chiffrée.
 * Renvoie l'access token clair (toujours valide) à utiliser pour le fetch.
 */
async function ensureFreshAccessToken(
	supabase: AdminClient,
	row: TokenRow,
	marginMs = 5 * 60 * 1000,
): Promise<string> {
	const expiresAt = new Date(row.expires_at).getTime();
	if (expiresAt - Date.now() > marginMs) {
		return decryptToken(row.access_token_enc);
	}

	const refresh = decryptToken(row.refresh_token_enc);
	const refreshed = await refreshAccessToken(refresh);
	const newExpiresAt = new Date(
		Date.now() + refreshed.expires_in * 1000,
	).toISOString();

	await supabase
		.from("patreon_oauth_tokens")
		.update({
			access_token_enc: encryptToken(refreshed.access_token),
			refresh_token_enc: encryptToken(refreshed.refresh_token),
			expires_at: newExpiresAt,
			scope: refreshed.scope || row.scope,
		})
		.eq("id", row.id);

	return refreshed.access_token;
}

/**
 * Re-sync l'état Patreon d'un user RG depuis l'API officielle :
 * fetch identity étendu → upsert `patreon_memberships`.
 *
 * Utilisé par :
 *  - POST /api/auth/patreon/refresh (action user)
 *  - cron /api/cron/patreon-refresh (timer hebdo)
 *  - admin /api/admin/patreon/refresh-all
 */
export async function refreshPatreonMembership(
	userId: string,
): Promise<{ ok: boolean; reason?: string; identity?: ParsedIdentity }> {
	const supabase = createAdminClient();
	if (!supabase) return { ok: false, reason: "no_admin_client" };

	const { data: tokenRow } = await supabase
		.from("patreon_oauth_tokens")
		.select(
			"id, user_id, patreon_user_id, access_token_enc, refresh_token_enc, expires_at, scope",
		)
		.eq("user_id", userId)
		.eq("is_creator", false)
		.maybeSingle();

	const row = tokenRow as TokenRow | null;
	if (!row) return { ok: false, reason: "no_token" };

	const accessToken = await ensureFreshAccessToken(supabase, row);
	const resp = await fetchIdentity(accessToken, { withMemberships: true });
	const identity = parseIdentityWithMemberships(resp);

	const top =
		[...identity.memberships].sort((a, b) => {
			const score = (s: string | null | undefined) =>
				s === "active_patron" ? 0 : 1;
			return score(a.attrs.patron_status) - score(b.attrs.patron_status);
		})[0] ?? null;

	await supabase.from("patreon_memberships").upsert(
		{
			user_id: userId,
			patreon_user_id: identity.patreonUserId,
			patreon_member_id: top?.memberId ?? null,
			campaign_id: top?.campaignId ?? null,
			patreon_email: identity.user.email ?? null,
			patreon_full_name: identity.user.full_name ?? null,
			patreon_thumb_url: identity.user.thumb_url ?? null,
			patreon_url: identity.user.url ?? null,
			discord_user_id: identity.discordUserId,
			patron_status: top?.attrs.patron_status ?? null,
			last_charge_date: top?.attrs.last_charge_date ?? null,
			last_charge_status: top?.attrs.last_charge_status ?? null,
			currently_entitled_cents:
				top?.attrs.currently_entitled_amount_cents ?? null,
			lifetime_support_cents:
				top?.attrs.campaign_lifetime_support_cents ??
				top?.attrs.lifetime_support_cents ??
				null,
			pledge_start: top?.attrs.pledge_relationship_start ?? null,
			pledge_cadence: top?.attrs.pledge_cadence ?? null,
			will_pay_amount_cents: top?.attrs.will_pay_amount_cents ?? null,
			next_charge_date: top?.attrs.next_charge_date ?? null,
			is_free_trial: top?.attrs.is_free_trial ?? null,
			is_gifted: top?.attrs.is_gifted ?? null,
			member_email: top?.attrs.email ?? null,
			note: top?.attrs.note ?? null,
			address: top?.address ?? null,
			tier_ids: top?.tierIds ?? [],
			tier_titles: top?.tierTitles ?? [],
			tier_amounts_cents: top?.tierAmountsCents ?? [],
			tier_requires_shipping: top?.tierRequiresShipping ?? [],
			discord_role_ids: top?.discordRoleIds ?? [],
			raw_identity: resp as unknown as Record<string, unknown>,
			scope: row.scope || SCOPES_PATRON.join(" "),
			fetched_at: new Date().toISOString(),
		},
		{ onConflict: "user_id,patreon_user_id" },
	);

	return { ok: true, identity };
}

/**
 * Refresh tous les memberships dont le `fetched_at` est plus vieux que `olderThanMs`.
 * Utilisé par le cron hebdo. Limité à `limit` users par run pour éviter un burst
 * d'appels Patreon.
 */
export async function refreshAllMemberships(opts: {
	olderThanMs?: number;
	limit?: number;
}): Promise<{ refreshed: number; failed: number }> {
	const supabase = createAdminClient();
	if (!supabase) return { refreshed: 0, failed: 0 };

	const olderThan = new Date(
		Date.now() - (opts.olderThanMs ?? 6 * 24 * 3600 * 1000),
	).toISOString();
	const limit = opts.limit ?? 200;

	const { data } = await supabase
		.from("patreon_memberships")
		.select("user_id, fetched_at")
		.lt("fetched_at", olderThan)
		.limit(limit);

	let refreshed = 0;
	let failed = 0;
	for (const row of (data ?? []) as { user_id: string }[]) {
		try {
			const r = await refreshPatreonMembership(row.user_id);
			if (r.ok) refreshed += 1;
			else failed += 1;
		} catch (e) {
			console.error("[patreon/sync] refresh user failed", row.user_id, e);
			failed += 1;
		}
	}
	return { refreshed, failed };
}
