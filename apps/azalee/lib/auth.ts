import crypto from "node:crypto";
import { createSupabaseServiceClient } from "@rg/db/service";
import bcrypt from "bcryptjs";
import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { bearer } from "better-auth/plugins";
import { Pool } from "pg";
import { logAudit } from "@/lib/audit";
import { ADMIN_ROLES } from "@/lib/auth-roles";
import { getIPIntelligence } from "@/lib/ip-intelligence";
import { sendEmail } from "@/src/lib/email";

const pool = new Pool({
	connectionString: process.env.DATABASE_URL,
});

// Service-role Supabase client for creating profiles in the hook
const supabaseAdmin = createSupabaseServiceClient();

/**
 * Ensures a profile exists in Supabase for the given user.
 * Used by auth hooks and for self-healing in the layout.
 */
export async function ensureUserProfile(user: {
	id: string;
	name?: string;
	email: string;
	image?: string | null;
}) {
	try {
		const username =
			user.name
				?.toLowerCase()
				.replaceAll(/[^a-z0-9_]/g, "_")
				.slice(0, 30) || user.email.split("@")[0];

		const { data } = await supabaseAdmin
			.from("profiles")
			.select("*")
			.eq("id", user.id)
			.maybeSingle();

		if (data) return data;

		const { data: newProfile, error: insertError } = await supabaseAdmin
			.from("profiles")
			.upsert(
				{
					id: user.id,
					username,
					full_name: user.name || "",
					avatar_url: user.image || null,
					role: "member",
					updated_at: new Date().toISOString(),
				},
				{ onConflict: "id" },
			)
			.select()
			.single();

		if (insertError) {
			console.error(
				"[Ensure Profile] Failed to create profile for user:",
				user.id,
				insertError,
			);
			return null;
		}

		await logAudit(user.id, "profile_created", {
			email: user.email,
			name: user.name,
		});
		return newProfile;
	} catch (err) {
		console.error("[Ensure Profile] Exception creating profile:", user.id, err);
		return null;
	}
}

