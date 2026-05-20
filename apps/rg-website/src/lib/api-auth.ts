import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { isPatreonAdmin } from "@/lib/patreon/admin-access";
import { createAdminClient } from "@/lib/supabase/server";
import type { Database } from "@rosegriffon/db";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type Role = "admin" | "staff" | "user" | "premium" | "banned" | null;

export interface ApiAuthSuccess {
	user: { id: string; email: string; name: string };
	role: Role;
}

export type ApiAuthResult =
	| { ok: true; data: ApiAuthSuccess }
	| { ok: false; response: NextResponse };

/**
 * API-route equivalent of `requireAuth()` — returns 401 JSON instead of redirecting.
 */
export async function requireApiAuth(): Promise<ApiAuthResult> {
	const session = await auth.api.getSession({ headers: await headers() });
	if (!session?.user) {
		return {
			ok: false,
			response: NextResponse.json(
				{ error: "Non authentifié" },
				{ status: 401 },
			),
		};
	}
	return {
		data: {
			role: null,
			user: {
				email: session.user.email,
				id: session.user.id,
				name: session.user.name,
			},
		},
		ok: true,
	};
}

/**
 * API-route equivalent of `requireAdmin()` — returns 401/403 JSON instead of
 * redirecting. Uses the same 3-strategy resolution (id / discord / email)
 * as the page-level helper.
 */
export async function requireApiAdmin(): Promise<ApiAuthResult> {
	const authed = await requireApiAuth();
	if (!authed.ok) {return authed;}

	const supabase = createAdminClient();
	if (!supabase) {
		return {
			ok: false,
			response: NextResponse.json(
				{ error: "Service indisponible" },
				{ status: 503 },
			),
		};
	}

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

	const { user } = authed.data;

	let profile = await tryFetch("id", user.id);

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

	if (!profile && user.email) {
		profile = await tryFetch("email", user.email);
	}

	const role = (profile?.role ?? null) as Role;
	if (role !== "admin" && role !== "staff") {
		return {
			ok: false,
			response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
		};
	}

	return { data: { role, user }, ok: true };
}

/**
 * API-route equivalent of `requirePatreonCreator()` — restreint l'accès au
 * créateur Patreon principal (rosegriffonfr@gmail.com) ou à la whitelist
 * Discord définie dans `lib/patreon/admin-access.ts`. Renvoie 401/403 JSON.
 */
export async function requireApiPatreonCreator(): Promise<ApiAuthResult> {
	const authed = await requireApiAuth();
	if (!authed.ok) {return authed;}
	const allowed = await isPatreonAdmin(authed.data.user);
	if (!allowed) {
		return {
			ok: false,
			response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
		};
	}
	return authed;
}
