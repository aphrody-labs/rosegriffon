import { Component, OnInit, computed, signal, inject, viewChild } from "@angular/core";
import { firstValueFrom } from "rxjs";
import { HttpClient } from "@angular/common/http";
import { RouterLink } from "@angular/router";
import { Button } from "primeng/button";
import { Tag } from "primeng/tag";
import { Drawer } from "primeng/drawer";
import { Dialog } from "primeng/dialog";
import { UserService } from "../../shared/services/user-service";
import { OrganizationService } from "../../shared/services/organization-service";
import { RankedService } from "../../shared/services/ranked-service";
import { TournamentsService } from "../../shared/services/tournaments-service";
import { OrganizationTable } from "../../shared/components/organization-table/organization-table";
import { Mode } from "../../core/models/Forms";
import { TournamentCreationForm } from "../../shared/components/tournament-creation-form/tournament-creation-form.component";
import { TournamentTable } from "../../shared/components/tournament-table/tournament-table";
import { SanctionsTabComponent } from "./sanctions-tab/sanctions-tab";
import { PlayerNotesPanel } from "../../shared/components/player-notes-panel/player-notes-panel";
import { RankedDisputesTabComponent } from "./ranked-disputes-tab/ranked-disputes-tab";
import { RankedActiveTabComponent } from "./ranked-active-tab/ranked-active-tab";
import { RankedTelemetryTabComponent } from "./ranked-telemetry-tab/ranked-telemetry-tab";
import { RankedSeasonsTabComponent } from "./ranked-seasons-tab/ranked-seasons-tab";
import { ClansTabComponent } from "./clans-tab/clans-tab";
import { LicensesTabComponent } from "./licenses-tab/licenses-tab";
import { AdminOverviewTabComponent, type AdminNavTarget } from "./overview-tab/overview-tab";
import { AdminUsersTabComponent } from "./users-tab/users-tab";
import { AdminWalletsTabComponent } from "./wallets-tab/wallets-tab";
import { AdminCastsTabComponent } from "./casts-tab/casts-tab";
import { AdminBotHealthTabComponent } from "./bot-health-tab/bot-health-tab";
import { AdminGuildsTabComponent } from "./guilds-tab/guilds-tab";
import { AdminDatabaseTabComponent } from "./database-tab/database-tab";
import { AdminLeaguesTabComponent } from "./leagues-tab/leagues-tab";
import { AdminAuditTabComponent } from "./audit-tab/audit-tab";
import { TournamentState } from "../../core/models/Tournament";

export interface AdminNavItem {
	id: string;
	label: string;
	icon: string;
	description: string;
	superAdmin?: boolean;
	badge?: () => number;
}

export interface AdminNavGroup {
	title: string;
	items: AdminNavItem[];
}

@Component({
	selector: "app-admin-dashboard",
	imports: [
		RouterLink,
		Button,
		Tag,
		Drawer,
		Dialog,
		OrganizationTable,
		TournamentCreationForm,
		TournamentTable,
		SanctionsTabComponent,
		PlayerNotesPanel,
		RankedDisputesTabComponent,
		RankedActiveTabComponent,
		RankedTelemetryTabComponent,
		RankedSeasonsTabComponent,
		ClansTabComponent,
		LicensesTabComponent,
		AdminOverviewTabComponent,
		AdminUsersTabComponent,
		AdminWalletsTabComponent,
		AdminCastsTabComponent,
		AdminBotHealthTabComponent,
		AdminGuildsTabComponent,
		AdminDatabaseTabComponent,
		AdminLeaguesTabComponent,
		AdminAuditTabComponent,
	],
	templateUrl: "./admin-dashboard.html",
	styleUrl: "./admin-dashboard.css",
})
export class AdminDashboard implements OnInit {
	protected userService = inject(UserService);
	protected orgService = inject(OrganizationService);
	protected ranked = inject(RankedService);
	private http = inject(HttpClient);
	private tournaments = inject(TournamentsService);

	protected readonly Mode = Mode;
	protected showTournamentDialog = signal(false);
	protected mobileNavOpen = signal(false);
	private tournamentTable = viewChild(TournamentTable);

	activeId = signal<string>("overview");
	readonly pendingClansCount = signal(0);

	readonly roleLabel = computed(() => {
		const r = this.userService.user()?.role ?? 0;
		return r >= 3 ? "Super-Admin" : r >= 2 ? "Admin" : r >= 1 ? "Modérateur" : "Membre";
	});

