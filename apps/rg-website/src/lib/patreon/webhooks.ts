import { verify as patreonVerify } from "@rose-griffon/patreon-bun";

import type {
	JsonApiResource,
	PatreonAddressAttrs,
	PatreonMemberAttrs,
	PatreonTierAttrs,
} from "./types";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * Tous les triggers Patreon v2 — référence officielle :
 * https://docs.patreon.com/#triggers-v2
 */
export type PatreonTrigger =
	| "members:create"
	| "members:update"
	| "members:delete"
	| "members:pledge:create"
	| "members:pledge:update"
	| "members:pledge:delete"
	| "posts:publish"
	| "posts:update"
	| "posts:delete"
	| (string & {});

export const ALL_TRIGGERS: PatreonTrigger[] = [
	"members:create",
	"members:update",
	"members:delete",
	"members:pledge:create",
	"members:pledge:update",
	"members:pledge:delete",
	"posts:publish",
	"posts:update",
	"posts:delete",
];

export interface PatreonWebhookPayload {
	data: JsonApiResource<PatreonMemberAttrs | PatreonPostAttrs>;
	included?: JsonApiResource[];
	links?: Record<string, string>;
}

export interface PatreonPostAttrs {
	title?: string;
	content?: string;
	teaser_text?: string;
	url?: string;
	published_at?: string | null;
	edited_at?: string | null;
	is_public?: boolean;
	is_paid?: boolean;
	embed_url?: string | null;
	embed_data?: Record<string, unknown> | null;
}

/**
 * HMAC-MD5 verification via @rose-griffon/patreon-bun.
 * Constant-time + safe edge cases (null/empty/length mismatch).
 */
export function verifySignature(rawBody: string, signature: string): boolean {
	const secret = process.env.PATREON_WEBHOOK_SECRET;
	if (!secret) return false;
	try {
		return patreonVerify(secret, signature, rawBody);
	} catch {
		return false;
	}
}

/**
 * Extrait les tiers depuis `included[type=tier]` filtrés par les
 * `currently_entitled_tiers` du member.
 */
function parseTiers(
	member: JsonApiResource<PatreonMemberAttrs>,
	included: JsonApiResource[],
): {
	tierIds: string[];
	tierTitles: string[];
	tierAmountsCents: number[];
	tierRequiresShipping: boolean[];
	discordRoleIds: string[];
} {
	const tierRel = member.relationships?.currently_entitled_tiers?.data;
	const refs = Array.isArray(tierRel) ? tierRel : tierRel ? [tierRel] : [];
	const tiers = refs
		.map((r) =>
			(included as unknown as JsonApiResource<PatreonTierAttrs>[]).find(
				(i) => i.type === "tier" && i.id === r.id,
			),
		)
		.filter((t): t is JsonApiResource<PatreonTierAttrs> => Boolean(t));

	return {
		tierIds: tiers.map((t) => t.id),
		tierTitles: tiers
			.map((t) => t.attributes.title)
			.filter((s): s is string => Boolean(s)),
		tierAmountsCents: tiers.map((t) => t.attributes.amount_cents ?? 0),
		tierRequiresShipping: tiers.map(
			(t) => t.attributes.requires_shipping ?? false,
		),
		discordRoleIds: tiers
			.flatMap((t) => t.attributes.discord_role_ids ?? [])
			.filter((s): s is string => Boolean(s)),
	};
}

/**
 * Extrait l'adresse depuis `included[type=address]` si la relation existe.
 */
function parseAddress(
	member: JsonApiResource<PatreonMemberAttrs>,
	included: JsonApiResource[],
): PatreonAddressAttrs | null {
	const rel = member.relationships?.address?.data;
	const id = rel && !Array.isArray(rel) ? rel.id : null;
	if (!id) return null;
	const addr = (
		included as unknown as JsonApiResource<PatreonAddressAttrs>[]
	).find((r) => r.type === "address" && r.id === id);
	return addr?.attributes ?? null;
}

