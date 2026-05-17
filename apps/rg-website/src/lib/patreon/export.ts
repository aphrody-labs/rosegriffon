import { patreonFetch, refreshAccessToken } from "./client";
import { decryptToken, encryptToken } from "./encryption";
import { TIER_MAPPING } from "./types";
import type {
	JsonApiResource,
	JsonApiResponse,
	PatreonAddressAttrs,
	PatreonMemberAttrs,
	PatreonTierAttrs,
	PatreonUserAttrs,
} from "./types";
import { createAdminClient } from "@/lib/supabase/server";

const MEMBER_FIELDS = [
	"full_name",
	"email",
	"patron_status",
	"last_charge_date",
	"last_charge_status",
	"currently_entitled_amount_cents",
	"campaign_lifetime_support_cents",
	"pledge_relationship_start",
	"pledge_cadence",
	"note",
].join(",");

const USER_FIELDS = "email,full_name,social_connections,thumb_url,url";
const TIER_FIELDS =
	"title,amount_cents,description,discord_role_ids,patron_count,published";
const ADDRESS_FIELDS = "line_1,line_2,city,state,country,postal_code,addressee";

function pickIncluded<T = Record<string, unknown>>(
	included: JsonApiResource[] | undefined,
	type: string,
	id: string,
): JsonApiResource<T> | null {
	if (!included) return null;
	const found = included.find((r) => r.type === type && r.id === id);
	return (found as JsonApiResource<T>) ?? null;
}

function discordIdFromConnections(
	conn: PatreonUserAttrs["social_connections"],
): string | null {
	if (!conn) return null;
	const discord = conn.discord;
	if (!discord || typeof discord !== "object") return null;
	return discord.user_id ?? null;
}

export interface CreatorTokens {
	tokenRowId: string;
	accessToken: string;
	refreshToken: string;
	expiresAt: Date;
}

export async function loadCreatorTokens(): Promise<CreatorTokens> {
	const supabase = createAdminClient();
	if (!supabase) throw new Error("no admin supabase client");
	const { data, error } = await supabase
		.from("patreon_oauth_tokens")
		.select("id,access_token_enc,refresh_token_enc,expires_at")
		.eq("is_creator", true)
		.order("updated_at", { ascending: false })
		.limit(1)
		.maybeSingle();
	if (error) throw error;
	if (!data) {
		// Fallback aux env vars (premier setup avant OAuth creator)
		const accessToken = process.env.PATREON_CREATOR_ACCESS_TOKEN;
		const refreshToken = process.env.PATREON_CREATOR_REFRESH_TOKEN;
		if (!accessToken || !refreshToken) {
			throw new Error(
				"No creator OAuth row and no PATREON_CREATOR_*_TOKEN env fallback",
			);
		}
		return {
			tokenRowId: "env",
			accessToken,
			refreshToken,
			expiresAt: new Date(Date.now() + 60 * 1000),
		};
	}
	const row = data as {
		id: string;
		access_token_enc: string;
		refresh_token_enc: string;
		expires_at: string;
	};
	return {
		tokenRowId: row.id,
		accessToken: decryptToken(row.access_token_enc),
		refreshToken: decryptToken(row.refresh_token_enc),
		expiresAt: new Date(row.expires_at),
	};
}

export async function ensureFreshAccessToken(
	tokens: CreatorTokens,
): Promise<CreatorTokens> {
	const skewMs = 60 * 1000;
	if (tokens.expiresAt.getTime() - Date.now() > skewMs) return tokens;

	const refreshed = await refreshAccessToken(tokens.refreshToken);
	const newTokens: CreatorTokens = {
		tokenRowId: tokens.tokenRowId,
		accessToken: refreshed.access_token,
		refreshToken: refreshed.refresh_token,
		expiresAt: new Date(Date.now() + refreshed.expires_in * 1000),
	};

	const supabase = createAdminClient();
	if (!supabase) return newTokens;

	if (tokens.tokenRowId === "env") {
		// Promote env fallback to a real DB row so subsequent refreshes persist
		const { data, error } = await supabase
			.from("patreon_oauth_tokens")
			.insert({
				user_id: null,
				patreon_user_id: "creator-bootstrap",
				is_creator: true,
				access_token_enc: encryptToken(newTokens.accessToken),
				refresh_token_enc: encryptToken(newTokens.refreshToken),
				expires_at: newTokens.expiresAt.toISOString(),
				scope: refreshed.scope,
			})
			.select("id")
			.maybeSingle();
		if (!error && data) {
			newTokens.tokenRowId = (data as { id: string }).id;
		} else if (error) {
			console.error("[patreon/export] promote env token failed", error);
		}
	} else {
		await supabase
			.from("patreon_oauth_tokens")
			.update({
				access_token_enc: encryptToken(newTokens.accessToken),
				refresh_token_enc: encryptToken(newTokens.refreshToken),
				expires_at: newTokens.expiresAt.toISOString(),
				scope: refreshed.scope,
			})
			.eq("id", tokens.tokenRowId);
	}
	return newTokens;
}

