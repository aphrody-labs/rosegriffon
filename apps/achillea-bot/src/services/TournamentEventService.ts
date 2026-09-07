import type { EntityManager } from "@mikro-orm/core";
import { rel } from "@mikro-orm/core";

import { Service } from "@/decorators";
// Import des modules CONCRETS et non du baril `@/entities` : le baril est pris dans
// un cycle (services -> utils/functions -> services), et au moment où il est évalué à
// mi-parcours l'export `TournamentEvent` n'existe pas encore → « SyntaxError: Export
// named 'TournamentEvent' not found ». Le chemin direct casse le cycle.
import { Tournament } from "@/entities/Tournament";
import { TournamentEvent } from "@/entities/TournamentEvent";
import { User } from "@/entities/User";
import type { TournamentEventType } from "@/utils/enums";

import { Database } from "./Database";

export interface TournamentEventInput {
	tournamentId: number;
	type: TournamentEventType;
	/** Auteur de l'action ; omis quand elle est automatique (cron, propagation bracket). */
	actorId?: string | null;
	/** Joueur visé (inscription, DQ, promotion…). */
	targetId?: string | null;
	payload?: Record<string, unknown> | null;
	reason?: string | null;
	/** EntityManager d'une transaction en cours — sinon un fork dédié est utilisé. */
	em?: EntityManager;
}

/**
 * Écriture du journal métier d'un tournoi (`tournament_event`).
 *
 * Règle unique et non négociable : **journaliser ne doit jamais faire échouer l'action
 * journalisée**. Une inscription réussie suivie d'une écriture de journal en erreur
 * doit rester une inscription réussie — l'inverse produirait des désinscriptions
 * fantômes au premier hoquet réseau. Toutes les erreurs sont donc avalées et tracées
 * en console.
 */
@Service()
export class TournamentEventService {
	constructor(private db: Database) {}

	async log(input: TournamentEventInput): Promise<void> {
		try {
			// Fork par défaut : si l'appelant est dans une transaction qui échoue plus tard,
			// le journal ne doit pas disparaître avec elle — sauf s'il passe son `em`,
			// auquel cas il veut explicitement le comportement transactionnel.
			const em = input.em ?? this.db.em.fork();

			const event = new TournamentEvent();
			event.tournament = rel(Tournament, input.tournamentId);
			event.type = input.type;
			event.actor = input.actorId ? rel(User, input.actorId) : null;
			event.target = input.targetId ? rel(User, input.targetId) : null;
			event.payload = input.payload ?? null;
			event.reason = input.reason ?? null;

			em.persist(event);

			// En transaction fournie, le flush appartient à l'appelant.
			if (!input.em) await em.flush();
		} catch (error) {
			console.warn(
				`[TournamentEventService] journalisation ignorée (${input.type}) :`,
				(error as Error)?.message
			);
		}
	}

	/**
	 * Journal d'un tournoi, du plus récent au plus ancien.
	 * `reason` n'est renvoyé qu'aux organisateurs (motifs de DQ).
	 */
	async list(tournamentId: number, includeReasons: boolean, limit = 200) {
		const events = await this.db.em
			.fork()
			.getRepository(TournamentEvent)
			.findForTournament(tournamentId, limit);

		return events.map((e) => ({
			id: e.id,
			type: e.type,
			createdAt: e.createdAt,
			actor: e.actor
				? {
						id: e.actor.id,
						username: e.actor.username,
						displayName: e.actor.displayName,
						avatar: e.actor.avatar,
					}
				: null,
			target: e.target
				? {
						id: e.target.id,
						username: e.target.username,
						displayName: e.target.displayName,
						avatar: e.target.avatar,
					}
				: null,
			payload: e.payload ?? null,
			reason: includeReasons ? (e.reason ?? null) : null,
		}));
	}
}
