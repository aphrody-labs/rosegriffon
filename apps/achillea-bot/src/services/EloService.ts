import {
	applyEloUpdate,
	DEFAULT_BASE_RATING,
	DEFAULT_K_FACTOR,
	placementPrizeAp,
	progressiveEloDelta,
	computeMatchElo,
} from "@achillea/core";
import { LockMode } from "@mikro-orm/core";
import { singleton } from "tsyringe";

import { Lobby, Rank, Season, Tournament, User, UserElo } from "@/entities";
import {
	EventTypeEnum,
	LobbyState,
	LobbyUserState,
	MatchMode,
	SeasonState,
	TeamSide,
} from "@/utils/enums";

import { Database } from "./Database";
import { MetricsService } from "./MetricsService";
import { resolveTournamentSideOutcome } from "./tournamentRules";

export interface EloCalculationResult {
	newWinner: number;
	newLoser: number;
	delta: number;
}

export interface MatchResultOpts {
	matchId: string;
	winnerId: string;
	loserId: string;
	mode: MatchMode;
}

export interface TournamentEloApplyResult {
	applied: boolean;
	reason?: string;
	deltas?: Record<string, number>;
}

/** Placement final d'un participant (rank 1-based brackets-manager). */
export interface TournamentPlacement {
	userId: string;
	rank: number;
}

export interface TournamentPlacementPrizeResult {
	applied: boolean;
	reason?: string;
	/** userId → AP plats versés (0 omis). */
	deltas?: Record<string, number>;
	tournamentSize?: number;
}

@singleton()
export class EloService {
	constructor(
		private db: Database,
		private metrics: MetricsService
	) {}

	calculate(
		winnerRating: number,
		loserRating: number,
		kFactor: number = DEFAULT_K_FACTOR
	): EloCalculationResult {
		// Logique pure déléguée à @achillea/core (identique au calcul historique).
		return computeMatchElo(winnerRating, loserRating, kFactor);
	}

	async applyMatchResult(
		opts: MatchResultOpts
	): Promise<{ winnerElo: UserElo; loserElo: UserElo; delta: number }> {
		const em = this.db.em.fork();

		const activeSeason = await this.getCurrentSeason(em);
		const seasonRef = activeSeason ?? null;

		const kFactor = activeSeason?.config?.kFactor ?? DEFAULT_K_FACTOR;
		const baseRating = activeSeason?.config?.baseRating ?? DEFAULT_BASE_RATING;

		const findOrCreate = async (userId: string): Promise<UserElo> => {
			const existing = await em.findOne(UserElo, {
				user: { id: userId } as User,
				mode: opts.mode,
			});

			if (existing) return existing;

			const userRef = em.getReference(User, userId);
			const elo = em.create(UserElo, {
				user: userRef,
				mode: opts.mode,
				season: seasonRef,
				elo: baseRating,
				peakRating: baseRating,
				gamesPlayed: 0,
				wins: 0,
				losses: 0,
				createdAt: new Date(),
				updatedAt: new Date(),
			});
			em.persist(elo);
			return elo;
		};

		const winnerElo = await findOrCreate(opts.winnerId);
		const loserElo = await findOrCreate(opts.loserId);

		const { newWinner, newLoser, delta } = this.calculate(winnerElo.elo, loserElo.elo, kFactor);

		winnerElo.elo = newWinner;
		winnerElo.gamesPlayed += 1;
		winnerElo.wins += 1;
		if (newWinner > winnerElo.peakRating) winnerElo.peakRating = newWinner;

		loserElo.elo = newLoser;
		loserElo.gamesPlayed += 1;
		loserElo.losses += 1;

		await em.flush();

		this.metrics.increment("achillea_elo_matches_total", { mode: String(opts.mode) });

		return { winnerElo, loserElo, delta };
	}

