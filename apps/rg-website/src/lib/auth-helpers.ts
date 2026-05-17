"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { auth } from "@/lib/auth";
import { isPatreonAdmin } from "@/lib/patreon/admin-access";
import { createAdminClient } from "@/lib/supabase/server";
import type { Database } from "@/types/supabase";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

/**
 * Récupère la session Better Auth côté serveur (avec cache React par requête).
 */
export const getServerSession = cache(async () => {
	return auth.api.getSession({ headers: await headers() });
});

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
	if (!user) redirect("/login");
	return user;
}

/**
 * Assure l'authentification admin — redirige si non admin/staff.
 *
 * Better Auth user.id ne correspond PAS toujours à profiles.id (qui pointe vers auth.users
 * Supabase). On essaie 3 stratégies dans l'ordre :
 *   1. Match direct user.id == profiles.id (legacy users créés via Supabase Auth)
 *   2. Bridge via account.account_id Discord → profiles.discord_id (Better Auth Discord login)
 *   3. Bridge via email (profiles.email == user.email)
 *
 * Utilise admin client (service role) pour bypass RLS.
 */
export async function requireAdmin() {
	const user = await requireAuth();
	const supabase = createAdminClient();
	if (!supabase) redirect("/dashboard");

	const tryFetch = async (
		column: keyof Profile,
		value: string,
	): Promise<Pick<Profile, "role"> | null> => {
		const { data } = await supabase
			.from("profiles")
			.select("role")
			.eq(column as string, value)
			.maybeSingle();
		return data as Pick<Profile, "role"> | null;
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

	const role = profile?.role ?? null;
	if (role !== "admin" && role !== "staff") {
		console.warn("[requireAdmin] denied", {
			userId: user.id,
			email: user.email,
			resolvedRole: role,
			hadProfile: profile !== null,
		});
		redirect("/dashboard");
	}

	return { user, role };
}

/**
 * Garde stricte pour la zone d'administration Patreon : exige que l'utilisateur
 * soit le créateur Patreon principal (email rosegriffonfr@gmail.com) OU figure
 * dans la whitelist Discord (cf. `lib/patreon/admin-access.ts`).
 */
export async function requirePatreonCreator() {
	const user = await requireAuth();
	const allowed = await isPatreonAdmin(user);
	if (!allowed) {
		console.warn("[requirePatreonCreator] denied", {
			userId: user.id,
			email: user.email,
		});
		redirect("/dashboard");
	}
	return user;
}
