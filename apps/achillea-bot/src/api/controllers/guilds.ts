import { Controller, Get, PathParams, QueryParams } from "@tsed/common";
import { NotFound } from "@tsed/exceptions";
import { Default, Maximum, Minimum } from "@tsed/schema";

import { Database } from "@/services";
import { BaseController } from "@/utils/classes";
import { resolveDependenciesSync } from "@/utils/functions";

/**
 * Discord guild metadata + roles + channels.
 * Populated by `scripts/ops/discord/scan-guilds.ts --db` (cron timer).
 */
@Controller("/guilds")
export class GuildsController extends BaseController {
	private db: Database;

	constructor() {
		super();
		[this.db] = resolveDependenciesSync([Database]);
	}

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
		const conn = this.db.em.getConnection();

		const rows = await conn.execute(
			`SELECT id, name, icon, banner, owner_id, member_count, presence_count,
              features, premium_tier, verification_level, description, scanned_at
       FROM "guild"
       WHERE name IS NOT NULL
       ORDER BY member_count DESC NULLS LAST
       LIMIT ? OFFSET ?`,
			[limit, offset]
		);
		const totalRows = (await conn.execute(
			`SELECT COUNT(*)::int AS total FROM "guild" WHERE name IS NOT NULL`
		)) as Array<{ total: number }>;
		const total = totalRows[0]?.total ?? 0;

		return {
			data: rows,
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
		const conn = this.db.em.getConnection();
		const [agg] = (await conn.execute(`
      SELECT
        COUNT(*)::int                            AS total_guilds,
        COALESCE(SUM(member_count), 0)::bigint   AS total_members,
        COALESCE(MAX(scanned_at), NULL)          AS last_scan
      FROM "guild"
      WHERE name IS NOT NULL
    `)) as Array<{ total_guilds: number; total_members: string; last_scan: string | null }>;

		const tierRows = (await conn.execute(`
      SELECT premium_tier, COUNT(*)::int AS count
      FROM "guild"
      WHERE name IS NOT NULL
      GROUP BY premium_tier
      ORDER BY premium_tier
    `)) as Array<{ premium_tier: number; count: number }>;

		const channelTypes = (await conn.execute(`
      SELECT type, COUNT(*)::int AS count
      FROM "guild_channel"
      GROUP BY type
      ORDER BY type
    `)) as Array<{ type: number; count: number }>;

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
		const conn = this.db.em.getConnection();

		const [guild] = (await conn.execute(
			`SELECT id, name, icon, banner, owner_id, member_count, presence_count,
              features, premium_tier, verification_level, description, scanned_at
       FROM "guild" WHERE id = ?`,
			[id]
		)) as any[];
		if (!guild) throw new NotFound(`Guild ${id} not found`);

		const roles = (await conn.execute(
			`SELECT id, name, color, position, permissions, hoist, managed, mentionable
       FROM "guild_role"
       WHERE guild_id = ?
       ORDER BY position DESC`,
			[id]
		)) as any[];

		const channels = (await conn.execute(
			`SELECT id, name, type, parent_id, position, topic, nsfw
       FROM "guild_channel"
       WHERE guild_id = ?
       ORDER BY position ASC`,
			[id]
		)) as any[];

		return { ...guild, roles, channels };
	}
}
