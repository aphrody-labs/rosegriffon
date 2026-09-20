import { Component, computed, input, output, signal, inject } from "@angular/core";
import {
	ParticipantDTO,
	ParticipantStatus,
	Tournament,
	TournamentState,
} from "../../../core/models/Tournament";
// Règles d'inscription : source unique `@rosegriffon/achillea-core/participants`.
import {
	activeParticipants,
	disqualifiedCount,
	freeSeeds,
	hasFreeSlot,
	participantStatus,
	rosterParticipants,
	seedByElo,
	seededCount,
	sortBySeed,
	waitlist,
} from "@rosegriffon/achillea-core";
import { TournamentsService } from "../../services/tournaments-service";
import { getEloImagePath, sqlDateToUsableDate } from "../../../core/helpers/misc";
import { Button } from "primeng/button";
import { Table, TableModule } from "primeng/table";
import { Tag } from "primeng/tag";
import { IconField } from "primeng/iconfield";
import { InputIcon } from "primeng/inputicon";
import { InputText } from "primeng/inputtext";
import { FormControl, FormsModule, ReactiveFormsModule, Validators } from "@angular/forms";
import { MessageService } from "primeng/api";
import { InputNumber } from "primeng/inputnumber";
import { Tooltip } from "primeng/tooltip";
import { Dialog } from "primeng/dialog";
import { RouterLink } from "@angular/router";
import { UserAvatar } from "../user-avatar/user-avatar";

type ConfirmAction =
	| "ranked"
	| "random"
	| "clear"
	| "remove"
	| "disqualify"
	| "reinstate"
	| "promote";

type RankedPreviewRow = {
	seed: number;
	username: string;
	elo: number;
	rankKey: string;
	userId: string;
	avatar?: string;
};

@Component({
	selector: "app-event-participants-table",
	imports: [
		TableModule,
		Tag,
		Button,
		IconField,
		InputIcon,
		InputText,
		FormsModule,
		InputNumber,
		ReactiveFormsModule,
		RouterLink,
		UserAvatar,
		Tooltip,
		Dialog,
	],
	templateUrl: "./event-participants-table.html",
	styleUrl: "./event-participants-table.css",
})
export class EventParticipantsTable {
	private tService = inject(TournamentsService);
	private msgService = inject(MessageService);

	event = input.required<Tournament>();
	participants = input<ParticipantDTO[]>([]);

	/** Id du participant en édition (stable avec pagination / tri / filtre). */
	editingParticipantId = signal<number | undefined>(undefined);
	originalSeed = signal<number | null | undefined>(undefined);
	seedSaving = signal(false);
	bulkLoading = signal(false);

	/** Dialog de confirmation pour actions bulk / retrait / DQ. */
	confirmVisible = signal(false);
	confirmAction = signal<ConfirmAction | null>(null);
	pendingRemove = signal<ParticipantDTO | null>(null);
	/** Cible d'une action de statut (DQ, réintégration, promotion). */
	pendingStatusTarget = signal<ParticipantDTO | null>(null);
	rankedPreview = signal<RankedPreviewRow[]>([]);

	/** Motif de disqualification — exigé par l'API (3 caractères minimum). */
	disqualifyReason = signal("");

	searchValue: string | undefined;

	seedControl = new FormControl<number | null>(null, [Validators.min(0)]);

	eventReloadRequest = output<number>();

	/**
	 * Statut d'un participant. Les réponses d'API antérieures à la liste d'attente ne
	 * portent pas le champ : un inscrit sans statut est un inscrit actif.
	 */
	protected statusOf(p: ParticipantDTO): ParticipantStatus {
		return participantStatus(p);
	}

	/** Inscrits occupant réellement une place + disqualifiés (gardés visibles). */
	readonly rosterParticipants = computed(() => rosterParticipants(this.participants()));

	readonly activeParticipants = computed(() => activeParticipants(this.participants()));

	/** Liste d'attente dans l'ordre de promotion (position calculée par l'API). */
	readonly waitlist = computed(() => waitlist(this.participants()));

	readonly disqualifiedCount = computed(() => disqualifiedCount(this.participants()));

	/** Reste-t-il une place ? Conditionne la promotion manuelle. */
	readonly hasFreeSlot = computed(() => hasFreeSlot(this.participants(), this.participantsCount));

	/** Participants triés seed ASC (nulls en bas) pour un aperçu stable. */
	readonly sortedForPreview = computed(() => sortBySeed(this.activeParticipants()));

	readonly seededCount = computed(() => seededCount(this.participants()));

	readonly freeSeeds = computed(() => freeSeeds(this.participants(), this.participantsCount));

	get participantsCount(): number {
		return this.event().participantsNumber ?? 0;
	}

	/** Seeding éditable tant que le bracket n'a pas démarré (inscriptions + préparation). */
	get canManageSeeding(): boolean {
		const s = this.event().internalState;
		return s === TournamentState.PREREGISTERING || s === TournamentState.PREPARING;
	}

