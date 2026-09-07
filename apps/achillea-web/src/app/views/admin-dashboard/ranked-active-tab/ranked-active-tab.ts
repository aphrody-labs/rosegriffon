import { Component, OnDestroy, OnInit, inject, signal } from "@angular/core";
import { CommonModule } from "@angular/common";
import { TableModule } from "primeng/table";
import { Button } from "primeng/button";
import { Tag } from "primeng/tag";

import { RankedService } from "../../../shared/services/ranked-service";

// Onglet admin « Matchs en cours » : liste live des lobbies Ongoing uniquement.
// Les KPI globaux restent sur la Vue d'ensemble (zéro doublon).
@Component({
	selector: "app-ranked-active-tab",
	standalone: true,
	imports: [CommonModule, TableModule, Button, Tag],
	templateUrl: "./ranked-active-tab.html",
	styleUrl: "./ranked-active-tab.css",
})
export class RankedActiveTabComponent implements OnInit, OnDestroy {
	private ranked = inject(RankedService);

	readonly matches = this.ranked.activeMatches;
	readonly loading = signal(false);

	private timer: ReturnType<typeof setInterval> | null = null;

	async ngOnInit(): Promise<void> {
		await this.refresh();
		this.timer = setInterval(() => void this.refresh(), 15000);
	}

	ngOnDestroy(): void {
		if (this.timer) clearInterval(this.timer);
	}

	async refresh(): Promise<void> {
		this.loading.set(true);
		await this.ranked.loadActiveMatches();
		this.loading.set(false);
	}

	modeLabel(mode: number): string {
		return mode === 4 ? "2v2" : "1v1";
	}
}