/**
 * Lookup le user RG via `patreon_oauth_tokens` (le compte Patreon a forcément
 * été lié à RG pour qu'on ait stocké un token, sauf flux webhook-first où on
 * ne connaît pas encore le user RG → on stocke quand même côté legacy).
 */
async function resolveRgUserId(
	supabase: ReturnType<typeof createAdminClient>,
	patreonUserId: string,
): Promise<string | null> {
	if (!supabase) return null;
	const { data } = await supabase
		.from("patreon_oauth_tokens")
		.select("user_id")
		.eq("patreon_user_id", patreonUserId)
		.eq("is_creator", false)
		.not("user_id", "is", null)
		.maybeSingle();
	return (data as { user_id: string | null } | null)?.user_id ?? null;
}

/**
 * Dispatch sur le trigger Patreon. Tolère les types d'entités différents
 * (`member` vs `post`) : la lib Patreon n'envoie qu'une entité par event.
 */
export async function processPatreonEvent(
	payload: PatreonWebhookPayload,
	trigger: PatreonTrigger,
): Promise<void> {
	const supabase = createAdminClient();
	if (!supabase) throw new Error("no admin supabase client");

	if (trigger.startsWith("posts:")) {
		await processPostEvent(payload, trigger);
		return;
	}
	await processMemberEvent(payload, trigger);
}

/**
 * Trigger `posts:publish/update/delete` — stocke un audit dans
 * `patreon_post_events`. Utilisable par le digest hebdo + monitoring.
 */
async function processPostEvent(
	payload: PatreonWebhookPayload,
	trigger: PatreonTrigger,
): Promise<void> {
	const supabase = createAdminClient();
	if (!supabase) return;

	const post = payload.data as JsonApiResource<PatreonPostAttrs>;
	const attrs = post.attributes;
	const postId = post.id;

	if (trigger === "posts:delete") {
		await supabase.from("patreon_post_events").upsert(
			{
				patreon_post_id: postId,
				trigger,
				raw_payload: { trigger, payload } as never,
				updated_at: new Date().toISOString(),
			},
			{ onConflict: "patreon_post_id" },
		);
		return;
	}

	const campaignRel = post.relationships?.campaign?.data;
	const campaignId =
		campaignRel && !Array.isArray(campaignRel) ? campaignRel.id : null;

	const teaser =
		attrs.teaser_text ??
		(typeof attrs.content === "string"
			? attrs.content.replace(/<[^>]+>/g, "").slice(0, 300)
			: null);

	await supabase.from("patreon_post_events").upsert(
		{
			patreon_post_id: postId,
			campaign_id: campaignId,
			trigger,
			title: attrs.title ?? null,
			content_excerpt: teaser,
			url: attrs.url ?? null,
			published_at: attrs.published_at ?? null,
			is_paid: attrs.is_paid ?? null,
			is_public: attrs.is_public ?? null,
			embed_url: attrs.embed_url ?? null,
			embed_data: (attrs.embed_data ?? null) as never,
			raw_payload: { trigger, payload } as never,
		},
		{ onConflict: "patreon_post_id" },
	);
}

/**
 * Trigger `members:*` ou `members:pledge:*` — upsert legacy + live memberships.
 */