	/** Retrait TO : ouvert en inscriptions et en préparation. */
	get canRemoveParticipant(): boolean {
		const s = this.event().internalState;
		return s === TournamentState.PREREGISTERING || s === TournamentState.PREPARING;
	}

	/**
	 * Disqualification : possible tant que le tournoi n'est ni terminé ni annulé —
	 * y compris en cours, cas principal (triche, forfait, absence répétée).
	 */
	get canDisqualify(): boolean {
		const s = this.event().internalState;
		return s !== TournamentState.FINISHED && s !== TournamentState.CANCELED;
	}

	/** Réintégration : seulement avant le démarrage (les matchs sont déjà propagés après). */
	get canReinstate(): boolean {
		const s = this.event().internalState;
		return (
			s === TournamentState.PENDING ||
			s === TournamentState.PREREGISTERING ||
			s === TournamentState.PREPARING
		);
	}

	get isBusy(): boolean {
		return this.seedSaving() || this.bulkLoading();
	}

	get randomSeedCap(): number {
		return Math.min(this.participants().length, this.participantsCount);
	}

	clear(table: Table) {
		table.clear();
		this.searchValue = "";
	}

	protected eloOf(p: ParticipantDTO): number {
		return p.user?.soloRank?.elo ?? 0;
	}

	protected rankKeyOf(p: ParticipantDTO): string {
		return p.user?.soloRank?.key ?? "Non classé";
	}

	protected occupantOfSeed(seed: number | null | undefined): ParticipantDTO | null {
		if (seed == null || seed <= 0) return null;
		const editingId = this.editingParticipantId();
		return this.participants().find((p) => p.seed === seed && p.id !== editingId) ?? null;
	}

	// ─── Seed édition ───────────────────────────────────────────────

	protected editSeed(participant: ParticipantDTO) {
		if (this.isBusy) return;
		this.originalSeed.set(participant.seed ?? null);
		this.seedControl.setValue(participant.seed ?? null);
		this.editingParticipantId.set(participant.id);
	}

	protected async onEditSeed(participant: ParticipantDTO) {
		if (this.editingParticipantId() !== participant.id || this.seedSaving()) return;

		const raw = this.seedControl.getRawValue();
		const newSeeding = raw != null && raw > 0 ? raw : null;
		const previous = this.originalSeed();

		if (newSeeding === previous) {
			this.resetSeedEdition();
			return;
		}

		if (newSeeding != null && newSeeding > this.participantsCount) {
			this.msgService.add({
				severity: "warn",
				summary: "Seed invalide",
				detail: `La seed doit être entre 1 et ${this.participantsCount}.`,
			});
			return;
		}

		this.seedSaving.set(true);
		// Ne muter le modèle local qu'après succès (évite état fantôme si erreur réseau).
		const payload: ParticipantDTO = { ...participant, seed: newSeeding };

		try {
			const success = await this.tService.setParticipantSeed(this.event().id, payload);
			if (success) {
				this.resetSeedEdition();
				this.eventReloadRequest.emit(this.event().id);
			}
		} finally {
			this.seedSaving.set(false);
		}
	}

	protected onSeedKeydown(event: KeyboardEvent, participant: ParticipantDTO) {
		if (event.key === "Enter") {
			event.preventDefault();
			void this.onEditSeed(participant);
		} else if (event.key === "Escape") {
			event.preventDefault();
			this.resetSeedEdition();
		}
	}

	protected resetSeedEdition() {
		this.originalSeed.set(undefined);
		this.editingParticipantId.set(undefined);
		this.seedControl.reset(null);
	}

	// ─── Confirm dialogs ────────────────────────────────────────────

	protected openRankedConfirm() {
		if (!this.canManageSeeding || this.isBusy) return;
		const list = this.participants();
		if (list.length === 0) {
			this.msgService.add({
				severity: "warn",
				summary: "Aucun participant",
				detail: "Inscris des joueurs avant de seed par ranked.",
			});
			return;
		}

		const preview: RankedPreviewRow[] = seedByElo(list)
			.map(({ seed, participant }) => ({
				seed,
				username: participant.user.username,
				elo: this.eloOf(participant),
				rankKey: this.rankKeyOf(participant),
				userId: participant.user.id,
				avatar: participant.user.avatar,
			}))
			.slice(0, this.participantsCount);

		this.rankedPreview.set(preview);
		this.confirmAction.set("ranked");
		this.confirmVisible.set(true);
	}

	protected openRandomConfirm() {
		if (!this.canManageSeeding || this.isBusy) return;
		if (this.participants().length === 0) {
			this.msgService.add({
				severity: "warn",
				summary: "Aucun participant",
				detail: "Inscris des joueurs avant de mélanger les seeds.",
			});
			return;
		}
		this.confirmAction.set("random");
		this.confirmVisible.set(true);
	}

