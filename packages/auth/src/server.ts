import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { resolveProfile, isAdmin } from "./index";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@rose-griffon/db";

/**
 * Server-only helpers requiring Next.js runtime.
 */

/**
 * Assure l'authentification admin — redirige si non autorisé.
 */
export async function createAdminGuard(
	authInstance: any,
	supabase: SupabaseClient<Database>,
	options: { redirectTo?: string; fallbackRole?: string } = {},
) {
	const session = await authInstance.api.getSession({
		headers: await headers(),
	});

	if (!session?.user) {
		redirect(options.redirectTo || "/login");
	}

	const profile = await resolveProfile(supabase, session.user);

	if (!profile || !isAdmin(profile.role)) {
		console.warn("[adminGuard] denied", {
			userId: session.user.id,
			resolvedRole: profile?.role,
		});
		redirect(options.redirectTo || "/dashboard");
	}

	return { user: session.user, profile };
}

/**
 * Assure l'authentification avec un rôle spécifique.
 */
export async function createRoleGuard(
	authInstance: any,
	supabase: SupabaseClient<Database>,
	allowedRoles: string[],
	options: { redirectTo?: string } = {},
) {
	const session = await authInstance.api.getSession({
		headers: await headers(),
	});

	if (!session?.user) {
		redirect(options.redirectTo || "/login");
	}

	const profile = await resolveProfile(supabase, session.user);

	if (!profile || !profile.role || !allowedRoles.includes(profile.role)) {
		console.warn("[roleGuard] denied", {
			userId: session.user.id,
			resolvedRole: profile?.role,
			allowedRoles,
		});
		redirect(options.redirectTo || "/dashboard");
	}

	return { user: session.user, profile };
}
