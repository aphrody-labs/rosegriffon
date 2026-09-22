import type { Guild } from "discord.js";
import { Client } from "@aphrody/discordx";

import { Service } from "@/decorators";
import { Clan, ClanMember, Rank, User, UserView } from "@/entities";
import {
	freshDiscordAvatarUrl,
	hasActiveClanMembership,
	normalizeNames,
	resolveDiscordAvatarUrl,
	syncUser,
} from "@/utils/functions";

import type { EnrichedUserDTO } from "../api/models/dtos/enrichedUserDTO";
import { MatchMode, Provider, UserRole } from "../utils/enums";
import type { LobbyUserStruct } from "../utils/types/lobbyStruct";
import { Database } from "./Database";
import type { SuggestionRank } from "./Suggestions";

function emptyCompetitionStats() {
	return {
		total: 0,
		wins: 0,
		losses: 0,
		draws: 0,
		goalsScoredAvg: 0,
		goalsReceivedAvg: 0,
		personalTotal: 0,
		personalDraws: 0,
		personalLosses: 0,
		personalWins: 0,
	};
}

@Service()
export class UserService {
	constructor(
		private db: Database
	) {}

	private get client(): Client {
		const client = (globalThis as typeof globalThis & { __roseGriffonDiscordClient?: Client }).__roseGriffonDiscordClient;
		if (!client) throw new Error("Discord client is not initialized");
		return client;
	}

	async getUserDTO(userId: string): Promise<UserDTO> {
		const userView = await this.db.em.findOne(UserView, { id: userId });

		// fallback if no UserView yet
		if (!userView) {
			return {
				id: userId,
				type: "user",
				username: "Utilisateur inconnu",
				sim: 0,
				soloRank: { elo: 0, key: "Non classé", gradient: [] } as SuggestionRank,
				duoRank: { elo: 0, key: "Non classé", gradient: [] } as SuggestionRank,
			} as UserDTO;
		}

		// Avatar stocké (sync Discord) — normalisé (gif animé, fallback embed).
		// Pas de fetch Discord live ici (évite N+1 sur les listes tournoi).
		const user = await this.db.em.findOne(User, { id: userId });
		const avatar = resolveDiscordAvatarUrl(userId, user?.avatar);

		return await this.toDTO(userView, avatar, 0);
	}

	async isBlacklisted(userId: string): Promise<boolean> {
		const count = await this.db.em.count(User, {
			id: userId,
			blacklist: { $ne: null },
		});

		return count > 0;
	}

	async isClanMember(userId: string) {
		// Une adhésion à un Clan inactif ne bloque pas (transfert/prêt implicite).
		return hasActiveClanMembership(userId, this.db.em);
	}

	async getLobbyPlayerInfo(userId: string, mode: MatchMode) {
		const user = await this.db.em.findOne(User, userId, {
			populate: ["connections", "elos"],
		});

		if (!user) {
			throw new Error(`User not found: ${userId}`);
		}

		const eloEntry = user.elos.getItems().find((e) => e.mode === mode);
		const elo = eloEntry ? eloEntry.elo : 0;

		const twitchConn = user.connections
			.getItems()
			.find((conn) => conn.provider === Provider.TWITCH);
		const twitchId = twitchConn?.externalId;
		const twitchLogin = twitchConn?.externalUsername;

		return { userId, elo, twitchId, twitchLogin } as LobbyUserStruct;
	}

	/**
	 * Fetch the Discord username and, if they have a ClanMember record,
	 * lookup its Clan and append `<:shortName:emojiId>` to the name.
	 */
	async getDisplayNameWithClan(userId: string, isFirst: boolean, guild: Guild): Promise<string> {
		// 1) fetch the Discord user (for their username)
		const user = await guild.members.fetch(userId);

		// 2) check clan membership
		const cm = await this.db.em.findOne(
			ClanMember,
			{ user: { id: userId } },
			{ populate: ["clan"] }
		);
		let name = "";

		// 3) if they’re in a clan, append its emoji
		if (isFirst) {
			if (cm?.clan) {
				const { normalizedShortName, clanEmojiId } = cm.clan as Clan;
				name += `<:${normalizedShortName}:${clanEmojiId}>`;
			} else {
				name += `<:Achillea:1391477048488497212>`; // Default emoji if not in a clan
			}

			name += ` ${user.displayName}`;
		} else {
			name += `${user.displayName} `;
			if (cm?.clan) {
				const { normalizedShortName, clanEmojiId } = cm.clan as Clan;
				name += `<:${normalizedShortName}:${clanEmojiId}>`;
			} else {
				name += `<:Achillea:1391477048488497212>`; // Default emoji if not in a clan
			}
		}

		return name;
	}

