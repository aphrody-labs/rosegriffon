// noinspection SqlNoDataSourceInspection

import { raw, sql } from "@mikro-orm/core";

import { Service } from "@/decorators";
import { Clan, ClanMember } from "@/entities";

import type { UserRole } from "../utils/enums";
import { Database } from "./Database";

// NEED USERS AVATAR !!!
export type Suggestion = {
	id: string;
	type: "clan" | "user";
	label: string;
	sim: number;
	clanShortName?: string;
	avatar?: string;
	soloRank: SuggestionRank;
	duoRank: SuggestionRank;
	lastInteract?: Date;
	role?: UserRole;
	currentLevel?: number;
	totalXp?: number;
	hasTwitch?: boolean;
	hasChallonge?: boolean;
	hasYoutube?: boolean;
};

export type SuggestionRank = {
	elo: number;
	key: string;
	gradient: string[];
};

@Service()
export class Suggestions {
	constructor(private db: Database) {}

	async searchAll(query: string): Promise<Suggestion[]> {
		if (!query) return [];
		const term = query.toLowerCase();

		// Execute both
		const clans = await this.searchClans(term);

		const processedUsers = await this.searchPlayers(term);

		return [...clans.map((c) => ({ ...c, type: "clan" }) as Suggestion), ...processedUsers]
			.toSorted((a, b) => b.sim - a.sim)
			.slice(0, 5);
	}

	async searchClans(query: string) {
		if (!query) return [];
		const term = query.toLowerCase();

		// MikroORM v7 : la surcharge tableau de .select() n'accepte pas un mélange
		// string + RawQueryFragment — on sépare en .select([...strings]) + .addSelect(raw).
		const clanQb = this.db.em
			.createQueryBuilder(Clan, "c")
			.select(["c.id", "c.name as label", "c.clan_avatar_url as avatar"])
			.addSelect(
				sql`GREATEST(
          similarity(${raw("c.name")}, ${term}),
          similarity(${raw("c.shortened_name")}, ${term}),
          similarity(${raw("c.normalized_short_name")}, ${term})
        )`.as("sim")
			)
			.where("c.name % ? OR c.shortened_name % ? OR c.normalized_short_name % ?", [
				term,
				term,
				term,
			])
			.orderBy({ sim: "DESC" })
			.limit(5);

		return await clanQb.execute<Suggestion[]>();
	}

	async searchPlayers(query: string) {
		if (!query) return [];
		const term = query.toLowerCase();

		// Colonnes de user_view : camelCase pour flags (hasTwitch…), snake pour elo.
		// (has_twitch faisait crasher la requête → 500 sur /misc/suggest/users).
		const sql = `
		  SELECT
			id,
			username,
			"displayName",
			"normalizedDisplayName",
			"lastInteract",
			role,
			"currentLevel",
			"totalXp",
			solo_elo,
			solo_key,
			duo_elo,
			duo_key,
			"hasTwitch" AS has_twitch,
			"hasChallonge" AS has_challonge,
			"hasYoutube" AS has_youtube,
			GREATEST(
			  similarity(username, ?),
			  similarity("displayName", ?),
			  similarity("normalizedDisplayName", ?)
			) AS sim
		  FROM user_view
		  WHERE
			  (username % ? OR "displayName" % ? OR "normalizedDisplayName" % ?)
			  AND NOT COALESCE("isBlacklisted", false)
		  ORDER BY sim DESC
		  LIMIT 8;
		`;

		let usersRaw: any[];
		try {
			usersRaw = await this.db.em
				.getConnection()
				.execute(sql, [term, term, term, term, term, term]);
		} catch (err) {
			console.error("[suggestions] searchPlayers SQL failed:", (err as Error)?.message ?? err);
			// Fallback sans pg_trgm (ILIKE) si l'extension / index pose problème
			const fallback = `
			  SELECT id, username, "displayName", "normalizedDisplayName", "lastInteract",
			    role, "currentLevel", "totalXp", solo_elo, solo_key, duo_elo, duo_key,
			    "hasTwitch" AS has_twitch, "hasChallonge" AS has_challonge, "hasYoutube" AS has_youtube,
			    1.0 AS sim
			  FROM user_view
			  WHERE (
			    username ILIKE ? OR "displayName" ILIKE ? OR "normalizedDisplayName" ILIKE ?
			  ) AND NOT COALESCE("isBlacklisted", false)
			  ORDER BY "displayName" ASC
			  LIMIT 8;
			`;
			const like = `%${term}%`;
			usersRaw = await this.db.em.getConnection().execute(fallback, [like, like, like]);
		}

		const userIds = usersRaw.map((u) => u.id);
		const clanMembers =
			userIds.length === 0
				? []
				: await this.db.em.find(ClanMember, { user: { $in: userIds } }, { populate: ["clan"] });
		const clanByUserId = new Map(clanMembers.map((m) => [m.user.id, m]));

		return usersRaw.map((u) => {
			const member = clanByUserId.get(u.id);

			return {
				id: String(u.id),
				type: "user" as const,
				label: u.displayName ?? u.username,
				avatar: undefined,
				lastInteract: u.lastInteract,
				role: u.role,
				currentLevel: u.currentLevel,
				totalXp: u.totalXp,
				soloRank: {
					elo: Number(u.solo_elo ?? 0),
					key: u.solo_key ?? "Fer",
					gradient: [],
				},
				duoRank: {
					elo: Number(u.duo_elo ?? 0),
					key: u.duo_key ?? "Fer",
					gradient: [],
				},
				hasTwitch: !!u.has_twitch,
				hasChallonge: !!u.has_challonge,
				hasYoutube: !!u.has_youtube,
				sim: Number(u.sim ?? 0),
				clanShortName: member?.clan?.shortenedName,
			} as Suggestion;
		});
	}
}
