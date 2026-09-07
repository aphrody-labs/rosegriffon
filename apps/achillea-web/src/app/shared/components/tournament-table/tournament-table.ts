import { Component, input, OnInit, Signal, inject, signal } from "@angular/core";
import { Column } from "../../../core/models/Column";
import { TournamentsService } from "../../services/tournaments-service";
import { sqlDateToUsableDate } from "../../../core/helpers/misc";
import { Avatar } from "primeng/avatar";
import { DatePipe } from "@angular/common";
import { TableModule } from "primeng/table";
import { RouterLink } from "@angular/router";
import { stageTypeToString, Tournament, TournamentState } from "../../../core/models/Tournament";
import {
	formatPrizeSummary,
	isPlacementPrizeEligible,
} from "../../../core/helpers/tournament-placement-prizes";
import { UserService } from "../../services/user-service";
import { Panel } from "primeng/panel";
import { Tag } from "primeng/tag";
import { Button } from "primeng/button";
import { Dialog } from "primeng/dialog";
import { TournamentCreationForm } from "../tournament-creation-form/tournament-creation-form.component";
import { Tooltip } from "primeng/tooltip";

@Component({
	selector: "app-tournament-table",
	imports: [
		Avatar,
		DatePipe,
		TableModule,
		RouterLink,
		Panel,
		Tag,
		Button,
		Dialog,
		TournamentCreationForm,
		Tooltip,
	],
	templateUrl: "./tournament-table.html",
	styleUrl: "./tournament-table.css",
})
export class TournamentTable implements OnInit {
	private tService = inject(TournamentsService);
	private uSvc = inject(UserService);

	isStandalone = input.required<boolean>();
	/** Mode dashboard admin : colonnes d'actions + édition inline. */
	showAdminActions = input<boolean>(false);

	tournaments: Signal<Tournament[]>;
	tournamentsAreLoading: Signal<boolean>;
	tableColumns: Column[] = [];

	protected showEditDialog = signal(false);
	protected editingTournament = signal<Tournament | null>(null);
	protected actionLoadingId = signal<number | null>(null);

	constructor() {
		this.tournamentsAreLoading = this.tService.dashboardTournamentsLoading;
		this.tournaments = this.tService.dashboardTournaments;
	}

	async ngOnInit() {
		this.tableColumns = [
			{ field: "name", header: "Nom" },
			{ field: "organization", header: "Organisateur" },
			{ field: "type", header: "Format" },
			{ field: "participants_nb", header: "Capacité" },
			{ field: "startAt", header: "Commence le" },
			{ field: "status", header: "Status" },
		];
		if (this.showAdminActions()) {
			this.tableColumns.push(
				{ field: "podium_ap", header: "Podium AP" },
				{ field: "podium_status", header: "Bonus" },
				{ field: "actions", header: "Actions" }
			);
		}

		await this.reload();
	}

	async reload() {
		const orgId = this.uSvc.userIsSuperAdmin() && !this.isStandalone() ? 1 : undefined;
		const states = orgId ? Object.values(TournamentState) : undefined;
		await this.tService.getAndSetDashboardTournaments(1, 50, orgId, states);
	}

	protected canEdit(t: Tournament): boolean {
		return (
			t.internalState !== TournamentState.FINISHED && t.internalState !== TournamentState.CANCELED
		);
	}

	protected canOpenRegistrations(t: Tournament): boolean {
		return t.internalState === TournamentState.PENDING;
	}

	protected canGenerateBracket(t: Tournament): boolean {
		return (
			t.internalState === TournamentState.PREREGISTERING ||
			t.internalState === TournamentState.PREPARING
		);
	}

	protected canStartTournament(t: Tournament): boolean {
		return t.internalState === TournamentState.PREPARING;
	}

	protected openEdit(t: Tournament, event: Event) {
		event.stopPropagation();
		event.preventDefault();
		this.editingTournament.set(t);
		this.showEditDialog.set(true);
	}

	protected onEditClosed() {
		this.showEditDialog.set(false);
		this.editingTournament.set(null);
	}

	protected async onTournamentSaved(_t: Tournament | null) {
		this.onEditClosed();
		await this.reload();
	}

	protected async openRegistrations(t: Tournament, event: Event) {
		event.stopPropagation();
		event.preventDefault();
		this.actionLoadingId.set(t.id);
		try {
			const ok = await this.tService.openRegistrations(t.id);
			if (ok) await this.reload();
		} finally {
			this.actionLoadingId.set(null);
		}
	}

	protected async generateBracket(t: Tournament, event: Event) {
		event.stopPropagation();
		event.preventDefault();
		this.actionLoadingId.set(t.id);
		try {
			const ok = await this.tService.generateBracket(t.id);
			if (ok) await this.reload();
		} finally {
			this.actionLoadingId.set(null);
		}
	}

	protected async startTournament(t: Tournament, event: Event) {
		event.stopPropagation();
		event.preventDefault();
		this.actionLoadingId.set(t.id);
		try {
			const ok = await this.tService.startTournament(t.id);
			if (ok) await this.reload();
		} finally {
			this.actionLoadingId.set(null);
		}
	}

	protected prizeSummary(t: Tournament): string {
		if (!isPlacementPrizeEligible(t.tournamentType)) return "—";
		return formatPrizeSummary(t.participantsNumber ?? 0);
	}

	protected canApplyPlacementPrize(t: Tournament): boolean {
		return (
			t.internalState === TournamentState.FINISHED &&
			isPlacementPrizeEligible(t.tournamentType) &&
			!t.placementEloApplied
		);
	}

	protected podiumStatusLabel(t: Tournament): string {
		if (!isPlacementPrizeEligible(t.tournamentType)) return "N/A";
		if (t.placementEloApplied) return "Versé";
		if (t.internalState === TournamentState.FINISHED) return "À verser";
		return "En attente";
	}

	protected podiumStatusSeverity(
		t: Tournament
	): "success" | "warn" | "secondary" | "info" | "danger" | "contrast" {
		if (!isPlacementPrizeEligible(t.tournamentType)) return "secondary";
		if (t.placementEloApplied) return "success";
		if (t.internalState === TournamentState.FINISHED) return "warn";
		return "info";
	}

	protected async applyPlacementPrizes(t: Tournament, event: Event) {
		event.stopPropagation();
		event.preventDefault();
		this.actionLoadingId.set(t.id);
		try {
			await this.tService.applyPlacementPrizes(t.id);
			await this.reload();
		} finally {
			this.actionLoadingId.set(null);
		}
	}

	protected getTagSeverity(tournamentState: TournamentState) {
		switch (tournamentState) {
			case TournamentState.PENDING:
				return "secondary";
			case TournamentState.CANCELED:
				return "danger";
			case TournamentState.PREPARING:
			case TournamentState.PREREGISTERING:
				return "success";
			case TournamentState.ONGOING:
				return "warn";
			case TournamentState.FINISHED:
				return "info";
			default:
				return "secondary";
		}
	}

	protected getTagLabel(tournamentState: TournamentState) {
		switch (tournamentState) {
			case TournamentState.PENDING:
				return "Planification";
			case TournamentState.CANCELED:
				return "Annulé";
			case TournamentState.PREPARING:
				return "En préparation";
			case TournamentState.PREREGISTERING:
				return "Inscriptions";
			case TournamentState.ONGOING:
				return "En cours";
			case TournamentState.FINISHED:
				return "Terminé";
			default:
				return "-";
		}
	}

	protected readonly sqlDateToUsableDate = sqlDateToUsableDate;
	protected readonly stageTypeToString = stageTypeToString;
	protected readonly TournamentState = TournamentState;
}