	async getDiscordUser(userId: string) {
		// 1️⃣ Try cache first (fast, no API call)
		const cached = this.client.users.cache.get(userId);
		if (cached) return cached;

		// 2️⃣ Fallback to Discord API
		try {
			return await this.client.users.fetch(userId);
		} catch {
			return null;
		}
	}

	async getUserAsGuildMember(guild: Guild, userId: string) {
		return await guild.members.fetch(userId);
	}

	async getUserData(userId: string) {
		return await this.db.em.findOne(UserView, { id: userId }, { refresh: true });
	}

	async syncWebUser(userId: string) {
		const dUser = await this.getDiscordUser(userId);
		if (dUser) {
			await syncUser(dUser);
			await this.db.em.getRepository(User).updateLastInteract(dUser);
		}
		// Discord injoignable (ou utilisateur de test) → on retombe sur la donnée stockée.
		// La protection contre les jetons forgés reste la vérification centralisée du JWT
		// (signature, audience et usage) ; en complément, getUserData renvoie null
		// pour un id sans ligne user_view → un jeton signé pointant un user inexistant est aussi rejeté.
		return await this.getUserData(userId);
	}

	/**
	 * Rafraîchit `user.avatar` depuis Discord pour **tous** les comptes.
	 * Les URLs CDN Discord deviennent 404 dès qu'un joueur change d'avatar.
	 * Batché (10 / lot, 1.2 s) pour le rate-limit Discord.
	 */
	async resyncAvatars(): Promise<{ scanned: number; updated: number; failed: number }> {
		const em = this.db.em.fork();
		const all = await em.find(User, {}, { fields: ["id"] });
		const targetIds = all.map((u) => u.id);
		let updated = 0;
		let failed = 0;
		const CHUNK = 10;
		for (let i = 0; i < targetIds.length; i += CHUNK) {
			const batch = targetIds.slice(i, i + CHUNK);
			const rows = await em.find(User, { id: { $in: batch } });
			await Promise.all(
				rows.map(async (u) => {
					try {
						const d = await this.getDiscordUser(u.id);
						if (!d) {
							// Discord introuvable → normalise l'URL stockée / fallback embed
							const normalized = resolveDiscordAvatarUrl(u.id, u.avatar);
							if (u.avatar !== normalized) {
								u.avatar = normalized;
								updated++;
							}
							return;
						}
						const url = freshDiscordAvatarUrl(d);
						// username/displayName sont NOT NULL en base : jamais d'écrasement
						// par une valeur Discord vide (payload partiel/inconnu de discord.js).
						const safeUsername = d.username || u.username;
						const safeDisplayName = d.displayName || safeUsername || u.displayName;
						if (
							u.avatar !== url ||
							u.username !== safeUsername ||
							u.displayName !== safeDisplayName
						) {
							u.avatar = url;
							u.username = safeUsername;
							u.displayName = safeDisplayName;
							u.normalizedDisplayName = normalizeNames(safeDisplayName);
							updated++;
						}
					} catch {
						failed++;
					}
				})
			);
			await em.flush();
			if (i + CHUNK < targetIds.length) await new Promise((r) => setTimeout(r, 1200));
		}
		return { scanned: targetIds.length, updated, failed };
	}

