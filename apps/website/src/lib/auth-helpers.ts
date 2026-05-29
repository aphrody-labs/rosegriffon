"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { auth } from "@/lib/auth";
import { isPatreonAdmin } from "@/lib/patreon/admin-access";
import { isAdmin, resolveProfile } from "@rose-griffon/auth";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * Récupère la session Better Auth côté serveur (avec cache React par requête).
 */
export const getServerSession = cache(async () =>
	auth.api.getSession({ headers: await headers() })
);

/**
 * Récupère l'utilisateur authentifié ou null.
 */
export const getServerUser = cache(async () => {
	const session = await getServerSession();
	return session?.user ?? null;
});

/**
 * Assure l'authentification — redirige vers /login si non connecté.
 */
export async function requireAuth() {
	const user = await getServerUser();
	if (!user) {
		redirect("/login");
	}
	return user;
}

/**
 * Assure l'authentification admin — redirige si non admin/staff.
 */
export async function requireAdmin() {
	const user = await requireAuth();
	const supabase = createAdminClient();
	const profile = await resolveProfile(supabase, user);

	if (!profile || !isAdmin(profile.role)) {
		console.warn("[requireAdmin] denied", {
			resolvedRole: profile?.role,
			userId: user.id,
		});
		redirect("/dashboard");
	}

	return { role: profile.role, user };
}

/**
 * Garde stricte pour la zone d'administration Patreon.
 */
export async function requirePatreonCreator() {
	const user = await requireAuth();
	const allowed = await isPatreonAdmin(user);
	if (!allowed) {
		console.warn("[requirePatreonCreator] denied", {
			email: user.email,
			userId: user.id,
		});
		redirect("/dashboard");
	}
	return user;
}