	/**
	 * Applique l'Elo ranked (barème AP progressif) à un lobby de tournoi terminé.
	 * Idempotent via `lobby.rankedEloApplied`.
	 *
	 * 1 joueur / côté : Elo 1v1 classique.
	 * Plusieurs joueurs / côté : chaque joueur gagne/perd face à l'Elo moyen adverse.
	 */
	async applyTournamentLobbyResult(
		lobbyId: number,
		em?: DatabaseEntityManager
	): Promise<TournamentEloApplyResult> {
		const entityManager = em ?? this.db.em.fork();

		return await entityManager.transactional(async (tem) => {
			const lobby = await tem.findOne(
				Lobby,
				{ id: lobbyId },
				{
					populate: ["lobbyUsers", "lobbyUsers.user"],
					lockMode: LockMode.PESSIMISTIC_WRITE,
				}
			);

			if (!lobby) return { applied: false, reason: "lobby_introuvable" };
			if (lobby.eventType !== EventTypeEnum.TOURNAMENT)
				return { applied: false, reason: "pas_un_tournoi" };
			if (lobby.rankedEloApplied) return { applied: false, reason: "deja_applique" };
			if (lobby.state !== LobbyState.FINISHED && lobby.state !== LobbyState.FORFEITED)
				return { applied: false, reason: "lobby_non_termine" };

			const users = lobby.lobbyUsers.getItems();
			const team1 = users.filter((u) => u.team === TeamSide.TEAM_1);
			const team2 = users.filter((u) => u.team === TeamSide.TEAM_2);
			if (team1.length === 0 || team2.length === 0)
				return { applied: false, reason: "equipes_incompletes" };

			const outcome = resolveTournamentSideOutcome(team1, team2, lobby.state);
			if (!outcome) return { applied: false, reason: "issue_indeterminee" };

			const activeSeason = await this.getCurrentSeason(tem);
			const kFactor = activeSeason?.config?.kFactor ?? DEFAULT_K_FACTOR;
			const baseRating = activeSeason?.config?.baseRating ?? DEFAULT_BASE_RATING;
			const mode = lobby.mode || MatchMode.ONE_VS_ONE;

			const ranks = await tem.find(Rank, {}, { orderBy: { minElo: "ASC" } });
			const tierIndex = (elo: number): number => {
				for (let i = 0; i < ranks.length; i++) {
					if (elo >= ranks[i].minElo && elo <= ranks[i].maxElo) return i;
				}
				return elo > 0 && ranks.length > 0 ? ranks.length - 1 : 0;
			};

			const findOrCreate = async (userId: string): Promise<UserElo> => {
				const existing = await tem.findOne(UserElo, {
					user: { id: userId } as User,
					mode,
				});
				if (existing) return existing;
				const row = tem.create(UserElo, {
					user: tem.getReference(User, userId),
					mode,
					season: activeSeason,
					elo: baseRating,
					peakRating: baseRating,
					gamesPlayed: 0,
					wins: 0,
					losses: 0,
					createdAt: new Date(),
					updatedAt: new Date(),
				});
				tem.persist(row);
				return row;
			};

			const avgElo = async (side: typeof team1): Promise<number> => {
				let sum = 0;
				for (const lu of side) {
					const row = await findOrCreate(lu.user.id);
					sum += row.elo;
				}
				return side.length ? sum / side.length : baseRating;
			};

			const oppAvgForT1 = await avgElo(team2);
			const oppAvgForT2 = await avgElo(team1);

			const deltas: Record<string, number> = {};

			const applySide = async (
				side: typeof team1,
				oppAvg: number,
				actual: number,
				isWin: boolean,
				isLoss: boolean
			) => {
				for (const lu of side) {
					const row = await findOrCreate(lu.user.id);
					const d = progressiveEloDelta(row.elo, oppAvg, actual, tierIndex(row.elo), kFactor);
					const { newElo, clampedDelta } = applyEloUpdate(row.elo, d);
					row.elo = newElo;
					row.gamesPlayed += 1;
					if (isWin) row.wins += 1;
					if (isLoss) row.losses += 1;
					if (newElo > row.peakRating) row.peakRating = newElo;
					lu.eloVariation = clampedDelta;
					lu.state = LobbyUserState.FINISHED;
					lu.validatedResult = true;
					deltas[lu.user.id] = clampedDelta;
				}
			};

			if (outcome.winner === TeamSide.TEAM_1) {
				await applySide(team1, oppAvgForT1, 1, true, false);
				await applySide(team2, oppAvgForT2, 0, false, true);
			} else if (outcome.winner === TeamSide.TEAM_2) {
				await applySide(team1, oppAvgForT1, 0, false, true);
				await applySide(team2, oppAvgForT2, 1, true, false);
			} else {
				// Nul (rare en tournoi) : actual 0.5, pas de W/L
				await applySide(team1, oppAvgForT1, 0.5, false, false);
				await applySide(team2, oppAvgForT2, 0.5, false, false);
			}

			lobby.rankedEloApplied = true;
			await tem.flush();

			this.metrics.increment("achillea_elo_matches_total", { mode: String(mode) });

			return { applied: true, deltas };
		});
	}

