import { DatePipe } from "@angular/common";
import { Component, OnInit, computed, inject, input, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { Button } from "primeng/button";
import { Dialog } from "primeng/dialog";
import { InputText } from "primeng/inputtext";
import { Select } from "primeng/select";
import { TableModule } from "primeng/table";
import { Tag } from "primeng/tag";
import { Textarea } from "primeng/textarea";
import { Tooltip } from "primeng/tooltip";

import {
	PLAYER_NOTE_CATEGORY_LABELS,
	PLAYER_NOTE_SEVERITY_LABELS,
	PlayerNote,
	PlayerNoteCategory,
	PlayerNoteSeverity,
	playerNoteSeverityColor,
} from "../../../core/models/PlayerNote";
import { PlayerNotesService } from "../../services/player-notes-service";
import { UserAvatar } from "../user-avatar/user-avatar";

interface Option<T> {
	label: string;
	value: T;
}

/**
 * Registre des signalements — vue partagée par le tableau de bord admin (tout le
 * périmètre) et la page d'un tournoi (le périmètre de ce tournoi).
 *
 * Un seul composant pour les deux : les organisateurs et le staff doivent lire
 * exactement la même chose, sinon un signalement « vu côté tournoi » et un signalement
 * « vu côté admin » finiraient par diverger.
 */
@Component({
	selector: "app-player-notes-panel",
	standalone: true,
	imports: [
		TableModule,
		Tag,
		Button,
		Select,
		InputText,
		Textarea,
		Dialog,
		Tooltip,
		DatePipe,
		FormsModule,
		UserAvatar,
	],
	templateUrl: "./player-notes-panel.html",
	styleUrl: "./player-notes-panel.css",
})
export class PlayerNotesPanel implements OnInit {
	private notesSvc = inject(PlayerNotesService);

	/** Restreint le panneau à un tournoi (page tournoi) ; absent = tout (admin). */
	tournamentId = input<number | null>(null);
	/** Joueurs proposés à la saisie — participants du tournoi, côté page tournoi. */
	candidates = input<Array<{ id: string; label: string; avatar?: string }>>([]);
	/** Titre alternatif, pour distinguer les deux contextes. */
	heading = input<string>("Signalements joueurs");

	notes = signal<PlayerNote[]>([]);
	total = signal(0);
	loading = signal(false);
	isStaff = signal(false);

	// Filtres
	filterSearch = "";
	filterCategory: PlayerNoteCategory | null = null;
	filterSeverity: PlayerNoteSeverity | null = null;
	filterResolved: boolean | null = null;

	// Saisie
	showCreateDialog = signal(false);
	saving = signal(false);
	draftTargetId: string | null = null;
	draftContent = "";
	draftCategory: PlayerNoteCategory = PlayerNoteCategory.BEHAVIOR;
	draftSeverity: PlayerNoteSeverity = PlayerNoteSeverity.INFO;

	readonly categoryOptions: Option<PlayerNoteCategory>[] = Object.entries(
		PLAYER_NOTE_CATEGORY_LABELS
	).map(([value, label]) => ({ label, value: value as PlayerNoteCategory }));

	readonly severityOptions: Option<PlayerNoteSeverity>[] = Object.entries(
		PLAYER_NOTE_SEVERITY_LABELS
	).map(([value, label]) => ({ label, value: value as PlayerNoteSeverity }));

	readonly filterCategoryOptions: Option<PlayerNoteCategory | null>[] = [
		{ label: "Toutes catégories", value: null },
		...this.categoryOptions,
	];

	readonly filterSeverityOptions: Option<PlayerNoteSeverity | null>[] = [
		{ label: "Toutes gravités", value: null },
		...this.severityOptions,
	];

	readonly filterStateOptions: Option<boolean | null>[] = [
		{ label: "Tous les états", value: null },
		{ label: "À traiter", value: false },
		{ label: "Traités", value: true },
	];

	readonly openCount = computed(() => this.notes().filter((n) => !n.resolved).length);

	/** Un signalement ne peut être déposé que si l'on sait sur qui. */
	readonly canSubmit = computed(() => !!this.draftTargetId && this.draftContent.trim().length >= 3);

	async ngOnInit() {
		await this.reload();
	}

	async reload() {
		this.loading.set(true);
		try {
			const result = await this.notesSvc.list({
				tournamentId: this.tournamentId() ?? undefined,
				category: this.filterCategory,
				severity: this.filterSeverity,
				resolved: this.filterResolved,
				search: this.filterSearch,
				pageSize: 100,
			});

			if (result) {
				this.notes.set(result.data);
				this.total.set(result.total);
				this.isStaff.set(result.meta.isStaff);
			}
		} finally {
			this.loading.set(false);
		}
	}

	openCreateDialog() {
		this.draftTargetId = this.candidates()[0]?.id ?? null;
		this.draftContent = "";
		this.draftCategory = PlayerNoteCategory.BEHAVIOR;
		this.draftSeverity = PlayerNoteSeverity.INFO;
		this.showCreateDialog.set(true);
	}

	async submit() {
		if (!this.canSubmit() || this.saving()) return;

		this.saving.set(true);
		try {
			const note = await this.notesSvc.create({
				targetId: this.draftTargetId!,
				tournamentId: this.tournamentId(),
				category: this.draftCategory,
				severity: this.draftSeverity,
				content: this.draftContent.trim(),
			});

			if (note) {
				this.showCreateDialog.set(false);
				await this.reload();
			}
		} finally {
			this.saving.set(false);
		}
	}

	async toggleResolved(note: PlayerNote) {
		const updated = await this.notesSvc.setResolved(note.id, !note.resolved);
		if (updated) await this.reload();
	}

	async remove(note: PlayerNote) {
		if (await this.notesSvc.remove(note.id)) await this.reload();
	}

	protected categoryLabel(category: PlayerNoteCategory): string {
		return PLAYER_NOTE_CATEGORY_LABELS[category] ?? category;
	}

	protected severityLabel(severity: PlayerNoteSeverity): string {
		return PLAYER_NOTE_SEVERITY_LABELS[severity] ?? severity;
	}

	protected readonly severityColor = playerNoteSeverityColor;
}