export const auth = betterAuth({
	database: pool,
	baseURL: process.env.BETTER_AUTH_URL,
	secret: process.env.BETTER_AUTH_SECRET,
	trustedOrigins: [
		process.env.BETTER_AUTH_URL || "https://azalee.rosegriffon.fr",
	],

	emailVerification: {
		sendOnSignUp: true,
		autoSignInAfterVerification: true,
		sendVerificationEmail: async ({ user, url }) => {
			void sendEmail({
				to: user.email,
				subject: "Vérifie ton adresse email — Azalée",
				html: `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#1A120D;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#1A120D;padding:40px 20px">
    <tr><td align="center">
      <table width="100%" style="max-width:480px;background:#2D1F14;border-radius:28px;overflow:hidden">
        <tr><td style="padding:40px 32px 24px;text-align:center">
          <h1 style="margin:0 0 8px;font-size:22px;font-weight:800;color:#F2A93B">Confirme ton email</h1>
          <p style="margin:0;font-size:15px;color:#BBA998;line-height:1.5">
            Bienvenue sur Azalée ! Clique sur le bouton pour vérifier <strong style="color:#E8D5C4">${user.email}</strong>.
          </p>
        </td></tr>
        <tr><td style="padding:0 32px 32px;text-align:center">
          <a href="${url}" style="display:inline-block;padding:14px 36px;background:#8B5023;color:#fff;font-size:15px;font-weight:700;text-decoration:none;border-radius:100px">
            Vérifier mon email
          </a>
          <p style="margin:20px 0 0;font-size:12px;color:#6B5D52;line-height:1.5">
            Ce lien expire dans 1 heure. Si tu n'as pas créé de compte, ignore cet email.
          </p>
        </td></tr>
        <tr><td style="padding:16px 32px;border-top:1px solid #3D2E22;text-align:center">
          <p style="margin:0;font-size:11px;color:#6B5D52">Azalée — Rose Griffon</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
			});
		},
	},

	emailAndPassword: {
		enabled: true,
		requireEmailVerification: false, // ne pas bloquer l'accès si pas vérifié
		password: {
			// Hybrid verify: supports both bcrypt (migrated from GoTrue) and default Scrypt (new signups)
			verify: async ({ hash, password }) => {
				// Bcrypt hashes start with $2a$ or $2b$
				if (hash.startsWith("$2a$") || hash.startsWith("$2b$")) {
					return bcrypt.compare(password, hash);
				}
				// Fall back to Better Auth's default Scrypt verification
				const { verifyPassword } = await import("better-auth/crypto");
				return verifyPassword({ hash, password });
			},
		},
		sendResetPassword: async ({ user, url }) => {
			// Fire-and-forget pour éviter les timing attacks (détection d'email existant)
			void sendEmail({
				to: user.email,
				subject: "Réinitialisation de ton mot de passe — Azalée",
				html: `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#1A120D;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#1A120D;padding:40px 20px">
    <tr><td align="center">
      <table width="100%" style="max-width:480px;background:#2D1F14;border-radius:28px;overflow:hidden">
        <tr><td style="padding:40px 32px 24px;text-align:center">
          <img src="${process.env.BETTER_AUTH_URL || "https://azalee.rosegriffon.fr"}/logo.webp" alt="Azalée" width="48" height="48" style="border-radius:12px;margin-bottom:16px">
          <h1 style="margin:0 0 8px;font-size:22px;font-weight:800;color:#F2A93B">Mot de passe oublié ?</h1>
          <p style="margin:0;font-size:15px;color:#BBA998;line-height:1.5">
            Quelqu'un a demandé la réinitialisation du mot de passe pour <strong style="color:#E8D5C4">${user.email}</strong>.
          </p>
        </td></tr>
        <tr><td style="padding:0 32px 32px;text-align:center">
          <a href="${url}" style="display:inline-block;padding:14px 36px;background:#8B5023;color:#fff;font-size:15px;font-weight:700;text-decoration:none;border-radius:100px">
            Réinitialiser mon mot de passe
          </a>
          <p style="margin:20px 0 0;font-size:12px;color:#8A7A6D;line-height:1.5">
            Si le bouton ne fonctionne pas, copie ce lien :<br>
            <a href="${url}" style="color:#F2A93B;word-break:break-all">${url}</a>
          </p>
          <p style="margin:16px 0 0;font-size:12px;color:#6B5D52;line-height:1.5">
            Ce lien expire dans 1 heure. Si tu n'as pas fait cette demande, ignore cet email.
          </p>
        </td></tr>
        <tr><td style="padding:16px 32px;border-top:1px solid #3D2E22;text-align:center">
          <p style="margin:0;font-size:11px;color:#6B5D52">Azalée — Rose Griffon</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
			});
		},
	},

	socialProviders: {
		google: {
			clientId: process.env.GOOGLE_CLIENT_ID!,
			clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
		},
		discord: {
			clientId: process.env.DISCORD_CLIENT_ID!,
			clientSecret: process.env.DISCORD_CLIENT_SECRET!,
		},
	},

	// Rate limiting: protection brute-force
	rateLimit: {
		enabled: true,
		window: 10,
		max: 100,
		customRules: {
			"/sign-in/email": { window: 60, max: 10 },
			"/sign-up/email": { window: 60, max: 5 },
			"/forget-password": { window: 60, max: 3 },
		},
	},

	user: {
		changeEmail: {
			enabled: true,
		},
		fields: {
			emailVerified: "email_verified",
			createdAt: "created_at",
			updatedAt: "updated_at",
		},
	},

	session: {
		expiresIn: 60 * 60 * 24 * 30, // 30 days
		updateAge: 60 * 60 * 24, // 1 day
		cookieCache: {
			enabled: true,
			maxAge: 5 * 60, // 5 min cache → fewer DB queries
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
			trustedProviders: ["google", "discord"],
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

	advanced: {
		useSecureCookies: true, // Force Secure flag (HTTPS behind Nginx)
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

	databaseHooks: {
		user: {
			create: {
				after: async (user, ctx) => {
					// Create profile in Supabase (replaces the on_auth_user_created trigger)
					await ensureUserProfile(user);

					// Log signup with Smart IP Intelligence
					const ip =
						ctx?.headers?.get("x-forwarded-for")?.split(",")[0]?.trim() ||
						"unknown";
					const ipInfo = await getIPIntelligence(ip);

					await logAudit(
						user.id,
						"signup",
						{
							email: user.email,
							name: user.name,
							geo: ipInfo
								? {
										city: ipInfo.city,
										country: ipInfo.country,
										privacy: ipInfo.privacy,
									}
								: undefined,
						},
						{ ipAddress: ip },
					);
				},
			},
		},
		session: {
			create: {
				before: async (session) => {
					// Extend session to 10 years for admin/editor roles
					try {
						const { data: profile } = await supabaseAdmin
							.from("profiles")
							.select("role")
							.eq("id", session.userId)
							.maybeSingle();

						if (
							profile &&
							ADMIN_ROLES.includes(profile.role as (typeof ADMIN_ROLES)[number])
						) {
							const tenYears = new Date();
							tenYears.setFullYear(tenYears.getFullYear() + 10);
							return { data: { ...session, expiresAt: tenYears } };
						}
					} catch {
						// Fallback to default expiry
					}
					return { data: session };
				},
				after: async (session) => {
					// Log login with Smart IP Intelligence (Better Auth populates session.ipAddress based on config)
					const ip = session.ipAddress || "unknown";
					const ipInfo = await getIPIntelligence(ip);

					await logAudit(
						session.userId,
						"login",
						{
							geo: ipInfo
								? {
										city: ipInfo.city,
										country: ipInfo.country,
										privacy: ipInfo.privacy,
										org: ipInfo.org,
									}
								: undefined,
						},
						{ ipAddress: ip },
					);
				},
			},
		},
	},

	// bearer() : auth via header Authorization Bearer (utile pour API/mobile)
	// nextCookies() : OBLIGATOIRE Next.js — propage Set-Cookie depuis server actions. DOIT être en dernier.
	plugins: [bearer(), nextCookies()],
});
