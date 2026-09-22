import { Controller, Get, PathParams, QueryParams } from "@tsed/common";
import { NotFound } from "@tsed/exceptions";
import { Default, Maximum, Minimum } from "@tsed/schema";
import type { Kysely } from "kysely";
import { sql } from "kysely";
import { createAchilleaSql } from "@rosegriffon/db/achillea-sql";

import { BaseController } from "@/utils/classes";

interface GuildScanDatabase {
	guild: unknown;
	guild_role: unknown;
	guild_channel: unknown;
}

const db = createAchilleaSql<GuildScanDatabase>() as Kysely<GuildScanDatabase>;

/**
 * Discord guild metadata + roles + channels.
 * Populated by `scripts/ops/discord/scan-guilds.ts --db` (cron timer).
 */
@Controller("/guilds")
export class GuildsController extends BaseController {
	/**
	 * Paginated list of scanned guilds, ordered by member_count desc.
	 * Returns only guilds that have been scanned at least once (name IS NOT NULL).
	 */
	@Get("/")
	async list(
		@QueryParams("page") @Default(1) @Minimum(1) page: number = 1,
		@QueryParams("limit") @Default(25) @Minimum(1) @Maximum(100) limit: number = 25
	) {
		const offset = (page - 1) * limit;

		const result = await sql<GuildListRow>`SELECT id, name, icon, banner, owner_id, member_count, presence_count,
              features, premium_tier, verification_level, description, scanned_at
       FROM "guild"
       WHERE name IS NOT NULL
       ORDER BY member_count DESC NULLS LAST
		LIMIT ${limit} OFFSET ${offset}`.execute(db);
		const totalResult = await sql<{ total: number }>`SELECT COUNT(*)::int AS total FROM "guild" WHERE name IS NOT NULL`.execute(db);
		const total = totalResult.rows[0]?.total ?? 0;

		return {
			data: result.rows,
			meta: {
				page,
				limit,
				total,
				pageCount: Math.ceil(total / limit),
			},
		};
	}

	/**
	 * Aggregate stats across all scanned guilds.
	 */
	@Get("/stats")
	async stats() {
		const aggregate = await sql<GuildStatsRow>`
      SELECT
        COUNT(*)::int                            AS total_guilds,
        COALESCE(SUM(member_count), 0)::bigint   AS total_members,
        COALESCE(MAX(scanned_at), NULL)          AS last_scan
      FROM "guild"
      WHERE name IS NOT NULL
    `.execute(db);
		const agg = aggregate.rows[0];

		const tierRows = (await sql<PremiumTierRow>`
      SELECT premium_tier, COUNT(*)::int AS count
      FROM "guild"
      WHERE name IS NOT NULL
      GROUP BY premium_tier
      ORDER BY premium_tier
    `.execute(db)).rows;

		const channelTypes = (await sql<ChannelTypeRow>`
      SELECT type, COUNT(*)::int AS count
      FROM "guild_channel"
      GROUP BY type
      ORDER BY type
    `.execute(db)).rows;

		return {
			total_guilds: agg?.total_guilds ?? 0,
			total_members: Number(agg?.total_members ?? 0),
			last_scan: agg?.last_scan ?? null,
			by_premium_tier: tierRows,
			by_channel_type: channelTypes,
		};
	}

	/**
	 * Single guild detail with roles + channels (no members payload).
	 */
	@Get("/:id")
	async detail(@PathParams("id") id: string) {
		const guildResult = await sql<GuildListRow>`SELECT id, name, icon, banner, owner_id, member_count, presence_count,
              features, premium_tier, verification_level, description, scanned_at
	       FROM "guild" WHERE id = ${id}`.execute(db);
		const guild = guildResult.rows[0];
		if (!guild) throw new NotFound(`Guild ${id} not found`);

		const roles = (await sql<GuildRoleRow>`SELECT id, name, color, position, permissions, hoist, managed, mentionable
       FROM "guild_role"
       WHERE guild_id = ${id}
       ORDER BY position DESC`.execute(db)).rows;

		const channels = (await sql<GuildChannelRow>`SELECT id, name, type, parent_id, position, topic, nsfw
       FROM "guild_channel"
       WHERE guild_id = ${id}
       ORDER BY position ASC`.execute(db)).rows;

		return { ...guild, roles, channels };
	}
}

type GuildListRow = Record<string, unknown> & { id: string };
type GuildStatsRow = { total_guilds: number; total_members: string; last_scan: string | null };
type PremiumTierRow = { premium_tier: number | null; count: number };
type ChannelTypeRow = { type: number; count: number };
type GuildRoleRow = Record<string, unknown>;
type GuildChannelRow = Record<string, unknown>;
