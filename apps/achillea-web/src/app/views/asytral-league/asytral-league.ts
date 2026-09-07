import { DecimalPipe } from "@angular/common";
import { Component, OnInit, computed, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { TableModule } from "primeng/table";
import { Skeleton } from "primeng/skeleton";
import { Accordion, AccordionContent, AccordionHeader, AccordionPanel } from "primeng/accordion";
import { Button } from "primeng/button";
import { InputText } from "primeng/inputtext";
import { Select } from "primeng/select";
import { Tooltip } from "primeng/tooltip";
import {
	LeagueApiService,
	type AstralDetailedMatch,
	type AstralGameLine,
	type AstralH2HEntry,
	type AstralPlayerStats,
	type LeagueMatchResult,
	type LeagueSeasonPayload,
	type LeagueStandingRow,
} from "../../shared/services/league-service";

type PlayerSortKey =
	| "winrate"
	| "wins"
	| "games"
	| "goalsFor"
	| "goalDiff"
	| "name"
	| "primaryTeam";

@Component({
	selector: "app-astral-league",
	imports: [
		DecimalPipe,
		FormsModule,
		TableModule,
		Skeleton,
		Accordion,
		AccordionPanel,
		AccordionHeader,
		AccordionContent,
		Button,
		InputText,
		Select,
		Tooltip,
	],
	templateUrl: "./asytral-league.html",
	styleUrl: "./asytral-league.css",
})
export class AsytralLeague implements OnInit {
	private api = inject(LeagueApiService);

	readonly logoHero = "/leagues/astral-logo-h400.webp";
	readonly logoMark = "/leagues/astral-logo-mark.png";
	readonly logoFallback = "/leagues/astral-logo-h800.png";

	loading = signal(true);
	error = signal<string | null>(null);
	season = signal<LeagueSeasonPayload | null>(null);
	activeMatchday = signal(1);
	/** Clé match ouverte (détail manches) : `reg-1-0` / `po-0` */
	expandedMatch = signal<string | null>(null);

	// ── Filtres joueurs ────────────────────────────────────────────
	playerSearch = signal("");
	playerTeamFilter = signal<string | null>(null);
	playerMinGames = signal(1);
	playerSort = signal<PlayerSortKey>("wins");
	playerSortDir = signal<"asc" | "desc">("desc");
	playerPhase = signal<"all" | "regular" | "playoff">("all");

	// ── Comparaison ────────────────────────────────────────────────
	compareA = signal<string | null>(null);
	compareB = signal<string | null>(null);

	/** Options équipe pour selects */
	teamOptions = computed(() => {
		const s = this.season();
		if (!s) return [] as { label: string; value: string }[];
		return s.teams.map((t) => ({ label: t.tag, value: t.tag }));
	});

	minGamesOptions = [
		{ label: "≥ 1 match", value: 1 },
		{ label: "≥ 3 matchs", value: 3 },
		{ label: "≥ 5 matchs", value: 5 },
	];

	phaseOptions = [
		{ label: "Toutes phases", value: "all" as const },
		{ label: "Régulière", value: "regular" as const },
		{ label: "Play-offs", value: "playoff" as const },
	];

	sortOptions: { label: string; value: PlayerSortKey }[] = [
		{ label: "Victoires", value: "wins" },
		{ label: "Winrate", value: "winrate" },
		{ label: "Matchs", value: "games" },
		{ label: "Buts marqués", value: "goalsFor" },
		{ label: "Diff. buts", value: "goalDiff" },
		{ label: "Nom", value: "name" },
		{ label: "Équipe", value: "primaryTeam" },
	];

	matchdayList = computed(() => {
		const s = this.season();
		if (!s?.details?.regularMatchdays?.length) {
			return s ? this.matchdays(s.results) : ([] as number[]);
		}
		return s.details.regularMatchdays.map((d) => d.matchday);
	});

	/** Matchs détaillés de la journée active. */
	dayDetailedMatches = computed((): AstralDetailedMatch[] => {
		const s = this.season();
		const day = this.activeMatchday();
		if (!s?.details?.regularMatchdays) return [];
		const md = s.details.regularMatchdays.find((d) => d.matchday === day);
		return md?.matches ?? [];
	});

	/** Date de la journée active. */
	activeMatchdayDate = computed(() => {
		const s = this.season();
		const day = this.activeMatchday();
		const md = s?.details?.regularMatchdays?.find((d) => d.matchday === day);
		return md?.date ?? null;
	});

	/** Leaderboard filtré / trié. */
	filteredPlayers = computed((): AstralPlayerStats[] => {
		const s = this.season();
		const players = s?.details?.players;
		if (!players?.length) return [];

		const q = this.playerSearch().trim().toLowerCase();
		const team = this.playerTeamFilter();
		const minG = this.playerMinGames();
		const phase = this.playerPhase();
		const sort = this.playerSort();
		const dir = this.playerSortDir() === "asc" ? 1 : -1;

		let list = players.filter((p) => {
			if (team && p.primaryTeam !== team && !p.teams.includes(team)) return false;
			const games =
				phase === "regular" ? p.regularGames : phase === "playoff" ? p.playoffGames : p.games;
			if (games < minG) return false;
			if (q && !p.name.toLowerCase().includes(q)) return false;
			return true;
		});

		list = [...list].sort((a, b) => {
			if (sort === "name" || sort === "primaryTeam") {
				return dir * String(a[sort]).localeCompare(String(b[sort]), "fr");
			}
			const av = Number(a[sort] ?? 0);
			const bv = Number(b[sort] ?? 0);
			if (bv !== av) return dir * (av - bv);
			return a.name.localeCompare(b.name, "fr");
		});

		return list;
	});

	/** Top buteurs (analyse). */
	topScorers = computed(() => {
		const s = this.season();
		const players = s?.details?.players ?? [];
		return [...players]
			.filter((p) => p.games >= 2 && p.goalsFor > 0)
			.sort((a, b) => b.goalsFor - a.goalsFor || b.goalDiff - a.goalDiff)
			.slice(0, 8);
	});

	/** Meilleurs winrates (min 3 matchs). */
	topWinrates = computed(() => {
		const s = this.season();
		const players = s?.details?.players ?? [];
		return [...players]
			.filter((p) => p.games >= 3)
			.sort((a, b) => b.winrate - a.winrate || b.wins - a.wins)
			.slice(0, 8);
	});

	/** Plus actifs. */
	mostActive = computed(() => {
		const s = this.season();
		const players = s?.details?.players ?? [];
		return [...players].sort((a, b) => b.games - a.games || b.wins - a.wins).slice(0, 8);
	});

	/** Matrice H2H pour affichage (lignes = équipes standings order). */
	h2hMatrix = computed(() => {
		const s = this.season();
		if (!s?.details?.h2h)
			return [] as { team: string; cells: Array<AstralH2HEntry | null | "self"> }[];
		const order = s.standings.map((r) => r.teamId);
		const h2h = s.details.h2h;
		return order.map((team) => ({
			team,
			cells: order.map((opp) => {
				if (team === opp) return "self" as const;
				return h2h[team]?.[opp] ?? null;
			}),
		}));
	});

	/** Comparaison A vs B. */
	compareView = computed(() => {
		const s = this.season();
		const a = this.compareA();
		const b = this.compareB();
		if (!s || !a || !b || a === b) return null;

		const standA = s.standings.find((r) => r.teamId === a) ?? null;
		const standB = s.standings.find((r) => r.teamId === b) ?? null;
		const h2h = s.details?.h2h?.[a]?.[b] ?? null;
		const rosterA = s.details?.rosters?.[a] ?? [];
		const rosterB = s.details?.rosters?.[b] ?? [];
		const playersA = (s.details?.players ?? []).filter(
			(p) => p.primaryTeam === a || p.teams.includes(a)
		);
		const playersB = (s.details?.players ?? []).filter(
			(p) => p.primaryTeam === b || p.teams.includes(b)
		);

		const regular = (s.details?.regularMatchdays ?? [])
			.flatMap((d) => d.matches)
			.filter((m) => (m.home === a && m.away === b) || (m.home === b && m.away === a));
		const playoff = (s.details?.playoffMatches ?? []).filter(
			(m) => (m.home === a && m.away === b) || (m.home === b && m.away === a)
		);

		return {
			a,
			b,
			standA,
			standB,
			h2h,
			rosterA,
			rosterB,
			playersA: [...playersA].sort((x, y) => y.wins - x.wins).slice(0, 6),
			playersB: [...playersB].sort((x, y) => y.wins - x.wins).slice(0, 6),
			regular,
			playoff,
		};
	});

	playerCount = computed(() => this.season()?.details?.players?.length ?? 0);

	ngOnInit() {
		this.api.astral().subscribe({
			next: (data) => {
				this.season.set(data);
				const days = data.details?.regularMatchdays?.length
					? data.details.regularMatchdays.map((d) => d.matchday)
					: this.matchdays(data.results);
				if (days.length) this.activeMatchday.set(days[0]!);
				// Comparaison par défaut : 1er vs 2e
				if (data.standings.length >= 2) {
					this.compareA.set(data.standings[0]!.teamId);
					this.compareB.set(data.standings[1]!.teamId);
				}
				this.loading.set(false);
			},
			error: (err) => {
				this.error.set(err?.message ?? "Impossible de charger Astral League");
				this.loading.set(false);
			},
		});
	}

	resultsByMatchday(results: LeagueMatchResult[]): Map<number, LeagueMatchResult[]> {
		const map = new Map<number, LeagueMatchResult[]>();
		for (const r of results) {
			const list = map.get(r.matchday) ?? [];
			list.push(r);
			map.set(r.matchday, list);
		}
		return map;
	}

	matchdays(results: LeagueMatchResult[]): number[] {
		return [...new Set(results.map((r) => r.matchday))].sort((a, b) => a - b);
	}

	dayResults(day: number): LeagueMatchResult[] {
		const s = this.season();
		if (!s) return [];
		return this.resultsByMatchday(s.results).get(day) ?? [];
	}

	scoreLabel(m: { homeScore: number; awayScore: number }): string {
		return `${m.homeScore}–${m.awayScore}`;
	}

	winnerOf(m: {
		homeId?: string;
		awayId?: string;
		home?: string;
		away?: string;
		homeScore: number;
		awayScore: number;
		winnerId?: string | null;
	}): "home" | "away" | "draw" {
		const home = m.homeId ?? m.home;
		const away = m.awayId ?? m.away;
		if (m.winnerId && m.winnerId === home) return "home";
		if (m.winnerId && m.winnerId === away) return "away";
		if (m.homeScore > m.awayScore) return "home";
		if (m.awayScore > m.homeScore) return "away";
		return "draw";
	}

	rankClass(rank: number): string {
		if (rank === 1) return "rank-1";
		if (rank === 2) return "rank-2";
		if (rank === 3) return "rank-3";
		if (rank === 4) return "rank-playoff";
		return "";
	}

	formShort(row: LeagueStandingRow): string {
		return `${row.wins + row.winsOt}V-${row.losses + row.lossesOt}D`;
	}

	scrollTo(id: string) {
		document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
	}

	onLogoError(ev: Event) {
		const img = ev.target as HTMLImageElement;
		if (img.src.includes("webp")) {
			img.src = this.logoFallback;
		}
	}

	matchKey(phase: "reg" | "po", dayOrIdx: number, idx?: number): string {
		return phase === "reg" ? `reg-${dayOrIdx}-${idx}` : `po-${dayOrIdx}`;
	}

	toggleMatch(key: string) {
		this.expandedMatch.update((cur) => (cur === key ? null : key));
	}

	isExpanded(key: string): boolean {
		return this.expandedMatch() === key;
	}

	/** Score d'une manche joueur (FF si forfait). */
	gameScore(g: AstralGameLine): string {
		if (g.forfeitHome && g.forfeitAway) return "FF–FF";
		if (g.forfeitHome) return "FF–W";
		if (g.forfeitAway) return "W–FF";
		const hg = g.homeGoals < 0 ? "–" : String(g.homeGoals);
		const ag = g.awayGoals < 0 ? "–" : String(g.awayGoals);
		return `${hg}–${ag}`;
	}

	gameWinner(g: AstralGameLine): "home" | "away" | "draw" {
		if (g.forfeitHome && !g.forfeitAway) return "away";
		if (g.forfeitAway && !g.forfeitHome) return "home";
		if (g.forfeitHome && g.forfeitAway) return "draw";
		if (g.homeGoals < 0 || g.awayGoals < 0) return "draw";
		if (g.homeGoals > g.awayGoals) return "home";
		if (g.awayGoals > g.homeGoals) return "away";
		return "draw";
	}

	formatDate(iso: string | null | undefined): string {
		if (!iso) return "";
		try {
			return new Date(iso + (iso.length === 10 ? "T12:00:00" : "")).toLocaleDateString("fr-FR", {
				day: "numeric",
				month: "short",
				year: "numeric",
			});
		} catch {
			return iso;
		}
	}

	h2hCellClass(cell: AstralH2HEntry | null | "self"): string {
		if (cell === "self") return "h2h-self";
		if (!cell) return "h2h-empty";
		if (cell.scoreFor > cell.scoreAgainst) return "h2h-win";
		if (cell.scoreFor < cell.scoreAgainst) return "h2h-loss";
		return "h2h-draw";
	}

	h2hLabel(cell: AstralH2HEntry | null | "self"): string {
		if (cell === "self") return "—";
		if (!cell) return "·";
		return `${cell.scoreFor}–${cell.scoreAgainst}`;
	}

	toggleSortDir() {
		this.playerSortDir.update((d) => (d === "asc" ? "desc" : "asc"));
	}

	standingMetric(row: LeagueStandingRow | null, key: keyof LeagueStandingRow): string {
		if (!row) return "–";
		const v = row[key];
		if (typeof v === "number" && key === "mapDiff") {
			return v > 0 ? `+${v}` : String(v);
		}
		return String(v ?? "–");
	}

	compareWinner(
		a: LeagueStandingRow | null,
		b: LeagueStandingRow | null,
		key: keyof LeagueStandingRow,
		higherBetter = true
	): "a" | "b" | "eq" {
		if (!a || !b) return "eq";
		const av = Number(a[key]);
		const bv = Number(b[key]);
		if (av === bv) return "eq";
		if (higherBetter) return av > bv ? "a" : "b";
		return av < bv ? "a" : "b";
	}

	/** Fallback : matchs simples si details absents. */
	hasDetails(): boolean {
		return Boolean(this.season()?.details?.players?.length);
	}
}