	/**
	 * Crée un utilisateur de test ANONYME (id factice en forme de snowflake) pour tester le
	 * ranked sans login Discord réel. La ligne `user` suffit : `user_view` se dérive seule et
	 * le ranked crée l'`user_elo` à la volée (getOrCreateElo). Réservé au flux /auth/test-login
	 * (gardé par un secret), jamais déclenché par un vrai login.
	 */
	async createTestUser(): Promise<{ id: string; username: string; avatar: string }> {
		const em = this.db.em.fork();
		const id = `99${Date.now()}${Math.floor(Math.random() * 900 + 100)}`; // 18-19 chiffres, préfixe 99
		const tag = id.slice(-4);
		const displayName = `Testeur ${tag}`;
		const avatar = `https://cdn.discordapp.com/embed/avatars/${Number(id.slice(-1)) % 6}.png`;
		const user = em.create(
			User,
			{
				id,
				username: `tester_${tag}`,
				displayName,
				normalizedDisplayName: normalizeNames(displayName),
				avatar,
				role: UserRole.User,
				lastInteract: new Date(),
			},
			{ partial: true }
		);
		await em.persist(user).flush();
		return { id, username: user.username, avatar };
	}

	async toDTO(userView: UserView, avatar: string, sim: number): Promise<UserDTO> {
		const soloRank = await this.db.em.findOne(Rank, { key: userView.solo_key });
		const duoRank = await this.db.em.findOne(Rank, { key: userView.solo_key });

		return {
			id: userView.id,
			type: "user",
			username: userView.displayName,
			clanId: userView.clanId,
			sim,
			avatar,
			soloRank: {
				elo: userView.solo_elo ?? 0,
				key: userView.solo_key || "Non classé",
				gradient: soloRank?.gradient ?? [],
			},
			duoRank: {
				elo: userView.duo_elo ?? 0,
				key: userView.duo_key || "Non classé",
				gradient: duoRank?.gradient ?? [],
			},
			lastInteract: userView.lastInteract,
			role: userView.role,
			currentLevel: userView.currentLevel,
			totalXp: userView.totalXp,
			hasTwitch: userView.hasTwitch,
			hasChallonge: userView.hasChallonge,
			hasYoutube: userView.hasYoutube,
		};
	}