export interface ExportSummary {
	exported: number;
	upserted: number;
	tiersExported: number;
	completedAt: string;
	durationMs: number;
}

export async function exportPatreonMembers(): Promise<ExportSummary> {
	const startedAt = Date.now();
	let tokens = await loadCreatorTokens();
	tokens = await ensureFreshAccessToken(tokens);

	const supabase = createAdminClient();
	if (!supabase) throw new Error("no admin supabase client");

	const campaignId = process.env.PATREON_CAMPAIGN_ID;
	if (!campaignId) throw new Error("PATREON_CAMPAIGN_ID missing");

	await syncTiers(tokens.accessToken, campaignId);

	let cursor: string | null = null;
	let total = 0;
	let upserted = 0;

	do {
		tokens = await ensureFreshAccessToken(tokens);
		const query: Record<string, string> = {
			include: "currently_entitled_tiers,user,address",
			"fields[member]": MEMBER_FIELDS,
			"fields[user]": USER_FIELDS,
			"fields[tier]": TIER_FIELDS,
			"fields[address]": ADDRESS_FIELDS,
			"page[count]": "1000",
		};
		if (cursor) query["page[cursor]"] = cursor;

		const res: JsonApiResponse<PatreonMemberAttrs> = await patreonFetch(
			tokens.accessToken,
			`/campaigns/${campaignId}/members`,
			query,
		);

		const members = Array.isArray(res.data) ? res.data : [res.data];
		total += members.length;

		for (const member of members) {
			const attrs = member.attributes;
			const userRel = member.relationships?.user?.data;
			const userId = userRel && !Array.isArray(userRel) ? userRel.id : null;
			const userResource = userId
				? pickIncluded<PatreonUserAttrs>(res.included, "user", userId)
				: null;
			const userAttrs = userResource?.attributes;

			const tierRels = member.relationships?.currently_entitled_tiers?.data;
			const tierIds = Array.isArray(tierRels) ? tierRels.map((r) => r.id) : [];
			const tierTitles = tierIds
				.map(
					(id) =>
						pickIncluded<PatreonTierAttrs>(res.included, "tier", id)?.attributes
							?.title ?? null,
				)
				.filter((t): t is string => Boolean(t));

			const addressRel = member.relationships?.address?.data;
			const addressId =
				addressRel && !Array.isArray(addressRel) ? addressRel.id : null;
			const addressResource = addressId
				? pickIncluded<PatreonAddressAttrs>(res.included, "address", addressId)
				: null;

			const { error } = await supabase.from("patreon_legacy_members").upsert(
				{
					patreon_member_id: member.id,
					patreon_user_id: userId ?? "",
					email: attrs.email ?? userAttrs?.email ?? null,
					full_name: attrs.full_name ?? userAttrs?.full_name ?? null,
					patron_status: attrs.patron_status ?? "former_patron",
					last_charge_date: attrs.last_charge_date ?? null,
					last_charge_status: attrs.last_charge_status ?? null,
					currently_entitled_cents: attrs.currently_entitled_amount_cents ?? 0,
					lifetime_support_cents: attrs.campaign_lifetime_support_cents ?? 0,
					pledge_start: attrs.pledge_relationship_start ?? null,
					pledge_cadence: attrs.pledge_cadence ?? null,
					tier_titles: tierTitles,
					tier_ids: tierIds,
					discord_user_id: discordIdFromConnections(
						userAttrs?.social_connections,
					),
					shipping_address: addressResource?.attributes ?? null,
					raw_payload: { member, user: userResource, address: addressResource },
				},
				{ onConflict: "patreon_member_id" },
			);
			if (!error) upserted += 1;
			else console.error("[patreon/export] upsert member failed", error);
		}

		cursor = res.meta?.pagination?.cursors?.next ?? null;
		if (cursor) await Bun.sleep(50);
	} while (cursor);

	return {
		exported: total,
		upserted,
		tiersExported: await countTiers(),
		completedAt: new Date().toISOString(),
		durationMs: Date.now() - startedAt,
	};
}

