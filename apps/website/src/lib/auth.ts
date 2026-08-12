import crypto from "node:crypto";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { bearer, genericOAuth, twoFactor } from "better-auth/plugins";
import {
	commonAuthOptions,
	createAccountOptions,
	ensureUserProfile,
	googleProvider,
} from "@rosegriffon/auth";
import { sendEmail } from "@/lib/email";
import { getPgPool } from "@/lib/db/pg";
import { fetchIdentity, parseIdentityWithMemberships } from "@/lib/patreon/client";
import { encryptToken } from "@/lib/patreon/encryption";
import { SCOPES_CREATOR, SCOPES_PATRON } from "@/lib/patreon/types";
import type { Database } from "@rosegriffon/db";

const pool = getPgPool();

// Lazy getter for Supabase admin to prevent top-level execution during build
let _supabaseAdmin: ReturnType<typeof createSupabaseAdmin<Database>> | null = null;
function getSupabaseAdmin() {
	if (_supabaseAdmin) {
		return _supabaseAdmin;
	}

	const url =
		process.env.NEXT_PUBLIC_SUPABASE_URL &&
		process.env.NEXT_PUBLIC_SUPABASE_URL !== "undefined" &&
		process.env.NEXT_PUBLIC_SUPABASE_URL.startsWith("http") &&
		!process.env.NEXT_PUBLIC_SUPABASE_URL.startsWith("eyJ2Ijo")
			? process.env.NEXT_PUBLIC_SUPABASE_URL
			: (typeof window === "undefined" ? "http://127.0.0.1:8811" : window.location.origin);

	const key =
		process.env.SUPABASE_SERVICE_ROLE_KEY &&
		!process.env.SUPABASE_SERVICE_ROLE_KEY.startsWith("{") &&
		!process.env.SUPABASE_SERVICE_ROLE_KEY.startsWith("eyJ2Ijo")
			? process.env.SUPABASE_SERVICE_ROLE_KEY
			: "***REDACTED-SERVICE-ROLE***";

	_supabaseAdmin = createSupabaseAdmin<Database>(url, key);
	return _supabaseAdmin;
}

/**
 * Détecte si un account Patreon a été autorisé avec les scopes créateur.
 */
function detectCreatorScopes(scope: string | null | undefined): boolean {
	if (!scope) {
		return false;
	}
	const parts = scope.split(/[\s,]+/).filter(Boolean);
	return parts.some((s) => s === "campaigns.members" || s === "w:campaigns.webhook");
}

const getBetterAuthURL = () => {
	const url = process.env.BETTER_AUTH_URL;
	if (
		!url ||
		url === "undefined" ||
		url === "null" ||
		!url.startsWith("http") ||
		url.startsWith("eyJ2Ijo")
	) {
		return "https://rosegriffon.fr";
	}
	return url;
};