	async getEnrichedUserDTO(userId: string): Promise<EnrichedUserDTO | null> {
		const userData = await this.getUserData(userId);
		if (!userData) return null;
		const discordUser = await this.getDiscordUser(userId);
		if (!discordUser) return null;
		// Profil enrichi : avatar frais Discord si dispo, sinon stock normalisé.
		let avatar = resolveDiscordAvatarUrl(userId, undefined);
		if (discordUser) {
			avatar = freshDiscordAvatarUrl(discordUser);
			// Persiste le refresh pour les listes (qui lisent la colonne stockée)
			try {
				const u = await this.db.em.findOne(User, { id: userId });
				if (u && u.avatar !== avatar) {
					u.avatar = avatar;
					u.username = discordUser.username;
					u.displayName = discordUser.displayName;
					u.normalizedDisplayName = normalizeNames(discordUser.displayName);
					await this.db.em.flush();
				}
			} catch {
				/* non bloquant */
			}
		} else {
			const stored = await this.db.em.findOne(User, { id: userId });
			avatar = resolveDiscordAvatarUrl(userId, stored?.avatar);
		}
		const userDTO = await this.toDTO(userData, avatar, 0);
		// bio/twitchUrl : éditables par le titulaire (PUT /users/me/profile), pas dans UserView.
		const profileFields = await this.db.em.findOne(
			User,
			{ id: userId },
			{ fields: ["bio", "twitchUrl"] }
		);

		const dto: EnrichedUserDTO = {
			id: userDTO.id,
			clanId: userDTO.clanId,
			type: userDTO.type,
			username: userDTO.username,
			sim: userDTO.sim,
			avatar: userDTO.avatar,
			soloRank: userDTO.soloRank,
			duoRank: userDTO.duoRank,
			bio: profileFields?.bio ?? null,
			twitchUrl: profileFields?.twitchUrl ?? null,
			lastInteract: userDTO.lastInteract,
			role: userDTO.role,
			currentLevel: userDTO.currentLevel,
			totalXp: userDTO.totalXp,
			hasTwitch: userDTO.hasTwitch,
			hasChallonge: userDTO.hasChallonge,
			hasYoutube: userDTO.hasYoutube,

			interclans: emptyCompetitionStats(),
			tournaments: emptyCompetitionStats(),
			ranked: {
				solo: {
					mode: MatchMode.ONE_VS_ONE,
					total: 0,
					wins: 0,
					losses: 0,
					draws: 0,
					goalsScored: 0,
					goalsReceived: 0,
				},
				duo: {
					mode: MatchMode.TWO_VS_TWO,
					total: 0,
					wins: 0,
					losses: 0,
					draws: 0,
					goalsScored: 0,
					goalsReceived: 0,
				},
			},
		};

		// 🏰 Clan info
		if (userDTO.clanId) {
			const clanMember = await this.db.em.findOne(
				ClanMember,
				{ user: userDTO.id },
				{ populate: ["clan"] }
			);
			if (clanMember) {
				dto.clan = {
					id: clanMember.clan.id,
					shortenedName: clanMember.clan.shortenedName,
					name: clanMember.clan.name,
					avatarUrl: clanMember.clan.clanAvatarUrl,
					role: clanMember.role,
					distinctions: clanMember.distinctions,
				};
			} else {
				userDTO.clanId = undefined;
			}
		}

		const interclanStats = await this.getInterclanStatsForUser(userDTO.id);
		if (interclanStats) dto.interclans = interclanStats;

		const tournamentStats = await this.getTournamentStatsForUser(userDTO.id);
		if (tournamentStats) dto.tournaments = tournamentStats;

		const rankedStats = await this.getRankedStatsForUser(userDTO.id);
		if (rankedStats?.length) {
			const solo = rankedStats.find((r) => r.mode === MatchMode.ONE_VS_ONE) ?? {
				mode: MatchMode.ONE_VS_ONE,
				total: 0,
				wins: 0,
				losses: 0,
				draws: 0,
				goalsScored: 0,
				goalsReceived: 0,
			};
			const duo = rankedStats.find((r) => r.mode === MatchMode.TWO_VS_TWO) ?? {
				mode: MatchMode.TWO_VS_TWO,
				total: 0,
				wins: 0,
				losses: 0,
				draws: 0,
				goalsScored: 0,
				goalsReceived: 0,
			};
			dto.ranked = { solo, duo };
		}

		return dto;
	}

	/** Stats de matchs de tournoi (brackets / swiss) pour le profil. */
	async getTournamentStatsForUser(userId: string) {
		const sql = `
			WITH participations AS (
				SELECT COUNT(DISTINCT l.event_id) AS total
				FROM lobby_user lu
				JOIN lobby l ON l.id = lu.lobby_id
				WHERE lu.user_id = ?
				  AND l.event_type = 'TOURNAMENT'
				  AND l.state IN ('Finished', 'Forfeited')
			),
			personal_stats AS (
				SELECT
					COUNT(*) AS personal_total,
					COUNT(CASE
						WHEN lu.forfeit THEN NULL
						WHEN opp.forfeit THEN 1
						WHEN lu.score > opp.score THEN 1
					END) AS personal_wins,
					COUNT(CASE
						WHEN lu.forfeit THEN 1
						WHEN opp.forfeit THEN NULL
						WHEN lu.score < opp.score THEN 1
					END) AS personal_losses,
					COUNT(CASE
						WHEN NOT lu.forfeit AND NOT opp.forfeit AND lu.score = opp.score THEN 1
					END) AS personal_draws
				FROM lobby_user lu
				JOIN lobby l ON l.id = lu.lobby_id
				JOIN lobby_user opp ON opp.lobby_id = l.id AND opp.team <> lu.team
				WHERE l.event_type = 'TOURNAMENT'
				  AND l.state IN ('Finished', 'Forfeited')
				  AND lu.user_id = ?
			),
			goal_avgs AS (
				SELECT
					COALESCE(AVG(lu.score), 0) AS goal_scored_avg,
					COALESCE(AVG(opp.score), 0) AS goal_received_avg
				FROM lobby_user lu
				JOIN lobby l ON l.id = lu.lobby_id
				JOIN lobby_user opp ON opp.lobby_id = l.id AND opp.team <> lu.team
				WHERE l.event_type = 'TOURNAMENT'
				  AND l.state IN ('Finished', 'Forfeited')
				  AND lu.user_id = ?
				  AND NOT lu.forfeit
				  AND NOT opp.forfeit
			)
			SELECT
				p.total,
				ps.personal_total,
				ps.personal_wins,
				ps.personal_losses,
				ps.personal_draws,
				g.goal_scored_avg,
				g.goal_received_avg
			FROM participations p, personal_stats ps, goal_avgs g;
		`;

		const [result] = await this.db.em.getConnection().execute(sql, [userId, userId, userId]);

		const personalWins = Number(result?.personal_wins ?? 0);
		const personalLosses = Number(result?.personal_losses ?? 0);

		return {
			total: Number(result?.total ?? 0),
			// Pour les tournois, « contrib » = bilan perso (pas de notion de clan)
			wins: personalWins,
			losses: personalLosses,
			draws: Number(result?.personal_draws ?? 0),
			personalTotal: Number(result?.personal_total ?? 0),
			personalWins,
			personalLosses,
			personalDraws: Number(result?.personal_draws ?? 0),
			goalsScoredAvg: Number(result?.goal_scored_avg ?? 0),
			goalsReceivedAvg: Number(result?.goal_received_avg ?? 0),
		};
	}

