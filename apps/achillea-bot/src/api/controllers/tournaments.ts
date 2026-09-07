import { wrap } from "@mikro-orm/core";
import {
	BodyParams,
	Context,
	Controller,
	Get,
	PathParams,
	Post,
	Put,
	QueryParams,
	Res,
	UseBefore,
} from "@tsed/common";
import { Unauthorized } from "@tsed/exceptions";
import { deserialize } from "@tsed/json-mapper";
import { Default, Groups, Maximum, Minimum } from "@tsed/schema";
import type { Response } from "express";

import { CookieAuthorize, OptionalAuthMiddleware } from "@/api/middlewares";
import type { NewTournamentDTO } from "@/api/models/dtos";
import { LobbyDTO } from "@/api/models/dtos";
import type { Paginated } from "@/api/models/interfaces";
import { paginate } from "@/api/models/interfaces";
import { Tournament } from "@/entities";
import type { UserDTO } from "@/services";
import {
	BracketService,
	TournamentEventService,
	TournamentsService,
	UserService,
} from "@/services";
import { BaseController } from "@/utils/classes";
import { ScoreReportPolicy, TournamentState, UserRole } from "@/utils/enums";
import { resolveDependenciesSync } from "@/utils/functions";

import { BlacklistedAuthorize } from "../middlewares/blacklistedAuthorize";
import type { GameScoreDTO, GameValidatorDTO } from "../models/dtos/gameScoreDTO";
import type { ParticipantDTO } from "../models/dtos/participantDTO";

@Controller("/tournaments")
export class TournamentsController extends BaseController {
	private userService: UserService;
	private tournamentsService: TournamentsService;
	private bracketService: BracketService;
	private tournamentEvents: TournamentEventService;

	constructor() {
		super();

		[this.userService, this.tournamentsService, this.bracketService, this.tournamentEvents] =
			resolveDependenciesSync([
				UserService,
				TournamentsService,
				BracketService,
				TournamentEventService,
			]);
	}

	@Get("/")
	@UseBefore(OptionalAuthMiddleware)
	async getTournaments(
		@Res() res: Response,
		@QueryParams("page")
		@Default(1)
		@Minimum(1)
		page: number,

		@QueryParams("pagination")
		@Default(25)
		@Minimum(1)
		@Maximum(50)
		pagination: number,

		@QueryParams("organization")
		organizationId: number | undefined,

		@QueryParams("states")
		@Default(undefined)
		states: TournamentState[],

		@Context("user") user?: UserDTO | undefined
	): Promise<any> {
		if (
			organizationId &&
			(states?.includes(TournamentState.PENDING) || states?.includes(TournamentState.CANCELED))
		) {
			if (!user) throw new Unauthorized("Vous n'êtes pas autorisé à effectuer cette action.");
			// SuperAdmin : vue ops dashboard (tous états y compris Pending)
			if ((user.role ?? 0) < UserRole.SuperAdministrator) {
				await this.tournamentsService.isOrganizationManager(user.id, organizationId);
			}
		}

		try {
			const [items, total] = await this.tournamentsService.getTournaments(
				page,
				pagination,
				organizationId,
				states
			);

			// Liste publique de tournois : peu changeante (registrations bougent surtout
			// pendant les fenetres ouvertes). 30s + SWR 60s.
			res.setHeader("Cache-Control", "public, s-maxage=30, stale-while-revalidate=60");

			const pojoItems = items.map((item) => wrap(item).toPOJO());
			const safePojoItems = JSON.parse(JSON.stringify(pojoItems));

			return res.json(paginate(safePojoItems, total, pagination, page));
		} catch (error) {
			console.error("ERROR IN getTournaments:", error);
			throw error;
		}
	}

	/**
	 * Classement circuit : cumul de points sur tous les tournois élimination
	 * terminés (voir `TournamentsService.getCircuitRanking`). Public, aucune auth
	 * requise — mêmes données que la page "Tournois" liste déjà publiquement.
	 */
	@Get("/circuit/ranking")
	async getCircuitRanking(@Res() res: Response) {
		const ranking = await this.tournamentsService.getCircuitRanking();

		// Ne change qu'à la fin d'un tournoi (rare) : cache généreux + SWR.
		res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");

		return res.json(ranking);
	}

