import type { Kysely } from "kysely";
import { Service } from "@/decorators";
import { createAchilleaSql } from "@rosegriffon/db/achillea-sql";
import { EventTypeEnum, TournamentEventType, TournamentState } from "@/utils/enums";
import { resolveDependency } from "@/utils/functions";

import { TournamentEventService } from "./TournamentEventService";
import { TournamentsService } from "./TournamentsService";

interface TournamentScheduleDatabase {
	event: {
		id: number;
		event_type: string;
		internal_state: string;
		registration_opens_at: Date | null;
		registration_closes_at: Date | null;
		starts_at: Date | null;
		auto_start: boolean;
	};
}

const sql = createAchilleaSql<TournamentScheduleDatabase>() as Kysely<TournamentScheduleDatabase>;

export interface ScheduleTransition {
	tournamentId: number;
	from: TournamentState;
	to: TournamentState;
}

/**
 * Transitions d'état pilotées par le planning (item « Automatiser les transitions de
 * phases du tournoi par rapport au Planning »).
 *
 * Trois bascules, chacune conditionnée à une date **explicitement renseignée** par
 * l'organisateur : sans date, rien ne bouge — un tournoi créé avant cette
 * fonctionnalité continue de se conduire à la main.
 *
 *   Pending        → Preregistering  à `registrationOpensAt`
 *   Preregistering → Preparing       à `registrationClosesAt` (+ génération du bracket)
 *   Preparing      → Ongoing         à `startsAt`, si `autoStart`
 *
 * Chaque tick est indépendant et idempotent : un tournoi dont la date est passée
 * depuis trois jours bascule au prochain tick sans traitement de rattrapage, et un
 * tournoi déjà basculé n'est plus candidat (le filtre porte sur l'état courant).
 */
@Service()
export class TournamentScheduleService {
	/**
	 * `TournamentsService` n'est **pas** injecté au constructeur : le chargement de
	 * `services/index.ts` passe par `@/utils/functions`, qui réimporte l'index — un
	 * paramètre typé `TournamentsService` serait évalué (métadonnées du décorateur)
	 * alors que la classe est encore dans sa zone morte temporelle, et le service
	 * exploserait au démarrage avec « Cannot access 'TournamentsService' before
	 * initialization ». Il est donc résolu à l'exécution, comme dans le cron.
	 */
	constructor(
		private events: TournamentEventService
	) {}

	private tournamentsService(): Promise<TournamentsService> {
		return resolveDependency(TournamentsService);
	}

	async runDueTransitions(now: Date = new Date()): Promise<ScheduleTransition[]> {
		const applied: ScheduleTransition[] = [];

		applied.push(...(await this.openDueRegistrations(now)));
		applied.push(...(await this.closeDueRegistrations(now)));
		applied.push(...(await this.startDueTournaments(now)));

		return applied;
	}

	private async openDueRegistrations(now: Date): Promise<ScheduleTransition[]> {
		const due = await sql
			.selectFrom("event")
			.select("id")
			.where("event_type", "=", EventTypeEnum.TOURNAMENT)
			.where("internal_state", "=", TournamentState.PENDING)
			.where("registration_opens_at", "is not", null)
			.where("registration_opens_at", "<=", now)
			.execute();

		const applied: ScheduleTransition[] = [];

		for (const tournament of due) {
			try {
				await (await this.tournamentsService()).openRegistrations(tournament.id);
				applied.push({
					tournamentId: tournament.id,
					from: TournamentState.PENDING,
					to: TournamentState.PREREGISTERING,
				});
			} catch (error) {
				console.warn(
					`[TournamentSchedule] ouverture automatique impossible (tournoi ${tournament.id}) :`,
					(error as Error)?.message
				);
			}
		}

		return applied;
	}

	private async closeDueRegistrations(now: Date): Promise<ScheduleTransition[]> {
		const due = await sql
			.selectFrom("event")
			.select("id")
			.where("event_type", "=", EventTypeEnum.TOURNAMENT)
			.where("internal_state", "=", TournamentState.PREREGISTERING)
			.where("registration_closes_at", "is not", null)
			.where("registration_closes_at", "<=", now)
			.execute();

		const applied: ScheduleTransition[] = [];

		for (const tournament of due) {
			try {
				// `generateBracket` fait déjà passer en Preparing et construit le bracket
				// à partir des seuls inscrits actifs : la fermeture d'inscriptions et la
				// préparation sont donc la même opération, pas deux étapes à synchroniser.
				await (await this.tournamentsService()).generateBracket(tournament.id);

				await this.events.log({
					tournamentId: tournament.id,
					type: TournamentEventType.REGISTRATIONS_CLOSED,
					payload: { automatic: true },
				});

				applied.push({
					tournamentId: tournament.id,
					from: TournamentState.PREREGISTERING,
					to: TournamentState.PREPARING,
				});
			} catch (error) {
				console.warn(
					`[TournamentSchedule] fermeture automatique impossible (tournoi ${tournament.id}) :`,
					(error as Error)?.message
				);
			}
		}

		return applied;
	}

	private async startDueTournaments(now: Date): Promise<ScheduleTransition[]> {
		const due = await sql
			.selectFrom("event")
			.select("id")
			.where("event_type", "=", EventTypeEnum.TOURNAMENT)
			.where("internal_state", "=", TournamentState.PREPARING)
			.where("auto_start", "=", true)
			.where("starts_at", "<=", now)
			.execute();

		const applied: ScheduleTransition[] = [];

		for (const tournament of due) {
			try {
				await (await this.tournamentsService()).startTournament(tournament.id);
				applied.push({
					tournamentId: tournament.id,
					from: TournamentState.PREPARING,
					to: TournamentState.ONGOING,
				});
			} catch (error) {
				// Cas normal et fréquent : aucun inscrit, bracket incomplet. On retente
				// au tick suivant plutôt que de désactiver le démarrage automatique.
				console.warn(
					`[TournamentSchedule] démarrage automatique impossible (tournoi ${tournament.id}) :`,
					(error as Error)?.message
				);
			}
		}

		return applied;
	}
}