	async getInterclanStatsForUser(userId: string) {
		const sql = `
			WITH interclan_stats AS (
				SELECT
					COUNT(DISTINCT e.id) AS total,
					COUNT(DISTINCT CASE WHEN e.winner_clan_id::bigint = il.clan_id::bigint THEN e.id END) AS wins,
					COUNT(DISTINCT CASE WHEN e.winner_clan_id IS NOT NULL AND e.winner_clan_id::bigint <> il.clan_id::bigint THEN e.id END) AS losses,
					COUNT(DISTINCT CASE WHEN e.winner_clan_id IS NULL THEN e.id END) AS draws
				FROM interclan_lineup_member ilm
						 JOIN interclan_lineup il ON il.id = ilm.lineup_id
						 JOIN event e ON e.id = il.event_id
				WHERE ilm.user_id = ?
				  AND e."type" = 'INTERCLAN'
				  AND e.state = 7
			),
				 personal_stats AS (
					 SELECT
						 COUNT(*) AS personal_total,
						 COUNT(CASE WHEN lu.score > opp.score THEN 1 END) AS personal_wins,
						 COUNT(CASE WHEN lu.score < opp.score THEN 1 END) AS personal_losses,
						 COUNT(CASE WHEN lu.score = opp.score THEN 1 END) AS personal_draws
					 FROM lobby_user lu
							  JOIN lobby l ON l.id = lu.lobby_id
							  JOIN lobby_user opp ON opp.lobby_id = l.id AND opp.team <> lu.team
							  JOIN event e ON e.id = l.event_id
					 WHERE l.event_type = 'INTERCLAN'
					   AND lu.user_id = ?
					   AND e.state = 7
				 ),
				 goal_avgs AS (
					 SELECT
						 COALESCE(AVG(lu.score), 0) AS goal_scored_avg,
						 COALESCE(AVG(opp.score), 0) AS goal_received_avg
					 FROM lobby_user lu
							  JOIN lobby l ON l.id = lu.lobby_id
							  JOIN lobby_user opp ON opp.lobby_id = l.id AND opp.team <> lu.team
							  JOIN event e ON e.id = l.event_id
					 WHERE l.event_type = 'INTERCLAN'
					   AND lu.user_id = ?
					   AND e.state = 7
				 )
			SELECT
				i.total,
				i.wins,
				i.losses,
				i.draws,
				p.personal_total,
				p.personal_wins,
				p.personal_losses,
				p.personal_draws,
				g.goal_scored_avg,
				g.goal_received_avg
			FROM interclan_stats i, personal_stats p, goal_avgs g;
		`;

		const [result] = await this.db.em.getConnection().execute(sql, [
			userId, // first placeholder → ilm.user_id
			userId, // second placeholder → lu.user_id (personal_stats)
			userId, // third placeholder → lu.user_id (goal_avgs)
		]);

		return {
			total: Number(result.total ?? 0),
			wins: Number(result.wins ?? 0),
			losses: Number(result.losses ?? 0),
			draws: Number(result.draws ?? 0),
			personalTotal: Number(result.personal_total ?? 0),
			personalWins: Number(result.personal_wins ?? 0),
			personalLosses: Number(result.personal_losses ?? 0),
			personalDraws: Number(result.personal_draws ?? 0),
			goalsScoredAvg: Number(result.goal_scored_avg ?? 0),
			goalsReceivedAvg: Number(result.goal_received_avg ?? 0),
		};
	}

