import {
	Component,
	OnDestroy,
	OnInit,
	computed,
	inject,
	input,
	output,
	signal,
} from "@angular/core";
import { DatePipe, DecimalPipe } from "@angular/common";
import { Button } from "primeng/button";
import { Tag } from "primeng/tag";
import { TableModule } from "primeng/table";

import { RankedService } from "../../../shared/services/ranked-service";
import { TournamentsService } from "../../../shared/services/tournaments-service";
import { OrganizationService } from "../../../shared/services/organization-service";
import { UserService } from "../../../shared/services/user-service";
import { AdminOpsService, type AdminOpsOverview } from "../../../shared/services/admin-ops-service";
import { Tournament, TournamentState, stageTypeToString } from "../../../core/models/Tournament";
import {
	PLACEMENT_PRIZE_TIERS,
	formatPrizeSummary,
	isPlacementPrizeEligible,
} from "../../../core/helpers/tournament-placement-prizes";

/** Cible de navigation (ids stables du shell). */
export type AdminNavTarget =
	| "disputes"
	| "matches"
	| "tournaments"
	| "clans"
	| "orgs"
	| "seasons"
	| "telemetry"
	| "sanctions"
	| "licenses"
	| "users"
	| "wallets"
	| "casts"
	| "bot-health"
	| "leagues"
	| "audit";

@Component({
	selector: "app-admin-overview-tab",
	standalone: true,
	imports: [DatePipe, DecimalPipe, Button, Tag, TableModule],
	templateUrl: "./overview-tab.html",
	styleUrl: "./overview-tab.css",
})
export class AdminOverviewTabComponent implements OnInit, OnDestroy {
	private ranked = inject(RankedService);
	private tournaments = inject(TournamentsService);
	private orgs = inject(OrganizationService);
	private users = inject(UserService);
	private ops = inject(AdminOpsService);

	pendingClans = input(0);
	navigate = output<AdminNavTarget>();

	readonly loading = signal(false);
	readonly lastRefresh = signal<Date | null>(null);
	readonly opsOverview = this.ops.overview;
	readonly prizeTiers = PLACEMENT_PRIZE_TIERS;

	private timer: ReturnType<typeof setInterval> | null = null;

	readonly pendingOrgs = computed(() => this.orgs.dashboardPendingOrganizations().length);
	readonly tournamentsList = computed(() => this.tournaments.dashboardTournaments());

	readonly ongoingTournaments = computed(() =>
		this.tournamentsList().filter((t) => t.internalState === TournamentState.ONGOING)
	);

	readonly finishedNeedingPrize = computed(() =>
		this.tournamentsList().filter(
			(t) =>
				t.internalState === TournamentState.FINISHED &&
				isPlacementPrizeEligible(t.tournamentType) &&
				!t.placementEloApplied
		)
	);

	readonly alertItems = computed(() => {
		const o = this.opsOverview();
		const items: Array<{
			id: AdminNavTarget;
			icon: string;
			title: string;
			detail: string;
			warn?: boolean;
		}> = [];
		const contested = o?.ranked.contestedMatches ?? this.ranked.disputes().length;
		if (contested > 0) {
			items.push({
				id: "disputes",
				icon: "pi pi-gavel",
				title: "Litiges ranked",
				detail: `${contested} match(s) contesté(s)`,
				warn: true,
			});
		}
		if (this.finishedNeedingPrize().length > 0) {
			items.push({
				id: "tournaments",
				icon: "pi pi-star",
				title: "Bonus podium",
				detail: `${this.finishedNeedingPrize().length} tournoi(s) à verser`,
				warn: true,
			});
		}
		if ((o?.community.clansPending ?? this.pendingClans()) > 0) {
			items.push({
				id: "clans",
				icon: "pi pi-folder-plus",
				title: "Clans en attente",
				detail: `${o?.community.clansPending ?? this.pendingClans()} demande(s)`,
			});
		}
		if ((o?.community.orgsPending ?? this.pendingOrgs()) > 0) {
			items.push({
				id: "orgs",
				icon: "pi pi-building",
				title: "Organisations",
				detail: `${o?.community.orgsPending ?? this.pendingOrgs()} à valider`,
			});
		}
		if ((o?.community.castEventsOpen ?? 0) > 0) {
			items.push({
				id: "casts",
				icon: "pi pi-video",
				title: "Casts ouverts",
				detail: `${o!.community.castEventsOpen} événement(s)`,
			});
		}
		if (o?.bot.maintenance) {
			items.push({
				id: "bot-health",
				icon: "pi pi-power-off",
				title: "Maintenance bot",
				detail: "Mode maintenance actif",
				warn: true,
			});
		}
		if (o && !o.bot.online) {
			items.push({
				id: "bot-health",
				icon: "pi pi-exclamation-triangle",
				title: "Bot offline",
				detail: "Présence Discord absente",
				warn: true,
			});
		}
		return items;
	});

