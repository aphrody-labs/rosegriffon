import { Component, OnInit, computed, inject, signal } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { TableModule } from "primeng/table";
import { Button } from "primeng/button";
import { Tag } from "primeng/tag";
import { Dialog } from "primeng/dialog";
import { InputNumber } from "primeng/inputnumber";
import { InputText } from "primeng/inputtext";
import { DatePicker } from "primeng/datepicker";
import { Select } from "primeng/select";

import { RankedService } from "../../../shared/services/ranked-service";
import { RankedAdminSeason, SeasonState } from "../../../core/models/Ranked";

// Onglet « Saisons Ranked » : pilotage complet d'une saison sans coder —
// créer / modifier / activer (clôt l'active courante) / clôturer, régler le
// K-factor et le rating de base, et réinitialiser le ladder en un clic.
@Component({
	selector: "app-ranked-seasons-tab",
	standalone: true,
	imports: [
		CommonModule,
		FormsModule,
		TableModule,
		Button,
		Tag,
		Dialog,
		InputNumber,
		InputText,
		DatePicker,
		Select,
	],
	templateUrl: "./ranked-seasons-tab.html",
})
export class RankedSeasonsTabComponent implements OnInit {
	private ranked = inject(RankedService);

	readonly seasons = this.ranked.seasons;
	readonly loading = signal(false);
	readonly saving = signal(false);
	readonly busyId = signal<string | null>(null);

	// Dialog création / édition (editingId null = création).
	readonly formOpen = signal(false);
	readonly editingId = signal<string | null>(null);
	readonly fName = signal("");
	readonly fStart = signal<Date | null>(null);
	readonly fEnd = signal<Date | null>(null);
	readonly fK = signal(32);
	readonly fBase = signal(0);
	readonly fDecay = signal(0);
	readonly fState = signal<SeasonState>("Upcoming");

	readonly stateOptions = [
		{ label: "À venir", value: "Upcoming" },
		{ label: "Active", value: "Active" },
		{ label: "Clôturée", value: "Closed" },
	];

	// Cibles des confirmations (actions destructives / impactantes).
	readonly resetTarget = signal<RankedAdminSeason | null>(null);
	readonly activateTarget = signal<RankedAdminSeason | null>(null);

	readonly dialogTitle = computed(() =>
		this.editingId() ? "Modifier la saison" : "Nouvelle saison"
	);

	// Saison actuellement active (cible du reset rapide depuis l'en-tête).
	readonly activeSeason = computed(() => this.seasons().find((s) => s.state === "Active") ?? null);

	readonly canSave = computed(() => {
		const name = this.fName().trim();
		const start = this.fStart();
		const end = this.fEnd();
		return !!name && !!start && !!end && end.getTime() > start.getTime();
	});

	async ngOnInit(): Promise<void> {
		this.loading.set(true);
		await this.ranked.loadSeasons();
		this.loading.set(false);
	}

	async refresh(): Promise<void> {
		this.loading.set(true);
		await this.ranked.loadSeasons();
		this.loading.set(false);
	}

	stateSeverity(s: SeasonState): "success" | "info" | "secondary" {
		return s === "Active" ? "success" : s === "Upcoming" ? "info" : "secondary";
	}

	stateLabel(s: SeasonState): string {
		return s === "Active" ? "Active" : s === "Upcoming" ? "À venir" : "Clôturée";
	}

	openCreate(): void {
		this.editingId.set(null);
		this.fName.set("");
		const now = new Date();
		const in90 = new Date(now.getTime() + 90 * 24 * 3600 * 1000);
		this.fStart.set(now);
		this.fEnd.set(in90);
		this.fK.set(32);
		this.fBase.set(0);
		this.fDecay.set(0);
		this.fState.set("Upcoming");
		this.formOpen.set(true);
	}

	openEdit(s: RankedAdminSeason): void {
		this.editingId.set(s.id);
		this.fName.set(s.name);
		this.fStart.set(new Date(s.startsAt));
		this.fEnd.set(new Date(s.endsAt));
		this.fK.set(s.config.kFactor);
		this.fBase.set(s.config.baseRating);
		this.fDecay.set(s.config.decayRate);
		this.fState.set(s.state);
		this.formOpen.set(true);
	}

	async save(): Promise<void> {
		if (!this.canSave()) return;
		const config = { kFactor: this.fK(), baseRating: this.fBase(), decayRate: this.fDecay() };
		const id = this.editingId();
		this.saving.set(true);
		const ok = id
			? await this.ranked.updateSeason(id, {
					name: this.fName().trim(),
					startsAt: this.fStart()!.toISOString(),
					endsAt: this.fEnd()!.toISOString(),
					state: this.fState(),
					config,
				})
			: await this.ranked.createSeason({
					name: this.fName().trim(),
					startsAt: this.fStart()!.toISOString(),
					endsAt: this.fEnd()!.toISOString(),
					config,
				});
		this.saving.set(false);
		if (ok) this.formOpen.set(false);
	}

	async confirmActivate(): Promise<void> {
		const s = this.activateTarget();
		if (!s) return;
		this.busyId.set(s.id);
		await this.ranked.activateSeason(s.id);
		this.busyId.set(null);
		this.activateTarget.set(null);
	}

	async confirmReset(): Promise<void> {
		const s = this.resetTarget();
		if (!s) return;
		this.busyId.set(s.id);
		await this.ranked.resetLadder(s.id);
		this.busyId.set(null);
		this.resetTarget.set(null);
	}
}