async function processMemberEvent(
	payload: PatreonWebhookPayload,
	trigger: PatreonTrigger,
): Promise<void> {
	const supabase = createAdminClient();
	if (!supabase) throw new Error("no admin supabase client");

	const member = payload.data as JsonApiResource<PatreonMemberAttrs>;
	const attrs = member.attributes;
	const memberId = member.id;
	const included = payload.included ?? [];

	const userRel = member.relationships?.user?.data;
	const patreonUserId = userRel && !Array.isArray(userRel) ? userRel.id : "";

	const campaignRel = member.relationships?.campaign?.data;
	const campaignId =
		campaignRel && !Array.isArray(campaignRel) ? campaignRel.id : null;

	// === DELETE / pledge:delete : patron_status → former_patron côté legacy + memberships
	if (trigger === "members:delete") {
		await Promise.all([
			supabase
				.from("patreon_legacy_members")
				.update({ rg_subscription_status: "churned" })
				.eq("patreon_member_id", memberId),
			supabase
				.from("patreon_memberships")
				.update({
					patron_status: "former_patron",
					fetched_at: new Date().toISOString(),
				})
				.eq("patreon_member_id", memberId),
		]);
		return;
	}
	if (trigger === "members:pledge:delete") {
		await Promise.all([
			supabase
				.from("patreon_legacy_members")
				.update({
					rg_subscription_status: "churned",
					patron_status: "former_patron",
				})
				.eq("patreon_member_id", memberId),
			supabase
				.from("patreon_memberships")
				.update({
					patron_status: "former_patron",
					currently_entitled_cents: 0,
					will_pay_amount_cents: 0,
					next_charge_date: null,
					fetched_at: new Date().toISOString(),
				})
				.eq("patreon_member_id", memberId),
		]);
		return;
	}

	// === CREATE / UPDATE / pledge:create / pledge:update : upsert dans les 2 tables.
	const tiers = parseTiers(member, included);
	const address = parseAddress(member, included);
	const rgUserId = await resolveRgUserId(supabase, patreonUserId);

	// 1. Legacy (pour rétrocompat avec snapshot J-0)
	await supabase.from("patreon_legacy_members").upsert(
		{
			patreon_member_id: memberId,
			patreon_user_id: patreonUserId,
			email: attrs.email ?? null,
			full_name: attrs.full_name ?? null,
			patron_status: attrs.patron_status ?? "active_patron",
			last_charge_date: attrs.last_charge_date ?? null,
			last_charge_status: attrs.last_charge_status ?? null,
			currently_entitled_cents: attrs.currently_entitled_amount_cents ?? 0,
			lifetime_support_cents: attrs.campaign_lifetime_support_cents ?? 0,
			pledge_start: attrs.pledge_relationship_start ?? null,
			pledge_cadence: attrs.pledge_cadence ?? null,
			tier_titles: tiers.tierTitles,
			tier_ids: tiers.tierIds,
			raw_payload: { trigger, payload },
		},
		{ onConflict: "patreon_member_id" },
	);

	// 2. Live memberships — uniquement si on connaît le user RG
	if (rgUserId) {
		await supabase.from("patreon_memberships").upsert(
			{
				user_id: rgUserId,
				patreon_user_id: patreonUserId,
				patreon_member_id: memberId,
				campaign_id: campaignId,
				patreon_email: attrs.email ?? null,
				patreon_full_name: attrs.full_name ?? null,
				patron_status: attrs.patron_status ?? null,
				last_charge_date: attrs.last_charge_date ?? null,
				last_charge_status: attrs.last_charge_status ?? null,
				currently_entitled_cents: attrs.currently_entitled_amount_cents ?? null,
				lifetime_support_cents:
					attrs.campaign_lifetime_support_cents ??
					attrs.lifetime_support_cents ??
					null,
				pledge_start: attrs.pledge_relationship_start ?? null,
				pledge_cadence: attrs.pledge_cadence ?? null,
				will_pay_amount_cents: attrs.will_pay_amount_cents ?? null,
				next_charge_date: attrs.next_charge_date ?? null,
				is_free_trial: attrs.is_free_trial ?? null,
				is_gifted: attrs.is_gifted ?? null,
				member_email: attrs.email ?? null,
				note: attrs.note ?? null,
				address,
				tier_ids: tiers.tierIds,
				tier_titles: tiers.tierTitles,
				tier_amounts_cents: tiers.tierAmountsCents,
				tier_requires_shipping: tiers.tierRequiresShipping,
				discord_role_ids: tiers.discordRoleIds,
				raw_identity: { trigger, payload } as unknown as Record<
					string,
					unknown
				>,
				fetched_at: new Date().toISOString(),
			},
			{ onConflict: "user_id,patreon_user_id" },
		);
	}
}
