import { singleton } from "tsyringe";

import { Lobby, Tournament, TournamentPhase } from "@/entities";
import { LobbyState, PhaseStatus, TournamentState } from "@/utils/enums";

import { Database } from "./Database";
import { SwissStageService } from "./SwissStageService";

@singleton()
export class PhaseTransitionService {
	constructor(
		private db: Database,
		private swissStageService: SwissStageService
	) {}

	async progressTournament(tournament: Tournament): Promise<void> {
		const em = this.db.em.fork();

		const phases = await em.find(
			TournamentPhase,
			{ tournament: tournament.id },
			{ orderBy: { index: "ASC" } }
		);

		if (phases.length === 0) return;

		const activePhase = phases.find((p) => p.status === PhaseStatus.Active);
		if (!activePhase) return;

		const lobbies = await em.find(Lobby, { phase: activePhase.id });

		const allDone =
			lobbies.length > 0 &&
			lobbies.every((l) => l.state === LobbyState.FINISHED || l.state === LobbyState.FORFEITED);

		if (!allDone) return;

		const alreadyCompleted = activePhase.status === PhaseStatus.Completed;
		if (alreadyCompleted) return;

		await this.swissStageService.advanceToNextPhase(activePhase);

		const allCompleted = phases.every(
			(p) => p.status === PhaseStatus.Completed || p.id === activePhase.id
		);

		const nextActive = phases.find(
			(p) => p.status === PhaseStatus.Active && p.id !== activePhase.id
		);

		if (allCompleted && !nextActive) {
			const t = await em.findOne(Tournament, { id: tournament.id });
			if (t && t.internalState === TournamentState.ONGOING) {
				t.internalState = TournamentState.FINISHED;
				await em.flush();
			}
		}
	}
}