	/**
	 * Hub statistiques circuit — vue d'ensemble, records all-time, joueurs/clans
	 * enrichis (buts, séries), historique complet des éditions. Public.
	 */
	@Get("/circuit/stats")
	async getStatsHub(@Res() res: Response) {
		const hub = await this.tournamentsService.getStatsHub();

		res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");

		return res.json(hub);
	}

	/**
	 * Profil circuit d'un joueur (cumul all-time + historique tournoi par tournoi) —
	 * page profil public `/users/:id`. Public, aucune auth requise.
	 */
	@Get("/circuit/players/:userId")
	async getPlayerCircuitProfile(@PathParams("userId") userId: string, @Res() res: Response) {
		const profile = await this.tournamentsService.getPlayerCircuitProfile(userId);

		res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");

		return res.json(profile);
	}

	/**
	 * Top 10 + stats matchs d'un tournoi (page publique). Fonctionne aussi en cours
	 * de tournoi (stats sur les matchs déjà joués, top10 vide tant que non résolvable).
	 */
	@Get("/:id/summary")
	async getTournamentSummary(@PathParams("id") id: number, @Res() res: Response) {
		const summary = await this.tournamentsService.getTournamentSummary(id);

		res.setHeader("Cache-Control", "public, s-maxage=30, stale-while-revalidate=120");

		return res.json(summary);
	}

	@Get("/:id")
	@UseBefore(OptionalAuthMiddleware)
	async getTournament(
		@PathParams("id") id: number,
		@Res() res: Response,
		@Context("user") user?: UserDTO | undefined
	) {
		const [tournament, participantsDTO, tournamentData] =
			await this.tournamentsService.getSingleTournament(id);

		if (
			tournament.internalState === TournamentState.PENDING ||
			tournament.internalState === TournamentState.CANCELED
		) {
			// Public : pas de détail tant que non publié. Staff SuperAdmin / org managers OK.
			// Un tournoi annulé reste consultable par son organisation (item « annuler
			// sans supprimer » : les données doivent rester atteignables).
			if (!user) throw new Unauthorized("Vous n'êtes pas autorisé à effectuer cette action.");
			if ((user.role ?? 0) < UserRole.SuperAdministrator) {
				await this.tournamentsService.isTournamentOrganizationManager(user.id, id);
			}
		}

		// Motifs de disqualification : réservés aux organisateurs. Le calcul se fait ici
		// (et pas dans le service) pour que la donnée ne dépende que de l'appelant.
		const isOrganizer = user
			? await this.tournamentsService
					.isTournamentOrganizer(user.id, id)
					.then(() => true)
					.catch(() => false)
			: false;

		const safeParticipants = isOrganizer
			? participantsDTO
			: participantsDTO.map((p) => ({ ...p, statusReason: null }));

		// Single tournament page : structure stable, registrations bougent.
		// La réponse d'un organisateur porte les motifs de DQ : elle ne doit jamais
		// atterrir dans un cache partagé où un anonyme la récupérerait.
		res.setHeader(
			"Cache-Control",
			isOrganizer ? "private, no-store" : "public, s-maxage=20, stale-while-revalidate=60"
		);

		const safeTournament = JSON.parse(JSON.stringify(wrap(tournament).toPOJO()));

		return res.json([safeTournament, safeParticipants, tournamentData]);
	}

	@Post("/create/achillea")
	@UseBefore(CookieAuthorize, BlacklistedAuthorize)
	async create(
		@BodyParams() dto: NewTournamentDTO, // <--- La validation et la conversion se font ici
		@Context("user") user: UserDTO
	) {
		const isSuperAdmin = (user.role ?? 0) >= UserRole.SuperAdministrator;

		// Une organisation ouvre ses propres tournois : c'est sa raison d'être. Le
		// propriétaire et les managers de l'organisation ciblée peuvent créer, personne
		// d'autre — `isOrganizationManager` lève un 401 sinon.
		if (!isSuperAdmin) {
			const organizationId =
				typeof dto.organization === "number"
					? dto.organization
					: Number((dto.organization as { id?: number })?.id);

			if (!organizationId || Number.isNaN(organizationId))
				throw new Unauthorized("Organisation cible manquante.");

			await this.tournamentsService.isOrganizationManager(user.id, organizationId);
			await this.tournamentsService.assertOrganizationCanHostTournaments(organizationId);
		}

		// Le créateur est toujours TO (sinon SuperAdmin crée le tournoi mais ne peut
		// pas ouvrir les inscriptions : isTournamentOrganizer ne regarde que owner/managers).
		if (!dto.managers?.some((m) => m.id === user.id)) {
			dto.managers = [...(dto.managers ?? []), user];
		}

		// La dérogation aux règles de publication est un acte volontaire — et réservée
		// aux SuperAdmin : une organisation qui pourrait la cocher elle-même viderait
		// les règles de leur sens.
		return this.tournamentsService.createTournament(dto, {
			actorId: user.id,
			bypassRules: isSuperAdmin && dto.bypassRules === true,
		});
	}

