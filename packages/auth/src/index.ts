import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@rosegriffon/db";
import { ADMIN_ROLES } from "@rosegriffon/types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

/**
 * Common logic to resolve a profile from a Better Auth user,
 * handling the mismatch between Better Auth IDs and Supabase profiles.
 */
export async function resolveProfile(
	supabase: SupabaseClient<Database>,
	user: { id: string; email?: string | null },
): Promise<Profile | null> {
	const tryFetch = async (
		column: keyof Profile,
		value: string,
	): Promise<Profile | null> => {
		const { data } = await supabase
			.from("profiles")
			.select("*")
			.eq(column as string, value)
			.maybeSingle();
		return data as Profile | null;
	};

	// 1. Direct ID match
	let profile = await tryFetch("id", user.id);

	// 2. Discord account fallback
	if (!profile) {
		const { data: account } = await supabase
			.from("account")
			.select("account_id")
			.eq("user_id", user.id)
			.eq("provider_id", "discord")
			.maybeSingle();

		const discordId = (account as { account_id?: string } | null)?.account_id;
		if (discordId) {
			profile = await tryFetch("discord_id", discordId);
		}
	}

	// 3. Email fallback
	if (!profile && user.email) {
		profile = await tryFetch("email", user.email);
	}

	return profile;
}

/**
 * Check if a role is considered 'admin' in the RG ecosystem.
 */
export function isAdmin(role: string | null | undefined): boolean {
	if (!role) return false;
	return (ADMIN_ROLES as readonly string[]).includes(role);
}

/**
 * Check if a role is considered 'staff' in the RG ecosystem.
 */
export function isStaff(role: string | null | undefined): boolean {
	return role === "admin" || role === "staff";
}

import { createSupabaseServiceClient } from "@rosegriffon/db/service";

/**
 * Ensures a profile exists in Supabase for the given user.
 * Standardizes username generation and initial role assignment.
 */
export async function ensureUserProfile(
	user: {
		id: string;
		name?: string | null;
		email?: string | null;
		image?: string | null;
	},
	supabase?: SupabaseClient<Database>,
	options: { defaultRole?: string; appName?: string } = {},
) {
	const db = supabase || createSupabaseServiceClient();
	try {
		const { data: existing } = await db
			.from("profiles")
			.select("*")
			.eq("id", user.id)
			.maybeSingle();

		// Fetch linked accounts to sync provider IDs
		const { data: accounts } = await db
			.from("account")
			.select("provider_id, account_id")
			.eq("user_id", user.id);

		const discordAccount = accounts?.find((a) => a.provider_id === "discord");
		const patreonAccount = accounts?.find((a) => a.provider_id === "patreon");

		const discordId = discordAccount?.account_id || null;
		const patreonId = patreonAccount?.account_id || null;

		if (existing) {
			// Update avatar/name/provider IDs if changed
			const hasAvatarChanged = user.image !== existing.avatar_url;
			const hasNameChanged = user.name !== existing.full_name;
			const hasDiscordChanged = discordId && discordId !== existing.discord_id;
			const hasPatreonChanged = patreonId && patreonId !== existing.patreon_id;

			if (
				hasAvatarChanged ||
				hasNameChanged ||
				hasDiscordChanged ||
				hasPatreonChanged
			) {
				await db
					.from("profiles")
					.update({
						avatar_url: user.image || existing.avatar_url,
						full_name: user.name || existing.full_name,
						discord_id: discordId || existing.discord_id,
						patreon_id: patreonId || existing.patreon_id,
						updated_at: new Date().toISOString(),
					})
					.eq("id", user.id);
			}
			return existing;
		}

		// Generate a clean username
		const username =
			user.name
				?.toLowerCase()
				.replace(/[^a-z0-9_]/g, "_")
				.slice(0, 30) ||
			user.email?.split("@")[0]?.slice(0, 30) ||
			`user-${user.id.slice(0, 8)}`;

		const { data: newProfile, error } = await db
			.from("profiles")
			.upsert(
				{
					id: user.id,
					username,
					full_name: user.name || "",
					avatar_url: user.image || null,
					role: options.defaultRole || "member",
					discord_id: discordId,
					patreon_id: patreonId,
					updated_at: new Date().toISOString(),
				},
				{ onConflict: "id" },
			)
			.select()
			.single();

		if (error) {
			console.error(
				`[@rosegriffon/auth] Failed to create profile for user ${user.id}:`,
				error.message,
			);
			return null;
		}

		return newProfile;
	} catch (err) {
		console.error(
			`[@rosegriffon/auth] Exception in ensureUserProfile for ${user.id}:`,
			err,
		);
		return null;
	}
}

/**
 * Common field mappings for Better Auth tables.
 * Ensures consistent column names across all apps.
 */
export const commonAuthOptions = {
	user: {
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
			maxAge: 5 * 60, // 5 min
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
		// Cookies Secure uniquement en prod : en dev local (http://localhost),
		// un cookie Secure n'est jamais renvoyé par le navigateur → login cassé.
		// Sur Vercel (preview + prod), NODE_ENV vaut toujours "production".
		useSecureCookies: process.env.NODE_ENV === "production",
		// crossSubDomainCookies DÉSACTIVÉ : website (rosegriffon.fr) et azalee
		// (azalee.rosegriffon.fr) ont des instances Better Auth séparées (tables
		// users + secrets distincts) → aucune session partagée possible. Activé,
		// il forçait Domain=<host> sur les cookies et cassait la lecture de session
		// après le callback OAuth → boucle de redirection vers /login. Host-only = OK.
		crossSubDomainCookies: {
			enabled: false,
		},
		ipAddress: {
			ipAddressHeaders: ["x-forwarded-for", "x-real-ip"] as string[],
		},
		defaultCookieAttributes: {
			httpOnly: true,
			secure: process.env.NODE_ENV === "production",
			sameSite: "lax" as const,
		},
	},
	rateLimit: {
		enabled: true,
		window: 10,
		max: 100,
	},
} as const;