	/**
	 * Stats ranked affichées sur le profil.
	 * Inclut les matchs file Colyseus (RANKED) ET les matchs de tournoi
	 * dont l'Elo a été appliqué (`ranked_elo_applied`).
	 */
	async getRankedStatsForUser(userId: string) {
		const rows = await this.db.em.getConnection().execute(
			`
			WITH user_matches AS (
				SELECT
					l.id AS lobby_id,
					l.mode,
					lu.score AS my_score,
					opp.score AS opp_score,
					lu.forfeit AS my_forfeit,
					opp.forfeit AS opp_forfeit
				FROM lobby l
				JOIN lobby_user lu ON lu.lobby_id = l.id AND lu.user_id = ?
				JOIN lobby_user opp ON opp.lobby_id = l.id AND opp.team <> lu.team
				WHERE l.state IN ('Finished', 'Forfeited')
				  AND (
					l.event_type = 'RANKED'
					OR (l.event_type = 'TOURNAMENT' AND l.ranked_elo_applied = true)
				  )
			),
			ranked_stats AS (
				SELECT
					mode,
					COUNT(DISTINCT lobby_id) AS total,
					COUNT(DISTINCT CASE
						WHEN my_forfeit THEN NULL
						WHEN opp_forfeit THEN lobby_id
						WHEN my_score > opp_score THEN lobby_id
					END) AS wins,
					COUNT(DISTINCT CASE
						WHEN my_forfeit THEN lobby_id
						WHEN opp_forfeit THEN NULL
						WHEN my_score < opp_score THEN lobby_id
					END) AS losses,
					COUNT(DISTINCT CASE
						WHEN NOT my_forfeit AND NOT opp_forfeit AND my_score = opp_score THEN lobby_id
					END) AS draws
				FROM user_matches
				GROUP BY mode
			),
			goal_totals AS (
				SELECT
					mode,
					SUM(my_score)::bigint AS goals_scored,
					SUM(opp_score)::bigint AS goals_received
				FROM (
					SELECT DISTINCT lobby_id, mode, my_score, opp_score
					FROM user_matches
					WHERE NOT my_forfeit AND NOT opp_forfeit
				) AS um
				GROUP BY mode
			)
			SELECT
				COALESCE(rs.mode, gt.mode) AS mode,
				COALESCE(rs.total, 0) AS total,
				COALESCE(rs.wins, 0) AS wins,
				COALESCE(rs.losses, 0) AS losses,
				COALESCE(rs.draws, 0) AS draws,
				COALESCE(gt.goals_scored, 0) AS goals_scored,
				COALESCE(gt.goals_received, 0) AS goals_received
			FROM ranked_stats rs
			FULL JOIN goal_totals gt ON gt.mode = rs.mode;
		`,
			[userId]
		);

		return rows.map((r) => ({
			mode: r.mode,
			total: Number(r.total ?? 0),
			wins: Number(r.wins ?? 0),
			losses: Number(r.losses ?? 0),
			draws: Number(r.draws ?? 0),
			goalsScored: Number(r.goals_scored ?? 0),
			goalsReceived: Number(r.goals_received ?? 0),
		}));
	}

}

// Source unique : @rosegriffon/achillea-types (contrat partagé bot ↔ web).
// (RankDTO du package ≡ SuggestionRank ; UserRole = enum partagé.)
import type { UserDTO } from "@rosegriffon/achillea-types";

export type { UserDTO };
