import { Component, OnInit, signal, inject } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { firstValueFrom } from "rxjs";
import { MessageService } from "primeng/api";

import {
	CastAvailabilityForm,
	type AvailabilityFormValue,
} from "../../shared/components/cast-availability-form/cast-availability-form";
import { CastService } from "../../shared/services/cast-service";
import { CastEventStatus, type CastEvent } from "../../core/models/Cast";

@Component({
	selector: "app-cast-availability",
	standalone: true,
	imports: [CastAvailabilityForm],
	templateUrl: "./cast-availability.html",
	styleUrl: "./cast-availability.css",
})
export class CastAvailabilityComponent implements OnInit {
	private castService = inject(CastService);
	private route = inject(ActivatedRoute);
	private msg = inject(MessageService);

	events = signal<CastEvent[]>([]);
	loading = signal(true);
	submitting = signal<Record<string, boolean>>({});
	tournamentId = "";

	ngOnInit(): void {
		this.tournamentId = this.route.snapshot.paramMap.get("tournamentId") ?? "";
		this.loadEvents();
	}

	private loadEvents(): void {
		this.castService.listEvents({ status: CastEventStatus.OpenSignup, pageSize: 100 }).subscribe({
			next: (resp) => {
				// Filtrer sur le tournamentId si présent
				const filtered = this.tournamentId
					? resp.data.filter((e) => e.tournamentId === this.tournamentId)
					: resp.data;
				this.events.set(filtered);
				this.loading.set(false);
			},
			error: () => this.loading.set(false),
		});
	}

	async onAvailabilitySubmit(value: AvailabilityFormValue): Promise<void> {
		this.submitting.update((s) => ({ ...s, [value.eventId]: true }));

		const result = await firstValueFrom(
			this.castService.recordAvailability(value.eventId, value.status, value.preferredRoles)
		);

		this.submitting.update((s) => ({ ...s, [value.eventId]: false }));

		if (result !== null) {
			this.msg.add({
				severity: "success",
				summary: "Disponibilité enregistrée",
				detail: "Votre réponse a été prise en compte",
			});
		}
	}
}
