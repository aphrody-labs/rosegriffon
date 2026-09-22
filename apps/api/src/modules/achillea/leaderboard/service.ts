import type { Kysely } from "kysely";
import { sql } from "kysely";
import type { Database } from "@rosegriffon/db/schema";

export abstract class LeaderboardService {
	static async findTop(db: Kysely<Database>, mode: number, seasonId: string | null, limit = 50, offset = 0) {
		const safeLimit = Math.min(100, Math.max(1, limit));
		const safeOffset = Math.max(0, offset);
		let query = db.selectFrom("user_elo as ue")
			.leftJoin("user as u", "u.id", "ue.user_id")
			.select([
				"ue.user_id", "u.username", "u.display_name", "u.avatar",
				"ue.elo", "ue.peak_rating", "ue.games_played",
				sql<number>`dense_rank() over (order by ue.elo desc)`.as("rank"),
			])
			.where("ue.mode", "=", mode);
		query = seasonId === null ? query.where("ue.season_id", "is", null) : query.where("ue.season_id", "=", seasonId);
		const rows = await query.orderBy("ue.elo", "desc").limit(safeLimit).offset(safeOffset).execute();
		let countQuery = db.selectFrom("user_elo").select(({ fn }) => fn.countAll<number>().as("count")).where("mode", "=", mode);
		countQuery = seasonId === null ? countQuery.where("season_id", "is", null) : countQuery.where("season_id", "=", seasonId);
		const count = await countQuery.executeTakeFirst();
		return {
			data: rows.map((row) => ({ userId: row.user_id, username: row.username, displayName: row.display_name ?? row.username ?? row.user_id, avatar: row.avatar, elo: Number(row.elo), peakRating: Number(row.peak_rating), gamesPlayed: Number(row.games_played), rank: Number(row.rank) })),
			count: Number(count?.count ?? 0),
		};
	}
}