	/**
	 * Mise à jour complète d'un tournoi (champs + images logo/affiche).
	 * Auth : TO / org manager / SuperAdmin.
	 * Path dédié (évite collision avec PUT /start/:id).
	 */
	@Put("/:id/edit")
	@UseBefore(CookieAuthorize, BlacklistedAuthorize)
	async update(
		@PathParams("id") id: number,
		@BodyParams() dto: NewTournamentDTO,
		@Context("user") user: UserDTO,
		@Res() res: Response
	) {
		await this.tournamentsService.isTournamentOrganizer(user.id, id);
		const updated = await this.tournamentsService.updateTournament(id, dto);
		const safe = JSON.parse(JSON.stringify(wrap(updated).toPOJO()));
		return res.status(200).json(safe);
	}

	@Post("/open-registrations/:id")
	@UseBefore(CookieAuthorize, BlacklistedAuthorize)
	async openRegistrations(@PathParams("id") id: number, @Context("user") user: UserDTO) {
		await this.tournamentsService.isTournamentOrganizer(user.id, id);
		await this.tournamentsService.openRegistrations(id, user.id);
		// Réponse stable pour le front (évite de parser void / 204)
		return { success: true, id, internalState: TournamentState.PREREGISTERING };
	}

	@Post("/participate/:id")
	@UseBefore(CookieAuthorize, BlacklistedAuthorize)
	async participate(@PathParams("id") id: number, @Context("user") user: UserDTO) {
		return await this.tournamentsService.register(id, user.id);
	}

	@Post("/unregister/:id")
	@UseBefore(CookieAuthorize, BlacklistedAuthorize)
	async unregister(@PathParams("id") id: number, @Context("user") user: UserDTO) {
		return await this.tournamentsService.unregister(id, user.id);
	}

	/**
	 * Bascule « qui saisit les scores » (staff seul / joueurs).
	 * Endpoint dédié : l'organisateur la change en cours de tournoi, sans repasser
	 * par la mise à jour complète du tournoi.
	 */
	@Post("/:id/score-policy")
	@UseBefore(CookieAuthorize, BlacklistedAuthorize)
	async setScorePolicy(
		@PathParams("id") id: number,
		@BodyParams("policy") policy: string,
		@Context("user") user: UserDTO,
		@Res() res: Response
	) {
		await this.tournamentsService.isTournamentOrganizer(user.id, id);

		const parsed =
			policy === ScoreReportPolicy.STAFF_ONLY
				? ScoreReportPolicy.STAFF_ONLY
				: policy === ScoreReportPolicy.PLAYERS
					? ScoreReportPolicy.PLAYERS
					: null;

		if (!parsed)
			return res.status(400).json({ success: false, error: "Politique de scores inconnue." });

		const tournament = await this.tournamentsService.setScoreReportPolicy(id, parsed, user.id);

		return res.status(200).json({ success: true, scoreReportPolicy: tournament.scoreReportPolicy });
	}

	@Post("/report-score")
	@UseBefore(CookieAuthorize, BlacklistedAuthorize)
	async reportGameScore(
		@BodyParams("score") gameScoreDTO: GameScoreDTO,
		@Context("user") user: UserDTO
	) {
		return await this.tournamentsService.reportGameScore(
			gameScoreDTO.lobbyId,
			gameScoreDTO.gameNumber,
			gameScoreDTO.score1,
			gameScoreDTO.score2,
			user.id
		);
	}

	@Post("/validate-score")
	@UseBefore(CookieAuthorize, BlacklistedAuthorize)
	async validateScore(
		@BodyParams("gameValidation") gameValidatorDTO: GameValidatorDTO,
		@Context("user") user: UserDTO
	) {
		const side = await this.tournamentsService.getUserSide(user.id, gameValidatorDTO.lobbyId);

		return await this.tournamentsService.validateGame(gameValidatorDTO.lobbyMatchId, side);
	}

