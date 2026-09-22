import type { Kysely } from "kysely";
import { sql } from "kysely";
import type { Database } from "@rosegriffon/db/schema";

export abstract class LeaderboardService {
	private static async activeSeason(db: Kysely<Database>) {
		return db.selectFrom("season")
			.select(["id", "config"])
			.where("state", "=", "Active")
			.orderBy("starts_at", "desc")
			.executeTakeFirst();
	}

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

	/** Canonical public ranked ladder projection, including the active season. */
	static async findActiveTop(db: Kysely<Database>, mode: number, limit = 50, offset = 0) {
		const season = await this.activeSeason(db);
		return this.findTop(db, mode, season?.id ?? null, limit, offset);
	}

	/** Canonical 11-tier projection used by both the website and ranked client. */
	static async findTiers(db: Kysely<Database>, mode: number) {
		const season = await this.activeSeason(db);
		const seasonId = season?.id ?? null;
		const rows = await db.selectFrom("rank")
			.selectAll("rank")
			.select(sql<number>`count(ue.user_id)`.as("player_count"))
			.leftJoin("user_elo as ue", (join) => {
				let clause = join
					.onRef("ue.elo", ">=", "rank.min_elo")
					.onRef("ue.elo", "<=", "rank.max_elo")
					.on("ue.mode", "=", mode);
				clause = seasonId === null
					? clause.on("ue.season_id", "is", null)
					: clause.on("ue.season_id", "=", seasonId);
				return clause;
			})
			.groupBy(["rank.id", "rank.key", "rank.min_elo", "rank.max_elo", "rank.emoji_id", "rank.emoji_key", "rank.gradient"])
			.orderBy("rank.min_elo", "asc")
			.execute();
		return rows.map((row) => ({
			key: row.key,
			minElo: row.min_elo,
			maxElo: row.max_elo,
			gradient: row.gradient,
			emojiId: row.emoji_id,
			emojiKey: row.emoji_key,
			playerCount: Number(row.player_count),
		}));
	}

	/** Canonical authenticated profile projection. Creates the initial ladder row idempotently. */
	static async findProfile(db: Kysely<Database>, userId: string, mode: number) {
		const season = await this.activeSeason(db);
		const seasonId = season?.id ?? null;
		const baseRating = Number((season?.config as { baseRating?: number } | null)?.baseRating ?? 0);
		await db.insertInto("user_elo").values({
			user_id: userId,
			mode,
			season_id: seasonId,
			elo: baseRating,
			peak_rating: baseRating,
			games_played: 0,
			wins: 0,
			losses: 0,
		}).onConflict((oc) => oc.columns(["user_id", "mode"]).doNothing()).execute();
		const elo = await db.selectFrom("user_elo")
			.select(["user_id", "mode", "season_id", "elo", "peak_rating", "games_played", "wins", "losses"])
			.where("user_id", "=", userId).where("mode", "=", mode)
			.executeTakeFirst();
		if (!elo) return null;
		const ranks = await db.selectFrom("rank").selectAll().orderBy("min_elo", "asc").execute();
		const tier = ranks.find((rank) => Number(elo.elo) >= rank.min_elo && Number(elo.elo) <= rank.max_elo);
		let rankQuery = db.selectFrom("user_elo as ranked").select(sql<number>`count(distinct ranked.elo)`.as("rank"))
			.where("ranked.mode", "=", mode).where("ranked.elo", ">=", elo.elo);
		let totalQuery = db.selectFrom("user_elo").select(({ fn }) => fn.countAll<number>().as("total")).where("mode", "=", mode);
		if (elo.season_id === null) {
			rankQuery = rankQuery.where("ranked.season_id", "is", null);
			totalQuery = totalQuery.where("season_id", "is", null);
		} else {
			rankQuery = rankQuery.where("ranked.season_id", "=", elo.season_id);
			totalQuery = totalQuery.where("season_id", "=", elo.season_id);
		}
		const [rankRow, totalRows] = await Promise.all([rankQuery.executeTakeFirst(), totalQuery.executeTakeFirst()]);
		const globalRank = rankRow?.rank == null ? null : Number(rankRow.rank);
		const totalPlayers = Number(totalRows?.total ?? 0);
		return {
			userId: elo.user_id, mode: elo.mode, elo: Number(elo.elo), peakRating: Number(elo.peak_rating),
			gamesPlayed: Number(elo.games_played), wins: Number(elo.wins), losses: Number(elo.losses), seasonId: elo.season_id,
			globalRank, totalPlayers,
			percentile: globalRank && totalPlayers > 0 ? Math.max(0.1, Math.round((globalRank / totalPlayers) * 1000) / 10) : null,
			tier: tier ? { key: tier.key, minElo: tier.min_elo, maxElo: tier.max_elo, emojiId: tier.emoji_id, emojiKey: tier.emoji_key, gradient: tier.gradient } : null,
		};
	}

}
