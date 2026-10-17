import { Component, OnInit, computed, inject, signal } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { TableModule } from "primeng/table";
import { Button } from "primeng/button";
import { Tag } from "primeng/tag";
import { Dialog } from "primeng/dialog";
import { InputNumber } from "primeng/inputnumber";
import { Select } from "primeng/select";

import { RankedService } from "../../../shared/services/ranked-service";
import { RankedAdminDispute, RankedAdminValidateRequest } from "../../../core/models/Ranked";
import { environment } from "../../../../environments/environment";

@Component({
	selector: "app-ranked-disputes-tab",
	standalone: true,
	imports: [CommonModule, FormsModule, TableModule, Button, Tag, Dialog, InputNumber, Select],
	templateUrl: "./ranked-disputes-tab.html",
	styleUrl: "./ranked-disputes-tab.css",
})
export class RankedDisputesTabComponent implements OnInit {
	private ranked = inject(RankedService);

	readonly disputes = this.ranked.disputes;
	readonly loading = signal(false);
	readonly resolving = signal(false);
	readonly cancelling = signal(false);

	// Les captures sont servies par l'hôte ranked (chemins relatifs /storage/...),
	// pas par le web. On dérive l'origine https depuis l'URL Colyseus (ws→http).
	private readonly rankedOrigin = environment.colyseusUrl.replace(/^ws/, "http");

	// URL absolue d'une capture de preuve (null/relatif géré).
	screenshotSrc(url: string | null | undefined): string {
		if (!url) return "";
		if (url.startsWith("http")) return url;
		return this.rankedOrigin + url;
	}

	readonly selected = signal<RankedAdminDispute | null>(null);
	readonly score1 = signal(0);
	readonly score2 = signal(0);
	readonly forfeitUserId = signal<string | null>(null);

	readonly forfeitOptions = computed(() => {
		const s = this.selected();
		if (!s) return [{ label: "Aucun", value: null }];
		return [
			{ label: "Aucun", value: null },
			{ label: s.player1.displayName, value: s.player1.userId },
			{ label: s.player2.displayName, value: s.player2.userId },
		];
	});

	async ngOnInit(): Promise<void> {
		this.loading.set(true);
		await this.ranked.loadAdminDisputes();
		this.loading.set(false);
	}

	openResolution(d: RankedAdminDispute): void {
		this.selected.set(d);
		this.score1.set(d.player1.submittedScore);
		this.score2.set(d.player2.submittedScore);
		this.forfeitUserId.set(null);
	}

	closeResolution(): void {
		this.selected.set(null);
	}

	async confirm(): Promise<void> {
		const d = this.selected();
		if (!d) return;
		const body: RankedAdminValidateRequest = {
			scoreTeam1: this.score1(),
			scoreTeam2: this.score2(),
			forfeitUserId: this.forfeitUserId() ?? undefined,
		};
		this.resolving.set(true);
		const ok = await this.ranked.adminValidateMatch(d.lobbyId, body);
		this.resolving.set(false);
		if (ok) this.closeResolution();
	}

	// Annule le match contesté (aucun ELO appliqué). Admin+ côté serveur.
	async cancel(d: RankedAdminDispute): Promise<void> {
		this.cancelling.set(true);
		const ok = await this.ranked.cancelMatch(d.lobbyId);
		this.cancelling.set(false);
		if (ok && this.selected()?.lobbyId === d.lobbyId) this.closeResolution();
	}

	async refresh(): Promise<void> {
		this.loading.set(true);
		await this.ranked.loadAdminDisputes();
		this.loading.set(false);
	}
}