export async function exportSingleMember(
	memberId: string,
): Promise<{ ok: boolean; member?: unknown; error?: string }> {
	try {
		let tokens = await loadCreatorTokens();
		tokens = await ensureFreshAccessToken(tokens);

		const supabase = createAdminClient();
		if (!supabase) return { ok: false, error: "no admin client" };

		const res: JsonApiResponse<PatreonMemberAttrs> = await patreonFetch(
			tokens.accessToken,
			`/members/${memberId}`,
			{
				include: "currently_entitled_tiers,user,address",
				"fields[member]": MEMBER_FIELDS,
				"fields[user]": USER_FIELDS,
				"fields[tier]": TIER_FIELDS,
				"fields[address]": ADDRESS_FIELDS,
			},
		);

		const member = Array.isArray(res.data) ? res.data[0] : res.data;
		if (!member) return { ok: false, error: "member not found" };

		const attrs = member.attributes;
		const userRel = member.relationships?.user?.data;
		const userId = userRel && !Array.isArray(userRel) ? userRel.id : null;
		const userResource = userId
			? pickIncluded<PatreonUserAttrs>(res.included, "user", userId)
			: null;
		const userAttrs = userResource?.attributes;

		const tierRels = member.relationships?.currently_entitled_tiers?.data;
		const tierIds = Array.isArray(tierRels) ? tierRels.map((r) => r.id) : [];
		const tierTitles = tierIds
			.map(
				(id) =>
					pickIncluded<PatreonTierAttrs>(res.included, "tier", id)?.attributes
						?.title ?? null,
			)
			.filter((t): t is string => Boolean(t));

		const addressRel = member.relationships?.address?.data;
		const addressId =
			addressRel && !Array.isArray(addressRel) ? addressRel.id : null;
		const addressResource = addressId
			? pickIncluded<PatreonAddressAttrs>(res.included, "address", addressId)
			: null;

		const { error } = await supabase.from("patreon_legacy_members").upsert(
			{
				patreon_member_id: member.id,
				patreon_user_id: userId ?? "",
				email: attrs.email ?? userAttrs?.email ?? null,
				full_name: attrs.full_name ?? userAttrs?.full_name ?? null,
				patron_status: attrs.patron_status ?? "former_patron",
				last_charge_date: attrs.last_charge_date ?? null,
				last_charge_status: attrs.last_charge_status ?? null,
				currently_entitled_cents: attrs.currently_entitled_amount_cents ?? 0,
				lifetime_support_cents: attrs.campaign_lifetime_support_cents ?? 0,
				pledge_start: attrs.pledge_relationship_start ?? null,
				pledge_cadence: attrs.pledge_cadence ?? null,
				tier_titles: tierTitles,
				tier_ids: tierIds,
				discord_user_id: discordIdFromConnections(
					userAttrs?.social_connections,
				),
				shipping_address: addressResource?.attributes ?? null,
				raw_payload: { member, user: userResource, address: addressResource },
			},
			{ onConflict: "patreon_member_id" },
		);
		if (error) return { ok: false, error: error.message };
		return { ok: true, member };
	} catch (e) {
		return { ok: false, error: e instanceof Error ? e.message : String(e) };
	}
}

async function countTiers(): Promise<number> {
	const supabase = createAdminClient();
	if (!supabase) return 0;
	const { count } = await supabase
		.from("patreon_legacy_tiers")
		.select("*", { count: "exact", head: true });
	return count ?? 0;
}

export async function syncTiers(
	accessToken: string,
	campaignId: string,
): Promise<void> {
	const supabase = createAdminClient();
	if (!supabase) return;

	const res = await patreonFetch<PatreonTierAttrs>(
		accessToken,
		`/campaigns/${campaignId}`,
		{
			include: "tiers",
			"fields[tier]": TIER_FIELDS,
		},
	);

	const tiers = (res.included ?? []).filter((r) => r.type === "tier");
	for (const tier of tiers) {
		const attrs = tier.attributes as PatreonTierAttrs;
		const title = attrs.title ?? "Untitled tier";
		const mapping = TIER_MAPPING[title];
		const rgPriceId = mapping
			? (process.env[mapping.stripePriceEnv] ?? null)
			: null;
		await supabase.from("patreon_legacy_tiers").upsert(
			{
				patreon_tier_id: tier.id,
				title,
				amount_cents: attrs.amount_cents ?? 0,
				description: attrs.description ?? null,
				discord_role_ids: attrs.discord_role_ids ?? [],
				patron_count: attrs.patron_count ?? null,
				published: attrs.published ?? null,
				rg_plan_name: mapping?.rgPlanName ?? null,
				rg_price_id: rgPriceId,
			},
			{ onConflict: "patreon_tier_id" },
		);
	}
}