	readonly alertCount = computed(() => this.alertItems().length);

	/** Tuiles interactives multi-domaines. */
	domainTiles(o: AdminOpsOverview) {
		return [
			{
				id: "matches" as AdminNavTarget,
				label: "Matchs ranked",
				value: String(o.ranked.activeMatches),
				sub: `${o.ranked.contestedMatches} litige(s)`,
				warn: o.ranked.contestedMatches > 0,
			},
			{
				id: "users" as AdminNavTarget,
				label: "Utilisateurs",
				value: String(o.users.total),
				sub: `${o.users.staff} staff`,
			},
			{
				id: "wallets" as AdminNavTarget,
				label: "Économie ACH",
				value: o.wallet.totalBalance.toFixed(0),
				sub: `${o.wallet.txToday} tx aujourd'hui`,
			},
			{
				id: "tournaments" as AdminNavTarget,
				label: "Tournois live",
				value: String(o.community.tournamentsOngoing),
				sub: `${this.finishedNeedingPrize().length} podium(s)`,
			},
			{
				id: "casts" as AdminNavTarget,
				label: "Casts",
				value: String(o.community.castEventsOpen),
				sub: "événements ouverts",
			},
			{
				id: "sanctions" as AdminNavTarget,
				label: "Sanctions actives",
				value: String(o.moderation.sanctionsActive),
				sub: `${o.moderation.licensesActive} licences`,
			},
			{
				id: "bot-health" as AdminNavTarget,
				label: "Bot Discord",
				value: o.bot.online ? "ON" : "OFF",
				sub: `${o.bot.guilds} guildes`,
				warn: !o.bot.online || o.bot.maintenance,
			},
			{
				id: "audit" as AdminNavTarget,
				label: "Audit 24h",
				value: String(o.audit24h),
				sub: "événements journalisés",
			},
		];
	}

	async ngOnInit(): Promise<void> {
		await this.refresh();
		this.timer = setInterval(() => void this.refresh(), 30000);
	}

	ngOnDestroy(): void {
		if (this.timer) clearInterval(this.timer);
	}

	async refresh(): Promise<void> {
		this.loading.set(true);
		try {
			const jobs: Promise<unknown>[] = [
				this.ops.loadOverview(),
				this.ranked.loadAdminDisputes(),
				this.ranked.loadActiveMatches(),
			];
			if (this.users.userIsSuperAdmin()) {
				jobs.push(
					this.tournaments.getAndSetDashboardTournaments(1, 50, 1, Object.values(TournamentState))
				);
			}
			await Promise.all(jobs);
			this.lastRefresh.set(new Date());
		} finally {
			this.loading.set(false);
		}
	}

	go(id: AdminNavTarget): void {
		this.navigate.emit(id);
	}

	prizeSummary(t: Tournament): string {
		return formatPrizeSummary(t.participantsNumber ?? 0);
	}

	typeLabel(t: Tournament): string {
		return stageTypeToString(t.tournamentType);
	}

	async applyPrize(t: Tournament): Promise<void> {
		await this.tournaments.applyPlacementPrizes(t.id);
		await this.refresh();
	}
}
