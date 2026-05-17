import crypto from "node:crypto";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { bearer, genericOAuth } from "better-auth/plugins";
import { Pool } from "pg";

import {
	fetchIdentity,
	parseIdentityWithMemberships,
} from "@/lib/patreon/client";
import { encryptToken } from "@/lib/patreon/encryption";
import { SCOPES_CREATOR, SCOPES_PATRON } from "@/lib/patreon/types";
import type { Database } from "@/types/supabase";

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

async function ensureUserProfile(user: {
	id: string;
	name?: string;
	email?: string | null;
	image?: string | null;
}) {
	try {
		const { data } = await supabaseAdmin
			.from("profiles")
			.select("id")
			.eq("id", user.id)
			.maybeSingle();

		if (data) {
			// Mettre à jour l'avatar à chaque connexion (Discord peut le changer)
			await supabaseAdmin
				.from("profiles")
				.update({
					avatar_url: user.image || null,
					updated_at: new Date().toISOString(),
				})
				.eq("id", user.id);
			return;
		}

		// Username fallback : Discord/Twitch peuvent ne pas exposer email (scope absent
		// ou compte sans email vérifié). Fallback ultime : `user-<8chars id>`.
		const username =
			user.name
				?.toLowerCase()
				.replace(/[^a-z0-9_]/g, "_")
				.slice(0, 30) ||
			user.email?.split("@")[0] ||
			`user-${user.id.slice(0, 8)}`;

		await supabaseAdmin.from("profiles").upsert(
			{
				id: user.id,
				username,
				full_name: user.name || "",
				avatar_url: user.image || null,
				role: "member",
				updated_at: new Date().toISOString(),
			},
			{ onConflict: "id" },
		);
	} catch (err) {
		console.error("[auth] ensureUserProfile failed:", user.id, err);
	}
}

