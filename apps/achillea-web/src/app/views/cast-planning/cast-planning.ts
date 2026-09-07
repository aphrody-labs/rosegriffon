import { Component, OnInit, signal, inject } from "@angular/core";
import { DatePipe } from "@angular/common";
import { ActivatedRoute } from "@angular/router";
import { firstValueFrom } from "rxjs";
import { MessageService } from "primeng/api";
import { Button } from "primeng/button";
import { Dialog } from "primeng/dialog";
import { FormsModule } from "@angular/forms";
import { Tag } from "primeng/tag";
import { Textarea } from "primeng/textarea";

import {
	CastPlanningTable,
	type SwapRequest,
} from "../../shared/components/cast-planning-table/cast-planning-table";
import { CastService } from "../../shared/services/cast-service";
import {
	castEventStatusLabel,
	castEventStatusSeverity,
	type CastEvent,
	type ChecklistItem,
} from "../../core/models/Cast";

@Component({
	selector: "app-cast-planning",
	standalone: true,
	imports: [DatePipe, CastPlanningTable, Button, Dialog, FormsModule, Tag, Textarea],
	templateUrl: "./cast-planning.html",
	styleUrl: "./cast-planning.css",
})
export class CastPlanningComponent implements OnInit {
	private castService = inject(CastService);
	private route = inject(ActivatedRoute);
	private msg = inject(MessageService);

	events = signal<CastEvent[]>([]);
	selectedEvent = signal<CastEvent | null>(null);
	checklist = signal<ChecklistItem[]>([]);
	loading = signal(true);
	checklistLoading = signal(false);
	tournamentId = "";

	// Dialog sondage
	showSurveyDialog = signal(false);
	surveyPoolRaw = "";
	surveyLoading = signal(false);

	// Dialog auto-assign
	autoAssignLoading = signal(false);

	ngOnInit(): void {
		this.tournamentId = this.route.snapshot.paramMap.get("tournamentId") ?? "";
		this.loadEvents();
	}

	private loadEvents(): void {
		this.castService.listEvents({ pageSize: 100 }).subscribe({
			next: (resp) => {
				const filtered = this.tournamentId
					? resp.data.filter((e) => e.tournamentId === this.tournamentId)
					: resp.data;
				this.events.set(filtered);
				this.loading.set(false);
				if (filtered.length > 0) {
					this.selectEvent(filtered[0]);
				}
			},
			error: () => this.loading.set(false),
		});
	}

	selectEvent(event: CastEvent): void {
		this.selectedEvent.set(event);
		this.checklistLoading.set(true);
		this.castService.getEvent(event.id).subscribe({
			next: (detail) => {
				this.checklist.set(detail?.checklist ?? []);
				this.checklistLoading.set(false);
			},
			error: () => this.checklistLoading.set(false),
		});
	}

	async onSwap(req: SwapRequest): Promise<void> {
		const result = await firstValueFrom(this.castService.swap(req.attributionId, req.newCasterId));
		if (result) {
			this.msg.add({ severity: "success", summary: "Swap effectué", detail: "Caster modifié" });
			if (this.selectedEvent()) this.selectEvent(this.selectedEvent()!);
		}
	}

	async onConfirm(attributionId: string): Promise<void> {
		const result = await firstValueFrom(this.castService.confirm(attributionId));
		if (result) {
			this.msg.add({ severity: "success", summary: "Confirmé", detail: "Attribution confirmée" });
			if (this.selectedEvent()) this.selectEvent(this.selectedEvent()!);
		}
	}

	openSurveyDialog(): void {
		this.surveyPoolRaw = "";
		this.showSurveyDialog.set(true);
	}

	async confirmOpenSurvey(): Promise<void> {
		const event = this.selectedEvent();
		if (!event) return;

		const pool = this.surveyPoolRaw
			.split(/[\n,]+/)
			.map((s) => s.trim())
			.filter(Boolean);

		if (pool.length === 0) {
			this.msg.add({ severity: "warn", summary: "Pool vide", detail: "Ajoutez des Discord IDs" });
			return;
		}

		this.surveyLoading.set(true);
		const result = await firstValueFrom(this.castService.openSurvey(event.id, pool));
		this.surveyLoading.set(false);
		this.showSurveyDialog.set(false);

		if (result !== null) {
			this.msg.add({
				severity: "success",
				summary: "Sondage ouvert",
				detail: `${pool.length} caster(s) notifié(s)`,
			});
			this.selectEvent(event);
		}
	}

	async onAutoAssign(): Promise<void> {
		const event = this.selectedEvent();
		if (!event) return;

		this.autoAssignLoading.set(true);
		const result = await firstValueFrom(this.castService.autoAssign(event.id));
		this.autoAssignLoading.set(false);

		if (result !== null) {
			this.msg.add({
				severity: "success",
				summary: "Auto-assignation terminée",
				detail: "Les slots ont été attribués automatiquement",
			});
			this.selectEvent(event);
		}
	}

	protected readonly castEventStatusLabel = castEventStatusLabel;
	protected readonly castEventStatusSeverity = castEventStatusSeverity;
}