	private readonly groups: AdminNavGroup[] = [
		{
			title: "Ops",
			items: [
				{
					id: "overview",
					label: "Vue d'ensemble",
					icon: "pi pi-th-large",
					description: "Alertes et KPI multi-domaines (ranked, bot, économie…)",
				},
				{
					id: "bot-health",
					label: "Bot & santé",
					icon: "pi pi-server",
					description: "Uptime, guildes, maintenance, host",
					superAdmin: true,
				},
				{
					id: "guilds",
					label: "Serveurs Discord",
					icon: "pi pi-discord",
					description: "Serveurs où le bot est présent, invitations, commandes",
					superAdmin: true,
				},
				{
					id: "database",
					label: "Base de données",
					icon: "pi pi-database",
					description: "Accès direct Supabase — tables, lignes, console SQL",
					superAdmin: true,
				},
				{
					id: "audit",
					label: "Audit",
					icon: "pi pi-history",
					description: "Journal d'actions chaîné",
					superAdmin: true,
				},
			],
		},
		{
			title: "Communauté",
			items: [
				{
					id: "users",
					label: "Utilisateurs",
					icon: "pi pi-users",
					description: "Recherche joueurs, rôles staff",
				},
				{
					id: "clans",
					label: "Nouveaux clans",
					icon: "pi pi-folder-plus",
					description: "Demandes de clan en attente",
					badge: () => this.pendingClansCount(),
				},
				{
					id: "orgs",
					label: "Organisations",
					icon: "pi pi-building",
					description: "Validation des organisations",
					superAdmin: true,
					badge: () => this.orgService.dashboardPendingOrganizations().length,
				},
				{
					id: "tournaments",
					label: "Tournois",
					icon: "pi pi-trophy",
					description: "Cycle de vie, bracket, podium AP",
					superAdmin: true,
				},
				{
					id: "leagues",
					label: "Ligues",
					icon: "pi pi-star",
					description: "Astral League et championnats",
				},
				{
					id: "casts",
					label: "Casts",
					icon: "pi pi-video",
					description: "Événements cast & planning",
				},
			],
		},
		{
			title: "Ranked",
			items: [
				{
					id: "matches",
					label: "Matchs en cours",
					icon: "pi pi-bolt",
					description: "Lobbies live",
				},
				{
					id: "disputes",
					label: "Litiges",
					icon: "pi pi-gavel",
					description: "Arbitrage scores contestés",
					badge: () => this.ranked.disputes().length,
				},
				{
					id: "seasons",
					label: "Saisons",
					icon: "pi pi-calendar",
					description: "K-factor, activation, reset",
				},
				{
					id: "telemetry",
					label: "Télémétrie",
					icon: "pi pi-chart-line",
					description: "Journal ranked_match_event",
				},
			],
		},
		{
			title: "Économie & modération",
			items: [
				{
					id: "wallets",
					label: "Portefeuilles",
					icon: "pi pi-wallet",
					description: "Soldes ACH, crédit / débit staff",
					superAdmin: true,
				},
				{
					id: "sanctions",
					label: "Sanctions",
					icon: "pi pi-ban",
					description: "Sanctions membres",
					superAdmin: true,
				},
				{
					id: "player-notes",
					label: "Signalements joueurs",
					icon: "pi pi-flag",
					description: "Notes du staff sur les joueurs",
				},
				{
					id: "licenses",
					label: "Licences",
					icon: "pi pi-id-card",
					description: "Émission et révocation",
				},
			],
		},
	];

	readonly visibleGroups = computed<AdminNavGroup[]>(() => {
		const isSuper = this.userService.userIsSuperAdmin();
		const isAdmin = this.userService.userIsAdmin();
		return this.groups
			.map((g) => ({
				title: g.title,
				items: g.items.filter((t) => {
					// superAdmin flag → SuperAdministrator only
					if (t.superAdmin) return isSuper;
					// domaines ops sensibles déjà flaggés ; org/tournois/sanctions admin+
					if (["orgs", "tournaments", "sanctions"].includes(t.id)) return isAdmin;
					return true;
				}),
			}))
			.filter((g) => g.items.length > 0);
	});

	readonly activeItem = computed(() => {
		const id = this.activeId();
		for (const g of this.visibleGroups()) {
			const found = g.items.find((i) => i.id === id);
			if (found) return found;
		}
		return this.visibleGroups()[0]?.items[0] ?? null;
	});

	async ngOnInit(): Promise<void> {
		void this.ranked.loadAdminDisputes();
		void this.ranked.loadOverview();
		void this.orgService.getAndSetDashboardOrganizations();
		void this.loadPendingClansCount();
	}

	private async loadPendingClansCount(): Promise<void> {
		try {
			const res = await firstValueFrom(
				this.http.get<{ meta?: { total?: number }; data?: unknown[] }>("/api/clans", {
					params: { state: "1", page: "1", pagination: "50" },
					withCredentials: true,
				})
			);
			this.pendingClansCount.set(res?.meta?.total ?? res?.data?.length ?? 0);
		} catch {
			this.pendingClansCount.set(0);
		}
	}

	badgeText(item: AdminNavItem): string | undefined {
		const n = item.badge?.() ?? 0;
		return n > 0 ? String(n) : undefined;
	}

	select(id: string): void {
		this.activeId.set(id);
		this.mobileNavOpen.set(false);
	}

	onOverviewNavigate(target: AdminNavTarget): void {
		this.select(target);
	}

	openCreateTournament(): void {
		this.showTournamentDialog.set(true);
	}

	onCreateTournamentClosed(): void {
		this.showTournamentDialog.set(false);
	}

	async onTournamentCreated(): Promise<void> {
		this.showTournamentDialog.set(false);
		await this.refreshTournaments();
	}

	async refreshTournaments(): Promise<void> {
		const orgId = this.userService.userIsSuperAdmin() ? 1 : undefined;
		const states = orgId ? Object.values(TournamentState) : undefined;
		await this.tournaments.getAndSetDashboardTournaments(1, 50, orgId, states);
		const table = this.tournamentTable();
		if (table && "reload" in table) await (table as TournamentTable).reload();
	}
}