	@Post("/unvalidate-score")
	@UseBefore(CookieAuthorize, BlacklistedAuthorize)
	async unvalidateScore(
		@BodyParams("gameValidation") gameValidatorDTO: GameValidatorDTO,
		@Context("user") user: UserDTO
	) {
		const side = await this.tournamentsService.getUserSide(user.id, gameValidatorDTO.lobbyId);

		return await this.tournamentsService.unvalidateGame(gameValidatorDTO.lobbyMatchId, side);
	}

	@Post("/remove-participant/:id")
	@UseBefore(CookieAuthorize, BlacklistedAuthorize)
	async removeParticipant(
		@BodyParams("userId") userId: string,
		@BodyParams("reason") reason: string | undefined,
		@PathParams("id") id: number,
		@Context("user") user: UserDTO
	) {
		await this.tournamentsService.isTournamentOrganizer(user.id, id);

		return await this.tournamentsService.removeUser(id, userId, user.id, reason);
	}

	/**
	 * Disqualification d'un participant (motif obligatoire).
	 * Tournoi en cours : ses matchs non terminés passent en forfait et le bracket avance.
	 */
	@Post("/:id/disqualify")
	@UseBefore(CookieAuthorize, BlacklistedAuthorize)
	async disqualifyParticipant(
		@PathParams("id") id: number,
		@BodyParams("userId") userId: string,
		@BodyParams("reason") reason: string,
		@Context("user") user: UserDTO,
		@Res() res: Response
	) {
		await this.tournamentsService.isTournamentOrganizer(user.id, id);

		try {
			const result = await this.tournamentsService.disqualifyParticipant(
				id,
				userId,
				reason,
				user.id
			);
			return res.status(200).json({ success: true, ...result });
		} catch (error: any) {
			return res.status(error.status || 400).json({
				success: false,
				error: error.message || "Impossible de disqualifier ce participant.",
			});
		}
	}

	/** Annule une disqualification (avant le démarrage du tournoi uniquement). */
	@Post("/:id/reinstate")
	@UseBefore(CookieAuthorize, BlacklistedAuthorize)
	async reinstateParticipant(
		@PathParams("id") id: number,
		@BodyParams("userId") userId: string,
		@Context("user") user: UserDTO,
		@Res() res: Response
	) {
		await this.tournamentsService.isTournamentOrganizer(user.id, id);

		try {
			const participant = await this.tournamentsService.reinstateParticipant(id, userId, user.id);
			return res.status(200).json({ success: true, participant });
		} catch (error: any) {
			return res.status(error.status || 400).json({
				success: false,
				error: error.message || "Impossible de réintégrer ce participant.",
			});
		}
	}

	/** Promotion manuelle d'un joueur depuis la liste d'attente. */
	@Post("/:id/promote-participant")
	@UseBefore(CookieAuthorize, BlacklistedAuthorize)
	async promoteParticipant(
		@PathParams("id") id: number,
		@BodyParams("userId") userId: string,
		@Context("user") user: UserDTO,
		@Res() res: Response
	) {
		await this.tournamentsService.isTournamentOrganizer(user.id, id);

		try {
			const participant = await this.tournamentsService.promoteFromWaitlist(id, userId, user.id);
			return res.status(200).json({ success: true, participant });
		} catch (error: any) {
			return res.status(error.status || 400).json({
				success: false,
				error: error.message || "Impossible de promouvoir ce participant.",
			});
		}
	}

	/**
	 * Clôture manuelle d'un tournoi en cours. `force` passe outre les matchs non
	 * terminés (le forçage est journalisé).
	 */
	@Post("/:id/close")
	@UseBefore(CookieAuthorize, BlacklistedAuthorize)
	async closeTournament(
		@PathParams("id") id: number,
		@BodyParams("force") force: boolean | undefined,
		@Context("user") user: UserDTO,
		@Res() res: Response
	) {
		await this.tournamentsService.isTournamentOrganizer(user.id, id);

		try {
			const result = await this.tournamentsService.closeTournament(id, user.id, force === true);
			return res.status(200).json(result);
		} catch (error: any) {
			return res.status(error.status || 400).json({
				success: false,
				error: error.message || "Impossible de clôturer ce tournoi.",
			});
		}
	}

