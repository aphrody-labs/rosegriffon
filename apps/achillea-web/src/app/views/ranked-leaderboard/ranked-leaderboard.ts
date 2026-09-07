import { Component, OnInit, computed, effect, inject, signal } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { RouterLink } from "@angular/router";
import { Card } from "primeng/card";
import { Tag } from "primeng/tag";
import { SelectButton } from "primeng/selectbutton";
import { ProgressSpinner } from "primeng/progressspinner";
import { TableModule } from "primeng/table";
import { InputTextModule } from "primeng/inputtext";
import { IconField } from "primeng/iconfield";
import { InputIcon } from "primeng/inputicon";

import { RankedService } from "../../shared/services/ranked-service";
import { UserService } from "../../shared/services/user-service";
import { MatchMode } from "../../core/models/Ranked";

@Component({
	selector: "app-ranked-leaderboard",
	standalone: true,
	imports: [
		CommonModule,
		FormsModule,
		RouterLink,
		Card,
		Tag,
		SelectButton,
		ProgressSpinner,
		TableModule,
		InputTextModule,
		IconField,
		InputIcon,
	],
	templateUrl: "./ranked-leaderboard.html",
	styleUrl: "./ranked-leaderboard.css",
})
export class RankedLeaderboard implements OnInit {
	private ranked = inject(RankedService);
	private userSvc = inject(UserService);

	readonly leaderboard = this.ranked.leaderboard;
	readonly loading = signal<boolean>(false);
	readonly currentPage = signal<number>(0);
	readonly pageSize = 50;

	readonly modeOptions = [
		{ label: "1v1", value: MatchMode.ONE_VS_ONE },
		{ label: "2v2", value: MatchMode.TWO_VS_TWO },
	];
	readonly selectedMode = signal<MatchMode>(MatchMode.ONE_VS_ONE);

	readonly currentUserId = computed(() => this.userSvc.user()?.id ?? null);

	readonly searchQuery = signal<string>("");
	readonly rawEntries = computed(() => this.leaderboard()?.entries ?? []);
	readonly entries = computed(() => {
		const q = this.searchQuery().trim().toLowerCase();
		if (!q) return this.rawEntries();
		return this.rawEntries().filter((e) => (e.displayName ?? "").toLowerCase().includes(q));
	});
	readonly total = computed(() => this.leaderboard()?.total ?? 0);

	readonly podium = computed(() => {
		const list = this.rawEntries();
		const first = list.find((e) => e.rank === 1) ?? null;
		const second = list.find((e) => e.rank === 2) ?? null;
		const third = list.find((e) => e.rank === 3) ?? null;
		return { first, second, third };
	});

	constructor() {
		effect(() => {
			const mode = this.selectedMode();
			const page = this.currentPage();
			this.loading.set(true);
			void this.ranked
				.loadLeaderboard(mode, null, page, this.pageSize)
				.finally(() => this.loading.set(false));
		});
	}

	async ngOnInit(): Promise<void> {
		await this.userSvc.loadUserIfNeeded();
	}

	onPage(event: { first: number; rows: number }): void {
		this.currentPage.set(Math.floor(event.first / event.rows));
	}

	onModeChange(mode: MatchMode): void {
		this.currentPage.set(0);
		this.selectedMode.set(mode);
	}

	isCurrentUser(userId: string): boolean {
		return userId === this.currentUserId();
	}

	rankClass(rank: number): string {
		if (rank === 1) return "rank-gold";
		if (rank === 2) return "rank-silver";
		if (rank === 3) return "rank-bronze";
		return "";
	}
}
