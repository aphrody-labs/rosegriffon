import { Component, OnInit, computed, inject, signal } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { RouterLink } from "@angular/router";
import { Card } from "primeng/card";
import { Tag } from "primeng/tag";
import { ProgressSpinner } from "primeng/progressspinner";
import { TableModule } from "primeng/table";
import { InputTextModule } from "primeng/inputtext";
import { IconField } from "primeng/iconfield";
import { InputIcon } from "primeng/inputicon";
import { Tooltip } from "primeng/tooltip";
import { Select } from "primeng/select";

import { TournamentsService } from "../../shared/services/tournaments-service";
import { UserService } from "../../shared/services/user-service";
import { StatsHub, StatsHubTournamentHistoryEntry } from "../../core/models/Tournament";
import { getEloImagePath } from "../../core/helpers/misc";

@Component({
	selector: "app-tournament-ranking",
	standalone: true,
	imports: [
		CommonModule,
		FormsModule,
		RouterLink,
		Card,
		Tag,
		ProgressSpinner,
		TableModule,
		InputTextModule,
		IconField,
		InputIcon,
		Tooltip,
		Select,
	],
	templateUrl: "./tournament-ranking.html",
	styleUrl: "./tournament-ranking.css",
})
export class TournamentRanking implements OnInit {
	private tournaments = inject(TournamentsService);
	private userSvc = inject(UserService);

	readonly loading = signal<boolean>(true);
	readonly hub = signal<StatsHub | null>(null);
	readonly errored = signal<boolean>(false);

	readonly currentUserId = computed(() => this.userSvc.user()?.id ?? null);

	readonly overview = computed(() => this.hub()?.overview ?? null);
	readonly records = computed(() => this.hub()?.records ?? null);
	readonly clans = computed(() => this.hub()?.clans ?? []);
	readonly history = computed<StatsHubTournamentHistoryEntry[]>(
		() => this.hub()?.tournamentHistory ?? []
	);

	// Même ordre que les 11 paliers ranked (Fer → Légendaire), du meilleur au moins bon
	// pour le filtre (on regarde d'abord les hauts paliers).
	private static readonly TIER_ORDER = [
		"Légendaire",
		"Supernova",
		"Divin",
		"Rubis",
		"Émeraude",
		"Diamant",
		"Platine",
		"Or",
		"Argent",
		"Bronze",
		"Fer",
	];

	readonly searchQuery = signal<string>("");
	readonly selectedTier = signal<string | null>(null);
	readonly selectedClanId = signal<number | null>(null);

	readonly players = computed(() => this.hub()?.players ?? []);

	readonly tierOptions = computed(() => {
		const present = new Set(this.players().map((p) => p.tier));
		return TournamentRanking.TIER_ORDER.filter((t) => present.has(t)).map((t) => ({
			label: t,
			value: t,
		}));
	});

	readonly clanOptions = computed(() =>
		[...this.clans()]
			.sort((a, b) => a.name.localeCompare(b.name))
			.map((c) => ({ label: c.name, value: c.id }))
	);

	readonly entries = computed(() => {
		const q = this.searchQuery().trim().toLowerCase();
		const tier = this.selectedTier();
		const clanId = this.selectedClanId();
		return this.players().filter((e) => {
			if (q && !(e.displayName ?? "").toLowerCase().includes(q)) return false;
			if (tier && e.tier !== tier) return false;
			if (clanId && e.clan?.id !== clanId) return false;
			return true;
		});
	});

	readonly filtersActive = computed(
		() => !!this.searchQuery().trim() || !!this.selectedTier() || !!this.selectedClanId()
	);

	resetFilters(): void {
		this.searchQuery.set("");
		this.selectedTier.set(null);
		this.selectedClanId.set(null);
	}

	readonly podium = computed(() => {
		const list = this.players();
		return { first: list[0] ?? null, second: list[1] ?? null, third: list[2] ?? null };
	});

	readonly tournamentList = computed(() => this.hub()?.tournaments ?? []);
	readonly selectedTournamentId = signal<number | null>(null);
	readonly selectedTournament = computed(() => {
		const id = this.selectedTournamentId();
		const list = this.tournamentList();
		if (!list.length) return null;
		return list.find((t) => t.id === id) ?? list[0];
	});

	async ngOnInit(): Promise<void> {
		await this.userSvc.loadUserIfNeeded();
		const result = await this.tournaments.getStatsHub();
		if (!result) {
			this.errored.set(true);
		} else {
			this.hub.set(result);
			this.selectedTournamentId.set(result.tournaments[0]?.id ?? null);
		}
		this.loading.set(false);
	}

	selectTournament(id: number): void {
		this.selectedTournamentId.set(id);
	}

	isCurrentUser(userId: string): boolean {
		return userId === this.currentUserId();
	}

	/**
	 * Scroll manuel vers une section de la page. Nécessaire car `<base href="/">`
	 * (requis par PathLocationStrategy) fait résoudre un `href="#section-x"` nu contre
	 * la racine du site plutôt que l'URL courante — un clic natif atterrit donc sur `/#section-x`
	 * (page d'accueil) au lieu de scroller sur place. `href` garde une valeur absolue correcte
	 * en repli (nouvel onglet, clic milieu, etc.) ; ce handler gère le cas normal en SPA.
	 */
	scrollToSection(event: Event, id: string): void {
		event.preventDefault();
		document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
	}

	rankClass(index: number): string {
		if (index === 0) return "rank-gold";
		if (index === 1) return "rank-silver";
		if (index === 2) return "rank-bronze";
		return "";
	}

	podiumRankClass(rank: number): string {
		if (rank === 1) return "tier-gold";
		if (rank === 2) return "tier-silver";
		if (rank <= 4) return "tier-bronze";
		return "tier-plain";
	}

	/** Sentinel `GOAL_AVERAGE_PERFECT` (999, voir @rosegriffon/achillea-core/tournaments) -> "∞". */
	formatGoalAverage(value: number): string {
		if (value >= 999) return "∞";
		return value.toFixed(2);
	}

	protected readonly getEloImagePath = getEloImagePath;
}
