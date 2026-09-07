import { singleton } from "tsyringe";

import { MatchMode } from "@/utils/enums";

import { Database } from "./Database";

export interface LeaderboardEntry {
	userId: string;
	elo: number;
	peakRating: number;
	gamesPlayed: number;
	rank: number;
}

export interface LeaderboardPage {
	entries: LeaderboardEntry[];
	total: number;
}

@singleton()
export class LeaderboardService {
	constructor(private db: Database) {}

	async getTop(
		seasonId: string | null,
		mode: MatchMode,
		limit: number = 10,
		offset: number = 0
	): Promise<LeaderboardPage> {
		const em = this.db.em.fork();

		// MikroORM v7 : Knex remplacé par Kysely — on passe par em.execute() (SQL brut)
		// pour conserver les window functions PostgreSQL (DENSE_RANK).
		const seasonClause = seasonId !== null ? "ue.season_id = ?" : "ue.season_id IS NULL";
		const baseParams: unknown[] = seasonId !== null ? [seasonId, mode] : [mode];

		const rankedSql = `
			SELECT
				ue.user_id,
				ue.elo,
				ue.peak_rating,
				ue.games_played,
				DENSE_RANK() OVER (ORDER BY ue.elo DESC) AS rank
			FROM user_elo AS ue
			WHERE ${seasonClause}
			  AND ue.mode = ?
		`;

		// Comptage total
		const countSql = `
			SELECT COUNT(*) AS total
			FROM user_elo AS ue
			WHERE ${seasonClause}
			  AND ue.mode = ?
		`;

		const paginatedSql = `
			SELECT * FROM (${rankedSql}) AS ranked
			ORDER BY rank ASC
			LIMIT ? OFFSET ?
		`;

		const [countRows, rows] = await Promise.all([
			em.execute<{ total: string | number }[]>(countSql, baseParams, "all"),
			em.execute<
				{
					user_id: string;
					elo: number;
					peak_rating: number;
					games_played: number;
					rank: string | number;
				}[]
			>(paginatedSql, [...baseParams, limit, offset], "all"),
		]);

		const total = Number(countRows[0]?.total ?? 0);

		const entries: LeaderboardEntry[] = rows.map((row) => ({
			userId: row.user_id,
			elo: Number(row.elo),
			peakRating: Number(row.peak_rating),
			gamesPlayed: Number(row.games_played),
			rank: Number(row.rank),
		}));

		return { entries, total };
	}

	async getUserRank(
		seasonId: string | null,
		userId: string,
		mode: MatchMode
	): Promise<LeaderboardEntry | null> {
		const em = this.db.em.fork();

		// MikroORM v7 : SQL brut via em.execute()
		const seasonClause = seasonId !== null ? "ue.season_id = ?" : "ue.season_id IS NULL";
		const baseParams: unknown[] = seasonId !== null ? [seasonId, mode] : [mode];

		const rankedSql = `
			SELECT
				ue.user_id,
				ue.elo,
				ue.peak_rating,
				ue.games_played,
				DENSE_RANK() OVER (ORDER BY ue.elo DESC) AS rank
			FROM user_elo AS ue
			WHERE ${seasonClause}
			  AND ue.mode = ?
		`;

		const rows = await em.execute<
			{
				user_id: string;
				elo: number;
				peak_rating: number;
				games_played: number;
				rank: string | number;
			}[]
		>(`SELECT * FROM (${rankedSql}) AS ranked WHERE user_id = ?`, [...baseParams, userId], "all");

		const row = rows[0];
		if (!row) return null;

		return {
			userId: row.user_id,
			elo: Number(row.elo),
			peakRating: Number(row.peak_rating),
			gamesPlayed: Number(row.games_played),
			rank: Number(row.rank),
		};
	}
}
