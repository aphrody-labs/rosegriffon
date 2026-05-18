import crypto from "node:crypto";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { bearer, genericOAuth } from "better-auth/plugins";
import { Pool } from "pg";

import { commonAuthOptions, ensureUserProfile } from "@rg/auth";
import {
	fetchIdentity,
	parseIdentityWithMemberships,
} from "@/lib/patreon/client";
import { encryptToken } from "@/lib/patreon/encryption";
import { SCOPES_CREATOR, SCOPES_PATRON } from "@/lib/patreon/types";
import type { Database } from "@rg/db";

const pool = new Pool({
	connectionString: process.env.DATABASE_URL,
	max: 10,
	idleTimeoutMillis: 30_000,
	connectionTimeoutMillis: 5_000,
});

const supabaseAdmin = createSupabaseAdmin<Database>(
	process.env.NEXT_PUBLIC_SUPABASE_URL!,
	process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

/**
 * Détecte si un account Patreon a été autorisé avec les scopes créateur.
 */
function detectCreatorScopes(scope: string | null | undefined): boolean {
	if (!scope) return false;
	const parts = scope.split(/[\s,]+/).filter(Boolean);
	return parts.some(
		(s) => s === "campaigns.members" || s === "w:campaigns.webhook",
	);
}

export const auth = betterAuth({
	database: pool,
	baseURL: process.env.BETTER_AUTH_URL ?? "https://rosegriffon.fr",
	secret: process.env.BETTER_AUTH_SECRET,

	...commonAuthOptions,

	socialProviders: {
		discord: {
			clientId: process.env.DISCORD_CLIENT_ID!,
			clientSecret: process.env.DISCORD_CLIENT_SECRET!,
			overrideUserInfoOnSignIn: true,
		},
		twitch: {
			clientId:
				process.env.TWITCH_AUTH_CLIENT_ID ?? process.env.TWITCH_CLIENT_ID!,
			clientSecret:
				process.env.TWITCH_AUTH_CLIENT_SECRET ??
				process.env.TWITCH_CLIENT_SECRET!,
			scope: [
				"user:read:email",
				"user:read:follows",
				"user:read:subscriptions",
			],
			mapProfileToUser: (profile) => {
				const p = profile as unknown as Record<string, unknown>;
				return {
					name:
						(p.display_name as string) ||
						(p.login as string) ||
						(p.preferred_username as string) ||
						"Utilisateur Twitch",
					image: (p.profile_image_url as string) ?? undefined,
				};
			},
		},
	},

	rateLimit: {
		enabled: true,
		window: 10,
		max: 100,
	},

	account: {
		...commonAuthOptions.account,
		accountLinking: {
			enabled: true,
			trustedProviders: ["discord", "twitch", "patreon"],
		},
	},

	trustedOrigins: [
		"https://rosegriffon.fr",
		process.env.BETTER_AUTH_URL ?? "https://rosegriffon.fr",
		"http://localhost:3000",
		"http://localhost:3001",
	].filter((v, i, a) => a.indexOf(v) === i),

	advanced: {
		...commonAuthOptions.advanced,
		database: {
			generateId: () => crypto.randomUUID(),
		},
	},

	logger: {
		level: process.env.NODE_ENV === "production" ? "error" : "debug",
	},

	databaseHooks: {
		user: {
			create: {
				after: async (user) => {
					// @ts-ignore - migration typing
					await ensureUserProfile(supabaseAdmin, user);
				},
			},
		},
		session: {
			create: {
				after: async (session) => {
					const { data: user } = await supabaseAdmin
						.from("user")
						.select("id, name, image, email")
						.eq("id", session.userId)
						.maybeSingle();
					if (user)
						// @ts-ignore - migration typing
						await ensureUserProfile(supabaseAdmin, user);
				},
			},
		},
		account: {
			create: {
				after: async (account) => {
					if (account.providerId !== "patreon") return;
					await syncPatreonAccount(account, {
						isCreator: detectCreatorScopes(account.scope),
					});
				},
			},
			update: {
				after: async (account) => {
					if (account.providerId !== "patreon") return;
					await syncPatreonAccount(account, {
						isCreator: detectCreatorScopes(account.scope),
					});
				},
			},
		},
	},

	plugins: [
		bearer(),
		genericOAuth({
			config: [
				{
					providerId: "patreon",
					clientId: process.env.PATREON_CLIENT_ID!,
					clientSecret: process.env.PATREON_CLIENT_SECRET!,
					authorizationUrl: "https://www.patreon.com/oauth2/authorize",
					tokenUrl: "https://www.patreon.com/api/oauth2/token",
					scopes: [...SCOPES_PATRON],
					getUserInfo: async (tokens: unknown) => {
						const accessToken = (tokens as { accessToken?: string })
							.accessToken;
						if (!accessToken) return null;
						try {
							const resp = await fetchIdentity(accessToken, {
								withMemberships: true,
							});
							const identity = parseIdentityWithMemberships(resp);
							return {
								id: identity.patreonUserId,
								email:
									identity.user.email ??
									`patreon-${identity.patreonUserId}@noemail.local`,
								emailVerified: !!identity.user.email,
								name: identity.user.full_name ?? "Utilisateur Patreon",
								image: identity.user.thumb_url ?? undefined,
								createdAt: new Date(),
								updatedAt: new Date(),
							};
						} catch (e) {
							console.error("[auth/patreon] getUserInfo failed", e);
							return null;
						}
					},
				},
			],
		}),
		nextCookies(),
	],
});

/**
 * Sync les données Patreon vers nos tables custom.
 */
async function syncPatreonAccount(
	account: {
		id: string;
		userId: string;
		accountId: string;
		accessToken?: string | null;
		refreshToken?: string | null;
		accessTokenExpiresAt?: Date | null;
		scope?: string | null;
	},
	opts: { isCreator?: boolean } = {},
) {
	if (!account.accessToken || !account.refreshToken) return;
	const isCreator = opts.isCreator === true;
	const fallbackScopes = (isCreator ? SCOPES_CREATOR : SCOPES_PATRON).join(" ");
	try {
		const resp = await fetchIdentity(account.accessToken, {
			withMemberships: true,
		});
		const identity = parseIdentityWithMemberships(resp);
		const top =
			[...identity.memberships].sort((a, b) => {
				const score = (s: string | null | undefined) =>
					s === "active_patron" ? 0 : 1;
				return score(a.attrs.patron_status) - score(b.attrs.patron_status);
			})[0] ?? null;

		const expiresAt = account.accessTokenExpiresAt
			? new Date(account.accessTokenExpiresAt).toISOString()
			: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();

		await Promise.all([
			supabaseAdmin.from("patreon_oauth_tokens").upsert(
				{
					user_id: account.userId,
					patreon_user_id: identity.patreonUserId,
					is_creator: isCreator,
					access_token_enc: encryptToken(account.accessToken),
					refresh_token_enc: encryptToken(account.refreshToken),
					expires_at: expiresAt,
					scope: account.scope ?? fallbackScopes,
				},
				{ onConflict: "user_id,patreon_user_id" },
			),
			supabaseAdmin.from("patreon_memberships").upsert(
				{
					user_id: account.userId,
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
					address: (top?.address ?? null) as never,
					tier_ids: top?.tierIds ?? [],
					tier_titles: top?.tierTitles ?? [],
					tier_amounts_cents: top?.tierAmountsCents ?? [],
					tier_requires_shipping: top?.tierRequiresShipping ?? [],
					discord_role_ids: top?.discordRoleIds ?? [],
					raw_identity: resp as never,
					scope: account.scope ?? fallbackScopes,
					fetched_at: new Date().toISOString(),
				},
				{ onConflict: "user_id,patreon_user_id" },
			),
			supabaseAdmin
				.from("profiles")
				.update({
					patreon_id: identity.patreonUserId,
					updated_at: new Date().toISOString(),
				})
				.eq("id", account.userId),
		]);
	} catch (e) {
		console.error("[auth/patreon] syncPatreonAccount failed", e);
	}
}

export type AuthSession = typeof auth.$Infer.Session;
export type AuthUser = typeof auth.$Infer.Session.user;