	protected openClearConfirm() {
		if (!this.canManageSeeding || this.isBusy) return;
		if (this.seededCount() === 0) {
			this.msgService.add({
				severity: "info",
				summary: "Déjà vide",
				detail: "Aucune seed n'est attribuée.",
			});
			return;
		}
		this.confirmAction.set("clear");
		this.confirmVisible.set(true);
	}

	protected openRemoveConfirm(participant: ParticipantDTO) {
		if (!this.canRemoveParticipant || this.isBusy) return;
		this.pendingRemove.set(participant);
		this.confirmAction.set("remove");
		this.confirmVisible.set(true);
	}

	protected openDisqualifyConfirm(participant: ParticipantDTO) {
		if (!this.canDisqualify || this.isBusy) return;
		this.pendingStatusTarget.set(participant);
		this.disqualifyReason.set("");
		this.confirmAction.set("disqualify");
		this.confirmVisible.set(true);
	}

	protected openReinstateConfirm(participant: ParticipantDTO) {
		if (!this.canReinstate || this.isBusy) return;
		this.pendingStatusTarget.set(participant);
		this.confirmAction.set("reinstate");
		this.confirmVisible.set(true);
	}

	protected openPromoteConfirm(participant: ParticipantDTO) {
		if (this.isBusy) return;
		this.pendingStatusTarget.set(participant);
		this.confirmAction.set("promote");
		this.confirmVisible.set(true);
	}

	protected closeConfirm() {
		if (this.bulkLoading()) return;
		this.confirmVisible.set(false);
		this.confirmAction.set(null);
		this.pendingRemove.set(null);
		this.pendingStatusTarget.set(null);
		this.disqualifyReason.set("");
		this.rankedPreview.set([]);
	}

	/** Le motif de DQ conditionne l'activation du bouton (même règle que l'API). */
	protected get canConfirmAction(): boolean {
		if (this.confirmAction() === "disqualify") return this.disqualifyReason().trim().length >= 3;
		return true;
	}

	protected onDisqualifyReasonInput(event: Event) {
		this.disqualifyReason.set((event.target as HTMLInputElement)?.value ?? "");
	}

	protected get confirmTitle(): string {
		switch (this.confirmAction()) {
			case "ranked":
				return "Seed selon classement ranked";
			case "random":
				return "Mélanger les seeds";
			case "clear":
				return "Effacer toutes les seeds";
			case "remove":
				return "Retirer un participant";
			case "disqualify":
				return "Disqualifier un participant";
			case "reinstate":
				return "Annuler une disqualification";
			case "promote":
				return "Promouvoir depuis la liste d'attente";
			default:
				return "Confirmer";
		}
	}

	protected get confirmLabel(): string {
		switch (this.confirmAction()) {
			case "remove":
				return "Retirer";
			case "clear":
				return "Effacer";
			case "disqualify":
				return "Disqualifier";
			case "reinstate":
				return "Réintégrer";
			case "promote":
				return "Promouvoir";
			default:
				return "Appliquer";
		}
	}

	protected get confirmSeverity(): "danger" | "help" | "success" {
		const action = this.confirmAction();
		if (action === "remove" || action === "clear" || action === "disqualify") return "danger";
		if (action === "reinstate" || action === "promote") return "success";
		return "help";
	}

	protected async runConfirmedAction() {
		const action = this.confirmAction();
		if (!action || this.bulkLoading()) return;

		this.bulkLoading.set(true);
		try {
			let success = false;
			const id = this.event().id;

			if (action === "ranked") {
				success = await this.tService.seedByRanked(id);
			} else if (action === "random") {
				success = await this.tService.seedRandom(id);
			} else if (action === "clear") {
				success = await this.tService.clearSeeds(id);
			} else if (action === "remove") {
				const p = this.pendingRemove();
				if (p) {
					success = await this.tService.removeParticipant(id, p.user.id);
					if (success) {
						this.msgService.add({
							severity: "success",
							summary: "Participant retiré",
							detail: `${p.user.username} a été retiré de ${this.event().name}.`,
						});
					}
				}
			} else if (action === "disqualify") {
				const p = this.pendingStatusTarget();
				if (p) {
					success = await this.tService.disqualifyParticipant(
						id,
						p.user.id,
						this.disqualifyReason().trim()
					);
				}
			} else if (action === "reinstate") {
				const p = this.pendingStatusTarget();
				if (p) success = await this.tService.reinstateParticipant(id, p.user.id);
			} else if (action === "promote") {
				const p = this.pendingStatusTarget();
				if (p) success = await this.tService.promoteParticipant(id, p.user.id);
			}

			if (success) {
				this.closeConfirm();
				this.resetSeedEdition();
				this.eventReloadRequest.emit(id);
			}
		} finally {
			this.bulkLoading.set(false);
		}
	}

	protected readonly sqlDateToUsableDate = sqlDateToUsableDate;
	protected readonly getEloImagePath = getEloImagePath;
	protected readonly TournamentState = TournamentState;
	protected readonly ParticipantStatus = ParticipantStatus;
}