export const auth = betterAuth({
	database: pool,
	baseURL: getBetterAuthURL(),
	secret:
		process.env.BETTER_AUTH_SECRET ||
		"build-placeholder-secret-not-used-at-runtime-only-prevents-prerender-throw",

	...commonAuthOptions,

	// Réétalé explicitement : redéfinir `user` remplacerait l'objet hérité du
	// spread ci-dessus, donc la correspondance des colonnes. `createAccountOptions`
	// active le changement d'adresse et la suppression de compte, désactivés par
	// défaut dans Better Auth.
	user: {
		...commonAuthOptions.user,
		...createAccountOptions({ appName: "Rose Griffon", sendEmail }),
	},

	// Le changement d'adresse d'un compte déjà vérifié exige un envoi de
	// vérification côté Better Auth : sans ce bloc, l'endpoint refuse la demande
	// avec « Verification email isn't enabled ».
	emailVerification: {
		sendVerificationEmail: async ({ user, url }: { user: { email: string }; url: string }) => {
			await sendEmail({
				html: `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"></head>
<body style="margin:0;padding:24px;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1a1a1a">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table role="presentation" width="100%" style="max-width:480px;background:#ffffff;border-radius:16px;overflow:hidden">
      <tr><td style="padding:32px 28px 16px">
        <h1 style="margin:0 0 12px;font-size:20px;font-weight:700">Confirme ton adresse</h1>
        <p style="margin:0;font-size:15px;line-height:1.55;color:#4a4a4a">Vérifie <strong>${user.email}</strong> pour activer toutes les fonctions de ton compte.</p>
      </td></tr>
      <tr><td style="padding:0 28px 28px" align="center">
        <a href="${url}" style="display:inline-block;padding:13px 32px;background:#a14b3f;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;border-radius:999px">Vérifier mon adresse</a>
        <p style="margin:18px 0 0;font-size:12px;line-height:1.5;color:#8a8a8a">Lien valable une heure. Si tu n'es pas à l'origine de cette demande, ignore ce message.</p>
      </td></tr>
      <tr><td style="padding:14px 28px;border-top:1px solid #ececec" align="center">
        <p style="margin:0;font-size:11px;color:#8a8a8a">Rose Griffon</p>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`,
				subject: "Confirme ton adresse — Rose Griffon",
				to: user.email,
			});
		},
	},

	socialProviders: {
		discord: {
			clientId: process.env.DISCORD_CLIENT_ID!,
			clientSecret: process.env.DISCORD_CLIENT_SECRET!,
			overrideUserInfoOnSignIn: true,
			// Better Auth force `prompt=none` par défaut sur Discord
			// (cf. @better-auth/core discord.mjs : `prompt=${options.prompt || "none"}`).
			// `none` = "aucun écran de consentement, échoue si une interaction est
			// requise" → tout user non déjà autorisé (nouveau / re-auth après scope
			// change) est rejeté par Discord (error=consent_required) avant même le
			// callback = login impossible. `consent` affiche l'écran d'autorisation et
			// fonctionne pour tout le monde.
			prompt: "consent",
		},
		twitch: {
			clientId: process.env.TWITCH_AUTH_CLIENT_ID ?? process.env.TWITCH_CLIENT_ID!,
			clientSecret: process.env.TWITCH_AUTH_CLIENT_SECRET ?? process.env.TWITCH_CLIENT_SECRET!,
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
			scope: ["user:read:email", "user:read:follows", "user:read:subscriptions"],
		},
		...googleProvider,
	},

	// rateLimit hérité de commonAuthOptions (enabled, window 10s, max 100).

	account: {
		...commonAuthOptions.account,
		accountLinking: {
			enabled: true,
			trustedProviders: ["discord", "google", "twitch", "patreon"],
		},
	},

	trustedOrigins: [
		"https://rosegriffon.fr",
		"https://www.rosegriffon.fr",
		process.env.BETTER_AUTH_URL ?? "https://rosegriffon.fr",
		"http://localhost:3000",
		"http://localhost:3001",
	].filter((v, i, a) => v && a.indexOf(v) === i),

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
		session: {
			create: {
				after: async (session) => {
					// Isolé en try/catch : une exception ici (réseau Supabase, clé
					// service-role expirée…) abortait le callback OAuth → pas de
					// Set-Cookie → session non persistée. Le sync profil est best-effort,
					// il ne doit jamais casser la connexion.
					try {
						const { data: user } = await getSupabaseAdmin()
							.from("user")
							.select("id, name, image, email")
							.eq("id", session.userId)
							.maybeSingle();
						if (user) await ensureUserProfile(user, getSupabaseAdmin());
					} catch (e) {
						console.error("[auth] session.create.after profile sync failed", e);
					}
				},
			},
		},
		user: {
			create: {
				after: async (user) => {
					await ensureUserProfile(user, getSupabaseAdmin());
				},
			},
		},
	},

	plugins: [
		twoFactor({
			issuer: "Rose Griffon",
		}),
		bearer(),
		genericOAuth({
			config: [
				{
					authorizationUrl: "https://www.patreon.com/oauth2/authorize",
					clientId: process.env.PATREON_CLIENT_ID!,
					clientSecret: process.env.PATREON_CLIENT_SECRET!,
					getUserInfo: async (tokens: unknown) => {
						const accessToken = (tokens as { accessToken?: string }).accessToken;
						if (!accessToken) return null;
						try {
							const resp = await fetchIdentity(accessToken, {
								withMemberships: true,
							});
							const identity = parseIdentityWithMemberships(resp);
							return {
								id: identity.patreonUserId,
								email: identity.user.email ?? `patreon-${identity.patreonUserId}@noemail.local`,
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
					providerId: "patreon",
					scopes: [...SCOPES_PATRON],
					tokenUrl: "https://www.patreon.com/api/oauth2/token",
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
	opts: { isCreator?: boolean } = {}
) {
	if (!account.accessToken || !account.refreshToken) {
		return;
	}
	const isCreator = opts.isCreator === true;
	const fallbackScopes = (isCreator ? SCOPES_CREATOR : SCOPES_PATRON).join(" ");
	try {
		const resp = await fetchIdentity(account.accessToken, {
			withMemberships: true,
		});
		const identity = parseIdentityWithMemberships(resp);
		const top =
			[...identity.memberships].toSorted((a, b) => {
				const score = (s: string | null | undefined) => (s === "active_patron" ? 0 : 1);
				return score(a.attrs.patron_status) - score(b.attrs.patron_status);
			})[0] ?? null;

		const expiresAt = account.accessTokenExpiresAt
			? new Date(account.accessTokenExpiresAt).toISOString()
			: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();

		await Promise.all([
			getSupabaseAdmin()
				.from("patreon_oauth_tokens")
				.upsert(
					{
						access_token_enc: encryptToken(account.accessToken),
						expires_at: expiresAt,
						is_creator: isCreator,
						patreon_user_id: identity.patreonUserId,
						refresh_token_enc: encryptToken(account.refreshToken),
						scope: account.scope ?? fallbackScopes,
						user_id: account.userId,
					},
					{ onConflict: "user_id,patreon_user_id" }
				),
			getSupabaseAdmin()
				.from("patreon_memberships")
				.upsert(
					{
						address: (top?.address ?? null) as never,
						campaign_id: top?.campaignId ?? null,
						currently_entitled_cents: top?.attrs.currently_entitled_amount_cents ?? null,
						discord_role_ids: top?.discordRoleIds ?? [],
						discord_user_id: identity.discordUserId,
						fetched_at: new Date().toISOString(),
						is_free_trial: top?.attrs.is_free_trial ?? null,
						is_gifted: top?.attrs.is_gifted ?? null,
						last_charge_date: top?.attrs.last_charge_date ?? null,
						last_charge_status: top?.attrs.last_charge_status ?? null,
						lifetime_support_cents:
							top?.attrs.campaign_lifetime_support_cents ??
							top?.attrs.lifetime_support_cents ??
							null,
						member_email: top?.attrs.email ?? null,
						next_charge_date: top?.attrs.next_charge_date ?? null,
						note: top?.attrs.note ?? null,
						patreon_email: identity.user.email ?? null,
						patreon_full_name: identity.user.full_name ?? null,
						patreon_member_id: top?.memberId ?? null,
						patreon_thumb_url: identity.user.thumb_url ?? null,
						patreon_url: identity.user.url ?? null,
						patreon_user_id: identity.patreonUserId,
						patron_status: top?.attrs.patron_status ?? null,
						pledge_cadence: top?.attrs.pledge_cadence ?? null,
						pledge_start: top?.attrs.pledge_relationship_start ?? null,
						raw_identity: resp as never,
						scope: account.scope ?? fallbackScopes,
						tier_amounts_cents: top?.tierAmountsCents ?? [],
						tier_ids: top?.tierIds ?? [],
						tier_requires_shipping: top?.tierRequiresShipping ?? [],
						tier_titles: top?.tierTitles ?? [],
						user_id: account.userId,
						will_pay_amount_cents: top?.attrs.will_pay_amount_cents ?? null,
					},
					{ onConflict: "user_id,patreon_user_id" }
				),
			getSupabaseAdmin()
				.from("profiles")
				.update({
					patreon_id: identity.patreonUserId,
					updated_at: new Date().toISOString(),
				})
				.eq("id", account.userId),
		]);
	} catch (error) {
		console.error("[auth/patreon] syncPatreonAccount failed", error);
	}
}

export type AuthSession = typeof auth.$Infer.Session;
export type AuthUser = typeof auth.$Infer.Session.user;
