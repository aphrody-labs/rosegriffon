import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { ADMIN_ROLES, MEDAILLE_AZALEE_ROLE_ID } from "@/lib/auth-roles";
import { createClient } from "@/lib/supabase/server";

/**
 * Get the current Better Auth session server-side.
 * Returns { user, session } or null.
 */
export async function getServerSession() {
	try {
		const reqHeaders = await headers();
		const session = await auth.api.getSession({ headers: reqHeaders });
		return session;
	} catch {
		return null;
	}
}

/**
 * Require auth — returns user or null.
 * Use in server components / actions that need authentication.
 */
export async function requireAuth() {
	const session = await getServerSession();
	if (!session?.user) {
		return null;
	}
	return session.user;
}

/**
 * Require auth or fail with an error (for server actions).
 * Throws if no valid session.
 */
export async function requireAuthOrFail() {
	const session = await getServerSession();
	if (!session?.user) {
		throw new Error("Non autorisé");
	}
	return session;
}

/**
 * Require admin role — redirects to "/" if not admin/editor/moderator.
 * Use in admin pages.
 */
export async function requireAdmin() {
	const session = await getServerSession();
	if (!session?.user) {
		redirect("/login");
	}

	const supabase = await createClient();
	const { data: profile, error } = await supabase
		.from("profiles")
		.select("role")
		.eq("id", session.user.id)
		.single();

	if (error) {
		console.error("[requireAdmin] Profile fetch failed:", error.message);
		redirect("/");
	}

	if (
		!profile ||
		!ADMIN_ROLES.includes(profile.role as (typeof ADMIN_ROLES)[number])
	) {
		redirect("/");
	}

	return { session, profile };
}

/**
 * Same as requireAdmin but throws instead of redirecting.
 * Use in server actions invoked over POST.
 */
export async function requireAdminOrFail() {
	const session = await getServerSession();
	if (!session?.user) throw new Error("Non autorisé");

	const supabase = await createClient();
	const { data: profile } = await supabase
		.from("profiles")
		.select("role")
		.eq("id", session.user.id)
		.single();

	if (
		!profile ||
		!ADMIN_ROLES.includes(profile.role as (typeof ADMIN_ROLES)[number])
	) {
		throw new Error("Accès réservé aux administrateurs");
	}

	return { session, profile };
}

/**
 * True if the user with the given Discord ID owns the Médaille Azalée role.
 */
export async function hasMedailleAzaleeRole(
	discordId: string | null | undefined,
): Promise<boolean> {
	if (!discordId) return false;
	const supabase = await createClient();
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const { data } = (await (supabase as any)
		.from("discord_members")
		.select("roles")
		.eq("discord_id", discordId)
		.single()) as { data: { roles: unknown } | null };

	if (!data?.roles) return false;

	const roles = Array.isArray(data.roles)
		? (data.roles as string[])
		: (() => {
				try {
					return JSON.parse(String(data.roles)) as string[];
				} catch {
					return [];
				}
			})();

	return roles.includes(MEDAILLE_AZALEE_ROLE_ID);
}

/**
 * Editor-tier guard: ADMIN_ROLES or Médaille Azalée members.
 * Mirrors the policy of `app/dashboard/layout.tsx`.
 * Throws on failure (use in server actions). Returns the session+profile on success.
 */
export async function requireEditorOrFail() {
	const session = await getServerSession();
	if (!session?.user) throw new Error("Non autorisé");

	const supabase = await createClient();
	const { data: profile } = await supabase
		.from("profiles")
		.select("role, discord_id")
		.eq("id", session.user.id)
		.single();

	if (!profile) throw new Error("Profil introuvable");

	if (ADMIN_ROLES.includes(profile.role as (typeof ADMIN_ROLES)[number])) {
		return {
			session,
			profile,
			isAdmin: true as const,
			isMedaille: false as const,
		};
	}

	if (await hasMedailleAzaleeRole(profile.discord_id)) {
		return {
			session,
			profile,
			isAdmin: false as const,
			isMedaille: true as const,
		};
	}

	throw new Error("Accès réservé à l'équipe rédactionnelle");
}
