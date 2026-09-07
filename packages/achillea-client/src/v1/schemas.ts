import { z } from "zod";

/** Runtime contract identifier. Import from `@achillea/client/v1` to pin this contract. */
export const ACHILLEA_GUILDS_CONTRACT_VERSION = "v1" as const;

/** Discord snowflake represented as JSON text to avoid JavaScript integer precision loss. */
export const discordIdSchema = z.string().regex(/^\d{15,25}$/u, "identifiant Discord invalide");

const flexibleNullableNumberSchema = z
	.union([z.number(), z.string()])
	.nullable()
	.transform((value) => {
		if (value === null) return null;
		const number = typeof value === "number" ? value : Number(value);
		return Number.isFinite(number) ? number : null;
	});

export const achilleaRoleSchema = z.object({
	id: discordIdSchema,
	name: z.string(),
	color: z.number().default(0),
	position: z.number().default(0),
	permissions: z.string().nullable().default(null),
	hoist: z.boolean().nullable().default(false),
	managed: z.boolean().nullable().default(false),
	mentionable: z.boolean().nullable().default(false),
});

export const achilleaChannelSchema = z.object({
	id: discordIdSchema,
	name: z.string(),
	type: z.number(),
	parent_id: z.string().nullable().default(null),
	position: z.number().nullable().default(0),
	topic: z.string().nullable().default(null),
	nsfw: z.boolean().nullable().default(false),
});

export const achilleaGuildSchema = z.object({
	id: discordIdSchema,
	name: z.string().nullable(),
	icon: z.string().nullable(),
	banner: z.string().nullable(),
	owner_id: z.string().nullable(),
	member_count: flexibleNullableNumberSchema,
	presence_count: flexibleNullableNumberSchema,
	features: z.array(z.string()).nullable().default(null),
	premium_tier: z.number().nullable().default(0),
	verification_level: z.number().nullable().default(0),
	description: z.string().nullable(),
	scanned_at: z.string().nullable(),
});

export const achilleaGuildDetailSchema = achilleaGuildSchema.extend({
	roles: z.array(achilleaRoleSchema).default([]),
	channels: z.array(achilleaChannelSchema).default([]),
});

export const achilleaGuildPageSchema = z.object({
	data: z.array(achilleaGuildSchema),
	meta: z.object({
		page: z.number(),
		limit: z.number(),
		total: z.number(),
		pageCount: z.number(),
	}),
});

export const achilleaGuildStatsSchema = z.object({
	total_guilds: z.number(),
	total_members: z.union([z.number(), z.string()]).transform(Number),
	last_scan: z.string().nullable(),
	by_premium_tier: z.array(z.object({ premium_tier: z.number(), count: z.number() })).default([]),
	by_channel_type: z.array(z.object({ type: z.number(), count: z.number() })).default([]),
});

export type AchilleaRole = z.infer<typeof achilleaRoleSchema>;
export type AchilleaChannel = z.infer<typeof achilleaChannelSchema>;
export type AchilleaGuild = z.infer<typeof achilleaGuildSchema>;
export type AchilleaGuildDetail = z.infer<typeof achilleaGuildDetailSchema>;
export type AchilleaGuildPage = z.infer<typeof achilleaGuildPageSchema>;
export type AchilleaGuildStats = z.infer<typeof achilleaGuildStatsSchema>;