	/**
	 * Verse le bonus AP podium (1er / 2e / demis) à la fin d'un tournoi.
	 * Idempotent via `tournament.placementEloApplied`.
	 *
	 * - AP **plats** (hors barème match) : ne compte ni W/L ni games_played.
	 * - Mode par défaut : solo (`ONE_VS_ONE`) — ladder principale.
	 * - `tournamentSize` = `participantsNumber` (capacité annoncée, ex. 32).
	 */
	async applyTournamentPlacementPrizes(
		tournamentId: number,
		placements: readonly TournamentPlacement[],
		opts?: { mode?: MatchMode; em?: DatabaseEntityManager }
	): Promise<TournamentPlacementPrizeResult> {
		const entityManager = opts?.em ?? this.db.em.fork();
		const mode = opts?.mode ?? MatchMode.ONE_VS_ONE;

		return await entityManager.transactional(async (tem) => {
			const tournament = await tem.findOne(
				Tournament,
				{ id: tournamentId },
				{ lockMode: LockMode.PESSIMISTIC_WRITE }
			);

			if (!tournament) return { applied: false, reason: "tournoi_introuvable" };
			if (tournament.placementEloApplied) return { applied: false, reason: "deja_applique" };

			const size = tournament.participantsNumber ?? 0;
			if (size <= 0) return { applied: false, reason: "taille_invalide" };
			if (!placements.length) return { applied: false, reason: "aucun_placement" };

			const activeSeason = await this.getCurrentSeason(tem);
			const baseRating = activeSeason?.config?.baseRating ?? DEFAULT_BASE_RATING;

			const findOrCreate = async (userId: string): Promise<UserElo> => {
				const existing = await tem.findOne(UserElo, {
					user: { id: userId } as User,
					mode,
				});
				if (existing) return existing;
				const row = tem.create(UserElo, {
					user: tem.getReference(User, userId),
					mode,
					season: activeSeason,
					elo: baseRating,
					peakRating: baseRating,
					gamesPlayed: 0,
					wins: 0,
					losses: 0,
					createdAt: new Date(),
					updatedAt: new Date(),
				});
				tem.persist(row);
				return row;
			};

			const deltas: Record<string, number> = {};
			// Un même user ne reçoit qu'une fois le bonus (rank le plus favorable).
			const bestRankByUser = new Map<string, number>();
			for (const p of placements) {
				if (!p.userId || !Number.isFinite(p.rank) || p.rank < 1) continue;
				const prev = bestRankByUser.get(p.userId);
				if (prev === undefined || p.rank < prev) bestRankByUser.set(p.userId, p.rank);
			}

			for (const [userId, rank] of bestRankByUser) {
				const prize = placementPrizeAp(size, rank);
				if (prize <= 0) continue;
				const row = await findOrCreate(userId);
				const { newElo, clampedDelta } = applyEloUpdate(row.elo, prize);
				row.elo = newElo;
				if (newElo > row.peakRating) row.peakRating = newElo;
				deltas[userId] = clampedDelta;
			}

			tournament.placementEloApplied = true;
			await tem.flush();

			if (Object.keys(deltas).length > 0) {
				this.metrics.increment("achillea_elo_placement_prizes_total", {
					size: String(size),
				});
			}

			return { applied: true, deltas, tournamentSize: size };
		});
	}

	async getCurrentSeason(em?: DatabaseEntityManager): Promise<Season | null> {
		const entityManager = em ?? this.db.em.fork();
		return entityManager.findOne(
			Season,
			{ state: SeasonState.Active },
			{ orderBy: { startsAt: "DESC" } }
		);
	}

	async getActiveSeasons(): Promise<Season[]> {
		const em = this.db.em.fork();
		return em.find(Season, { state: SeasonState.Active }, { orderBy: { startsAt: "ASC" } });
	}
}