	/** Annulation d'un tournoi — l'état passe à `Canceled`, rien n'est supprimé. */
	@Post("/:id/cancel")
	@UseBefore(CookieAuthorize, BlacklistedAuthorize)
	async cancelTournament(
		@PathParams("id") id: number,
		@BodyParams("reason") reason: string,
		@Context("user") user: UserDTO,
		@Res() res: Response
	) {
		await this.tournamentsService.isTournamentOrganizer(user.id, id);

		try {
			const result = await this.tournamentsService.cancelTournament(id, reason, user.id);
			return res.status(200).json(result);
		} catch (error: any) {
			return res.status(error.status || 400).json({
				success: false,
				error: error.message || "Impossible d'annuler ce tournoi.",
			});
		}
	}

	/** Restauration d'un tournoi annulé dans son état précédent. */
	@Post("/:id/restore")
	@UseBefore(CookieAuthorize, BlacklistedAuthorize)
	async restoreTournament(
		@PathParams("id") id: number,
		@Context("user") user: UserDTO,
		@Res() res: Response
	) {
		await this.tournamentsService.isTournamentOrganizer(user.id, id);

		try {
			const result = await this.tournamentsService.restoreTournament(id, user.id);
			return res.status(200).json(result);
		} catch (error: any) {
			return res.status(error.status || 400).json({
				success: false,
				error: error.message || "Impossible de restaurer ce tournoi.",
			});
		}
	}

	/**
	 * Journal du tournoi (inscriptions, retraits, DQ, scores, changements d'état).
	 * Public ; les motifs (DQ, annulation) ne sont renvoyés qu'aux organisateurs.
	 */
	@Get("/:id/events")
	@UseBefore(OptionalAuthMiddleware)
	async getTournamentEvents(
		@PathParams("id") id: number,
		@Res() res: Response,
		@Context("user") user?: UserDTO | undefined
	) {
		let isOrganizer = false;
		if (user) {
			isOrganizer = await this.tournamentsService
				.isTournamentOrganizer(user.id, id)
				.then(() => true)
				.catch(() => false);
		}

		const events = await this.tournamentEvents.list(id, isOrganizer);

		// Journal append-only : un court cache suffit à absorber les rafraîchissements
		// de page sans masquer une action qui vient d'être faite.
		res.setHeader("Cache-Control", "public, s-maxage=10, stale-while-revalidate=30");

		return res.json(events);
	}

	@Post("/set-participant-seeding/:id")
	@UseBefore(CookieAuthorize, BlacklistedAuthorize)
	async setParticipantSeeding(
		@BodyParams("participant") participantDTO: ParticipantDTO,
		@PathParams("id") id: number,
		@Context("user") user: UserDTO
	) {
		await this.tournamentsService.isTournamentOrganizer(user.id, id);

		return await this.tournamentsService.setParticipantSeeding(id, participantDTO);
	}

	/**
	 * Verse manuellement le bonus AP podium (1er / 2e / demis) d'un tournoi terminé.
	 * Idempotent. Formats élimination uniquement.
	 */
	@Post("/:id/apply-placement-prizes")
	@UseBefore(CookieAuthorize, BlacklistedAuthorize)
	async applyPlacementPrizes(
		@PathParams("id") id: number,
		@Context("user") user: UserDTO,
		@Res() res: Response
	) {
		await this.tournamentsService.isTournamentOrganizer(user.id, id);

		try {
			const result = await this.bracketService.applyPlacementPrizesForTournament(id, {
				requireFinished: true,
			});
			return res.status(200).json({ success: result.applied, ...result });
		} catch (error: any) {
			console.error("Erreur apply-placement-prizes:", error);
			return res.status(error.status || 400).json({
				success: false,
				error: error.message || "Impossible d'appliquer le bonus podium",
			});
		}
	}

	/** Seed 1..N selon le classement ranked solo (ELO décroissant). Écrase le seeding actuel. */
	@Post("/seed-by-ranked/:id")
	@UseBefore(CookieAuthorize, BlacklistedAuthorize)
	async seedByRanked(@PathParams("id") id: number, @Context("user") user: UserDTO) {
		await this.tournamentsService.isTournamentOrganizer(user.id, id);

		return await this.tournamentsService.seedByRanked(id);
	}

	/** Mélange aléatoire des seeds 1..N. */
	@Post("/seed-random/:id")
	@UseBefore(CookieAuthorize, BlacklistedAuthorize)
	async seedRandom(@PathParams("id") id: number, @Context("user") user: UserDTO) {
		await this.tournamentsService.isTournamentOrganizer(user.id, id);

		return await this.tournamentsService.seedRandom(id);
	}

