import { Component, computed, input, OnInit, output, signal, inject } from "@angular/core";
import { TournamentsService } from "../../services/tournaments-service";
import { UserService } from "../../services/user-service";
import {
	GameScoreDTO,
	GameValidatorDTO,
	LobbyDTO,
	LobbyMatchDTO,
	LobbyState,
	TeamSide,
} from "../../../core/models/Lobby";
import { ScoreReportPolicy } from "../../../core/models/Tournament";
import { ProgressSpinner } from "primeng/progressspinner";
import { Avatar } from "primeng/avatar";
import { TableModule } from "primeng/table";
import { getEloImagePath } from "../../../core/helpers/misc";
import { Column } from "../../../core/models/Column";
import { RouterLink } from "@angular/router";
import { Button } from "primeng/button";
import { FormControl, ReactiveFormsModule, Validators } from "@angular/forms";
import { InputNumber } from "primeng/inputnumber";

@Component({
	selector: "app-scores-dialog",
	imports: [
		ProgressSpinner,
		Avatar,
		TableModule,
		RouterLink,
		Button,
		InputNumber,
		ReactiveFormsModule,
	],
	templateUrl: "./scores-dialog.html",
	styleUrl: "./scores-dialog.css",
})
export class ScoresDialog implements OnInit {
	private tournamentsSvc = inject(TournamentsService);
	private userService = inject(UserService);

	bracketMatchId = input.required<number>();
	isTournamentOrganizer = input.required<boolean>();
	isTournamentOngoing = input.required<boolean>();
	/**
	 * Qui saisit les scores de ce tournoi. Miroir de `canReportTournamentScore`
	 * (@rosegriffon/achillea-core/tournaments), que l'API fait respecter de son côté : la règle est
	 * dupliquée ici parce que le front ne résout que `@rosegriffon/achillea-types`.
	 */
	scoreReportPolicy = input<ScoreReportPolicy>(ScoreReportPolicy.PLAYERS);
	onScoreValidation = output<boolean>();
	lobby = signal<LobbyDTO | null>(null);
	scoreColumns: Column[] = [];
	actionScoreColumns: Column[] = [];

	score1Control = new FormControl<number>(0, [Validators.min(0)]);
	score2Control = new FormControl<number>(0, [Validators.min(0)]);

	isEditing = signal<number | undefined>(undefined);

	/** TO ou joueur du lobby : peut saisir / valider les scores (API report-score / validate-score). */
	protected canActOnScores = computed(() => {
		if (!this.isTournamentOngoing()) return false;
		if (this.isTournamentOrganizer()) return true;
		if (this.scoreReportPolicy() === ScoreReportPolicy.STAFF_ONLY) return false;
		const uid = this.userService.user()?.id;
		const lobby = this.lobby();
		if (!uid || !lobby) return false;
		return lobby.lobbyUsers.some((lu) => lu.user?.id === uid);
	});

	/**
	 * Joueur du match qui n'a pas la main : on lui dit pourquoi plutôt que de lui
	 * présenter un tableau muet dont il conclurait à un bug.
	 */
	protected staffOnlyNotice = computed(() => {
		if (this.scoreReportPolicy() !== ScoreReportPolicy.STAFF_ONLY) return false;
		if (this.isTournamentOrganizer()) return false;
		const uid = this.userService.user()?.id;
		const lobby = this.lobby();
		if (!uid || !lobby) return false;
		return lobby.lobbyUsers.some((lu) => lu.user?.id === uid);
	});

	constructor() {
		this.scoreColumns = [
			{ field: "player1", header: "Joueur" },
			{ field: "score1", header: "Score" },
			{ field: "vs", header: "" },
			{ field: "score2", header: "Score" },
			{ field: "player2", header: "Joueur" },
			{ field: "validated", header: "Validé" },
		];

		this.actionScoreColumns = [
			{ field: "player1", header: "Joueur" },
			{ field: "score1", header: "Score" },
			{ field: "vs", header: "" },
			{ field: "score2", header: "Score" },
			{ field: "player2", header: "Joueur" },
			{ field: "validated", header: "Validé" },
			{ field: "edit", header: "Editer" },
			{ field: "validate", header: "Valider" },
		];
	}

	async ngOnInit() {
		await this.loadLobby();
	}

	private async loadLobby() {
		const fetchedLobby = await this.tournamentsSvc.getTournamentLobby(this.bracketMatchId());
		this.lobby.set(fetchedLobby);
	}

	protected getFirstUserDataFromTeam(lobby: LobbyDTO, side: TeamSide) {
		const lu = lobby.lobbyUsers.find((lu) => lu.team === side);

		if (!lu) return null;
		else return lu.user;
	}

	protected getLobbyMatchScore(lobbyMatch: LobbyMatchDTO, side: TeamSide) {
		return side === TeamSide.TEAM_1 ? lobbyMatch.scoreTeam1 : lobbyMatch.scoreTeam2;
	}

	protected isLobbyMatchAdminValidated(lobbyMatch: LobbyMatchDTO): boolean {
		return lobbyMatch.adminValidated;
	}

	protected isLobbyMatchPlayerValidated(lobbyMatch: LobbyMatchDTO): boolean {
		return lobbyMatch.team1Validated && lobbyMatch.team2Validated;
	}

	protected isLobbyMatchValidated(lobbyMatch: LobbyMatchDTO) {
		return (
			this.isLobbyMatchAdminValidated(lobbyMatch) || this.isLobbyMatchPlayerValidated(lobbyMatch)
		);
	}

	protected isPreviousLobbyMatchValidated(index: number): boolean {
		if (index === 0) return true;

		const matches = this.lobby()?.lobbyMatches;
		if (!matches) return false;

		const previousMatch = matches[index - 1];

		return this.isLobbyMatchValidated(previousMatch);
	}

	protected editScores(index: number, lobbyMatch: LobbyMatchDTO) {
		this.score1Control.setValue(lobbyMatch.scoreTeam1);
		this.score2Control.setValue(lobbyMatch.scoreTeam2);
		this.isEditing.set(index);
	}

	protected async onEditScores(gameNumber: number) {
		if (!this.lobby()) return;

		const scoreDTO: GameScoreDTO = {
			lobbyId: this.lobby()!.id,
			gameNumber,
			score1: Number(this.score1Control.getRawValue()),
			score2: Number(this.score2Control.getRawValue()),
		};

		const success = await this.tournamentsSvc.reportScore(scoreDTO);

		if (success) {
			this.resetScoreEdition();
			await this.loadLobby();
		}
	}

	protected resetScoreEdition() {
		this.isEditing.set(undefined);
		this.score1Control.reset();
		this.score2Control.reset();
	}

	protected async onValidateScore(lobbyMatch: LobbyMatchDTO) {
		if (!this.lobby()) return;

		const validationDTO: GameValidatorDTO = {
			lobbyId: this.lobby()!.id,
			lobbyMatchId: lobbyMatch.id,
		};

		const success = await this.tournamentsSvc.validateScore(validationDTO);

		if (success) {
			await this.loadLobby();
			this.onScoreValidation.emit(true);
		}
	}

	protected isLobbyFinished() {
		if (!this.lobby()) return;

		return (
			this.lobby()!.state === LobbyState.FINISHED || this.lobby()!.state === LobbyState.FORFEITED
		);
	}

	protected readonly TeamSide = TeamSide;
	protected readonly getEloImagePath = getEloImagePath;
}