/**
 * Détecte si un account Patreon a été autorisé avec les scopes créateur en
 * inspectant la chaîne `scope` retournée par Patreon (séparateur `,` côté
 * Better Auth, `space` côté Patreon brut). On utilise `campaigns.members`
 * comme témoin : ce scope ne peut être accordé qu'au propriétaire de la
 * campagne — il marque sans ambiguïté un OAuth créateur.
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

	socialProviders: {
		discord: {
			clientId: process.env.DISCORD_CLIENT_ID!,
			clientSecret: process.env.DISCORD_CLIENT_SECRET!,
			// Better Auth Discord provider expose nativement email/name/image — pas besoin de mapper.
			// overrideUserInfoOnSignIn: true rafraîchit ces champs à chaque login.
			overrideUserInfoOnSignIn: true,
		},
		twitch: {
			clientId:
				process.env.TWITCH_AUTH_CLIENT_ID ?? process.env.TWITCH_CLIENT_ID!,
			clientSecret:
				process.env.TWITCH_AUTH_CLIENT_SECRET ??
				process.env.TWITCH_CLIENT_SECRET!,
			// Scopes pour récupérer follows + abonnements (utilisable plus tard via auth.api.getAccessToken).
			// Twitch provider Better Auth typé string[] (vs autres providers en string).
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

	user: {
		fields: {
			emailVerified: "email_verified",
			createdAt: "created_at",
			updatedAt: "updated_at",
		},
	},

	session: {
		expiresIn: 60 * 60 * 24 * 30, // 30 jours
		updateAge: 60 * 60 * 24,
		cookieCache: {
			enabled: true,
			maxAge: 5 * 60, // 5 min → réduit les requêtes DB
		},
		fields: {
			userId: "user_id",
			expiresAt: "expires_at",
			ipAddress: "ip_address",
			userAgent: "user_agent",
			createdAt: "created_at",
			updatedAt: "updated_at",
		},
	},

	account: {
		accountLinking: {
			enabled: true,
			trustedProviders: ["discord", "twitch", "patreon"],
		},
		fields: {
			userId: "user_id",
			accountId: "account_id",
			providerId: "provider_id",
			accessToken: "access_token",
			refreshToken: "refresh_token",
			accessTokenExpiresAt: "access_token_expires_at",
			refreshTokenExpiresAt: "refresh_token_expires_at",
			idToken: "id_token",
			createdAt: "created_at",
			updatedAt: "updated_at",
		},
	},

	verification: {
		fields: {
			expiresAt: "expires_at",
			createdAt: "created_at",
			updatedAt: "updated_at",
		},
	},

	trustedOrigins: [
		"https://rosegriffon.fr",
		process.env.BETTER_AUTH_URL ?? "https://rosegriffon.fr",
		"http://localhost:3000",
		"http://localhost:3001",
	].filter((v, i, a) => a.indexOf(v) === i), // déduplique

	advanced: {
		useSecureCookies: true,
		// Récupère l'IP réelle derrière Nginx
		ipAddress: {
			ipAddressHeaders: ["x-forwarded-for", "x-real-ip"],
		},
		defaultCookieAttributes: {
			httpOnly: true,
			secure: true,
			sameSite: "lax" as const,
		},
		database: {
			generateId: () => crypto.randomUUID(),
		},
	},

	logger: {
		// En prod : seulement les erreurs (sinon trop de bruit). En dev : debug.
		level: process.env.NODE_ENV === "production" ? "error" : "debug",
	},

	databaseHooks: {
		user: {
			create: {
				// Crée le profil Supabase à la première connexion Discord
				after: async (user) => {
					await ensureUserProfile(user);
				},
			},
		},
		session: {
			create: {
				// Met à jour l'avatar Discord à chaque session (profil peut changer)
				after: async (session) => {
					const { data: user } = await supabaseAdmin
						.from("user")
						.select("id, name, image, email")
						.eq("id", session.userId)
						.maybeSingle();
					if (user)
						await ensureUserProfile(
							user as {
								id: string;
								name: string;
								image: string | null;
								email: string;
							},
						);
				},
			},
		},
		account: {
			create: {
				// Quand un account Patreon est lié (login OU link), on enrichit
				// patreon_memberships en réutilisant l'access_token stocké par
				// Better Auth + on miroite dans patreon_oauth_tokens (chiffré).
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

	// bearer() : permet l'auth via header `Authorization: Bearer <session_token>`
	//   (utile pour bots, mobile apps, server-to-server).
	// nextCookies() : OBLIGATOIRE Next.js — propage les Set-Cookie depuis les server actions.
	//   DOIT rester DERNIER (cf. CLAUDE.md).
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
					// Patreon n'expose pas de discovery OIDC.
					// Scopes patron par défaut. Les scopes créateur (campaigns,
					// campaigns.members*, w:campaigns.webhook) sont demandés à
					// la volée via `signIn.oauth2({ scopes })` côté client (cf.
					// PatreonConnectButton variant="creator-link") — Better Auth
					// merge ces scopes avec ceux d'ici.
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
 * Sync les données Patreon vers nos tables custom (patreon_oauth_tokens +
 * patreon_memberships) quand Better Auth crée/MAJ un account Patreon.
 * Réutilise l'access_token déjà stocké par Better Auth dans la table `account`.
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
		// La promotion superadmin du compte créateur RG est déléguée à un trigger
		// SQL (cf. migration `20260502000005_promote_rg_creator.sql`). Le trigger
		// se déclenche après INSERT/UPDATE sur `patreon_memberships` et upgrade
		// `profiles.role='admin'` quand le `patreon_user_id` correspond à l'URL
		// canonique RG ou à un token `is_creator=true`.
	} catch (e) {
		console.error("[auth/patreon] syncPatreonAccount failed", e);
	}
}

export type AuthSession = typeof auth.$Infer.Session;
export type AuthUser = typeof auth.$Infer.Session.user;