	/** Retire toutes les seeds. */
	@Post("/clear-seeds/:id")
	@UseBefore(CookieAuthorize, BlacklistedAuthorize)
	async clearSeeds(@PathParams("id") id: number, @Context("user") user: UserDTO) {
		await this.tournamentsService.isTournamentOrganizer(user.id, id);

		return await this.tournamentsService.clearSeeds(id);
	}

	@Post("/generate-bracket/:id")
	@UseBefore(CookieAuthorize, BlacklistedAuthorize)
	async generateBracket(
		@PathParams("id") id: number,
		@Context("user") user: UserDTO,
		@Res() res: Response
	) {
		try {
			await this.tournamentsService.isTournamentOrganizer(user.id, id);

			await this.tournamentsService.generateBracket(id);

			return res.status(200).json({ success: true });
		} catch (error: any) {
			console.error("Erreur lors de la génération du bracket Challonge :", error);

			return res.status(error.status || 400).json({
				success: false,
				error: error.message || "Impossible de générer le bracket Challonge",
			});
		}
	}

	@Post("/add-managers/:id")
	@UseBefore(CookieAuthorize, BlacklistedAuthorize)
	async addManagers(
		@PathParams("id") id: number,
		@BodyParams() newManagers: UserDTO[],
		@Context("user") user: UserDTO,
		@Res() res: Response
	) {
		try {
			await this.tournamentsService.isTournamentOrganizationManager(user.id, id);

			await this.tournamentsService.addManagers(id, newManagers, user.id);

			return res.status(200).json({ success: true });
		} catch (error: any) {
			console.error("Erreur lors de la génération du bracket Challonge :", error);

			return res.status(error.status || 400).json({
				success: false,
				error: error.message || "Impossible de générer le bracket Challonge",
			});
		}
	}

	@Post("/remove-manager/:id")
	@UseBefore(CookieAuthorize, BlacklistedAuthorize)
	async removeManager(
		@PathParams("id") id: number,
		@BodyParams() toRemove: UserDTO,
		@Context("user") user: UserDTO,
		@Res() res: Response
	) {
		try {
			await this.tournamentsService.isTournamentOrganizationManager(user.id, id);

			await this.tournamentsService.removeManager(id, toRemove.id, user.id);

			return res.status(200).json({ success: true });
		} catch (error: any) {
			console.error("Erreur lors de la génération du bracket Challonge :", error);

			return res.status(error.status || 400).json({
				success: false,
				error: error.message || "Impossible de générer le bracket Challonge",
			});
		}
	}

	@Put("/start/:id")
	@UseBefore(CookieAuthorize, BlacklistedAuthorize)
	async startTournament(
		@PathParams("id") id: number,
		@Context("user") user: UserDTO,
		@Res() res: Response
	) {
		try {
			await this.tournamentsService.isTournamentOrganizer(user.id, id);

			await this.tournamentsService.startTournament(id);

			return res.status(200).json({ success: true });
		} catch (error: any) {
			console.error("Erreur lors du démarrage du tournoi :", error);

			return res.status(error.status || 400).json({
				success: false,
				error: error.message || "Impossible de démarrer le tournoi",
			});
		}
	}

	@Put("/next-phase/:id")
	@UseBefore(CookieAuthorize, BlacklistedAuthorize)
	async nextPhase(
		@PathParams("id") id: number,
		@Context("user") user: UserDTO,
		@Res() res: Response
	) {
		try {
			await this.tournamentsService.isTournamentOrganizer(user.id, id);

			// await this.tournamentsService.syncLobbiesFromChallonge(id)

			return res.status(200).json({ success: true });
		} catch (error: any) {
			console.error("Erreur lors du démarrage du tournoi :", error);

			return res.status(error.status || 400).json({
				success: false,
				error: error.message || "Impossible de démarrer le tournoi",
			});
		}
	}

	@Get("/lobbies/:id")
	async getLobbies(@PathParams("id") id: number) {
		return await this.tournamentsService.getTournamentLobbies(id);
	}

	@Get("/lobby/:id")
	@Groups("details")
	async getLobby(@PathParams("id") id: number) {
		const lobby = await this.tournamentsService.getTournamentLobby(id);

		const plainLobby = wrap(lobby).toPOJO();

		return deserialize(plainLobby, { type: LobbyDTO, groups: ["details"] });
	}
}
