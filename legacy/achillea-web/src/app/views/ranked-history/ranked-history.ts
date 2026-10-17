import { Component, OnInit, computed, effect, inject, signal } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { Router, RouterLink } from "@angular/router";
import { Card } from "primeng/card";
import { Tag } from "primeng/tag";
import { Button } from "primeng/button";
import { SelectButton } from "primeng/selectbutton";
import { ProgressSpinner } from "primeng/progressspinner";

import { RankedService } from "../../shared/services/ranked-service";
import { UserService } from "../../shared/services/user-service";
import { MatchMode, RankedHistoryEntry } from "../../core/models/Ranked";
import { Sparkline } from "../../shared/components/sparkline/sparkline";
import { onDiscordAvatarError, resolveDiscordAvatarUrl } from "../../core/helpers/discord-avatar";

@Component({
	selector: "app-ranked-history",
	standalone: true,
	imports: [
		CommonModule,
		FormsModule,
		RouterLink,
		Card,
		Tag,
		Button,
		SelectButton,
		ProgressSpinner,
		Sparkline,
	],
	templateUrl: "./ranked-history.html",
	styleUrl: "./ranked-history.css",
})
export class RankedHistory implements OnInit {
	private ranked = inject(RankedService);
	private userSvc = inject(UserService);
	private router = inject(Router);

	readonly history = this.ranked.history;
	readonly hasMore = this.ranked.historyHasMore;
	readonly loading = signal<boolean>(false);
	readonly loadingMore = signal<boolean>(false);
	readonly currentPage = signal<number>(0);
	readonly pageSize = 20;

	readonly modeOptions = [
		{ label: "Tous", value: -1 },
		{ label: "1v1", value: MatchMode.ONE_VS_ONE },
		{ label: "2v2", value: MatchMode.TWO_VS_TWO },
	];
	readonly selectedMode = signal<number>(-1);

	readonly periodOptions = [
		{ label: "7 jours", value: 7 },
		{ label: "30 jours", value: 30 },
		{ label: "Tout", value: 0 },
	];
	readonly selectedPeriod = signal<number>(0);

	readonly filteredHistory = computed(() => {
		const period = this.selectedPeriod();
		const all = this.history();
		if (period === 0) return all;
		const cutoff = Date.now() - period * 24 * 3600 * 1000;
		return all.filter((m) => {
			const t = new Date(m.endedAt).getTime();
			return Number.isFinite(t) && t >= cutoff;
		});
	});

	readonly stats = computed(() => {
		const list = this.filteredHistory();
		const wins = list.filter((m) => m.result === "win").length;
		const losses = list.filter((m) => m.result === "loss").length;
		const forfeits = list.filter((m) => m.result === "forfeit").length;
		const totalDelta = list.reduce((acc, m) => acc + (m.eloDelta ?? 0), 0);
		return { wins, losses, forfeits, totalDelta, total: list.length };
	});

	readonly winrate = computed(() => {
		const s = this.stats();
		if (s.total === 0) return 0;
		return Math.round((s.wins / s.total) * 100);
	});

	// Sparkline = eloDelta dans l'ordre chrono (api renvoie DESC, on reverse).
	readonly sparkData = computed(() =>
		this.filteredHistory()
			.map((m) => m.eloDelta)
			.reverse()
	);

	constructor() {
		effect(() => {
			const mode = this.selectedMode();
			this.currentPage.set(0);
			this.loading.set(true);
			const modeArg = mode === -1 ? null : (mode as MatchMode);
			void this.ranked
				.loadHistory(modeArg, 0, this.pageSize, false)
				.finally(() => this.loading.set(false));
		});
	}

	async ngOnInit(): Promise<void> {
		await this.userSvc.loadUserIfNeeded();
		if (!this.userSvc.user()) {
			void this.router.navigate(["/auth"]);
		}
	}

	async loadMore(): Promise<void> {
		const next = this.currentPage() + 1;
		this.loadingMore.set(true);
		const mode = this.selectedMode();
		const modeArg = mode === -1 ? null : (mode as MatchMode);
		try {
			await this.ranked.loadHistory(modeArg, next, this.pageSize, true);
			this.currentPage.set(next);
		} finally {
			this.loadingMore.set(false);
		}
	}

	resultSeverity(r: RankedHistoryEntry["result"]): "success" | "danger" | "warn" {
		if (r === "win") return "success";
		if (r === "loss") return "danger";
		return "warn";
	}

	resultLabel(r: RankedHistoryEntry["result"]): string {
		if (r === "win") return "Victoire";
		if (r === "loss") return "Défaite";
		return "Forfait";
	}

	relativeTime(iso: string): string {
		if (!iso) return "";
		const then = new Date(iso).getTime();
		if (Number.isNaN(then)) return "";
		const diffMs = Date.now() - then;
		const sec = Math.floor(diffMs / 1000);
		if (sec < 60) return "à l'instant";
		const min = Math.floor(sec / 60);
		if (min < 60) return `il y a ${min} min`;
		const h = Math.floor(min / 60);
		if (h < 24) return `il y a ${h}h`;
		const d = Math.floor(h / 24);
		if (d < 30) return `il y a ${d}j`;
		const mo = Math.floor(d / 30);
		if (mo < 12) return `il y a ${mo} mois`;
		return new Date(iso).toLocaleDateString("fr-FR");
	}

	deltaSign(d: number): string {
		if (d > 0) return `+${d}`;
		return `${d}`;
	}

	avatarUrl(userId: string, avatar: string | null | undefined): string {
		return resolveDiscordAvatarUrl(userId, avatar);
	}

	onAvatarError(event: Event, userId: string): void {
		onDiscordAvatarError(event, userId);
	}
}
