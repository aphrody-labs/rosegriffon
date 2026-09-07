import { Component, OnInit, inject, signal } from "@angular/core";
import { DatePipe } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { TableModule } from "primeng/table";
import { Button } from "primeng/button";
import { Tag } from "primeng/tag";
import { InputNumber } from "primeng/inputnumber";

import { RankedService } from "../../../shared/services/ranked-service";

@Component({
	selector: "app-ranked-telemetry-tab",
	standalone: true,
	imports: [DatePipe, FormsModule, TableModule, Button, Tag, InputNumber],
	templateUrl: "./ranked-telemetry-tab.html",
	styleUrl: "./ranked-telemetry-tab.css",
})
export class RankedTelemetryTabComponent implements OnInit {
	private ranked = inject(RankedService);

	// Journal des événements ranked (vue staff), alimenté par loadTelemetry().
	readonly events = this.ranked.telemetry;
	readonly loading = signal(false);
	readonly lobbyFilter = signal<number | null>(null);

	async ngOnInit(): Promise<void> {
		await this.refresh();
	}

	async refresh(): Promise<void> {
		this.loading.set(true);
		const lobbyId = this.lobbyFilter();
		await this.ranked.loadTelemetry(lobbyId ? { lobbyId, limit: 200 } : { limit: 200 });
		this.loading.set(false);
	}

	clearFilter(): void {
		this.lobbyFilter.set(null);
		void this.refresh();
	}

	// Résumé compact du payload JSON de l'événement.
	detailText(detail: Record<string, unknown> | null | undefined): string {
		if (!detail) return "";
		try {
			return JSON.stringify(detail);
		} catch {
			return "";
		}
	}
}
