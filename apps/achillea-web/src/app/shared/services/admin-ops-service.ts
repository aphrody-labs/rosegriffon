import { Injectable, inject, signal } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { firstValueFrom } from "rxjs";
import { MessageService } from "primeng/api";

export interface AdminOpsOverview {
	users: { total: number; staff: number };
	wallet: { wallets: number; totalBalance: number; txToday: number };
	moderation: { sanctionsActive: number; licensesActive: number };
	community: {
		tournamentsOngoing: number;
		clansPending: number;
		orgsPending: number;
		castEventsOpen: number;
	};
	ranked: {
		activeMatches: number;
		contestedMatches: number;
		finishedToday: number;
		matchesToday: number;
		totalPlayers: number;
	};
	audit24h: number;
	bot: {
		online: boolean;
		uptime: number;
		maintenance: boolean;
		guilds: number;
	};
	generatedAt: string;
}

export interface AdminUserRow {
	id: string;
	username: string | null;
	displayName: string | null;
	avatar: string | null;
	role: number;
	lastInteract: string;
}

@Injectable({ providedIn: "root" })
export class AdminOpsService {
	private http = inject(HttpClient);
	private msg = inject(MessageService);
	private readonly API = "/api/admin/ops";

	readonly overview = signal<AdminOpsOverview | null>(null);

	async loadOverview(): Promise<AdminOpsOverview | null> {
		try {
			const o = await firstValueFrom(
				this.http.get<AdminOpsOverview>(`${this.API}/overview`, { withCredentials: true })
			);
			this.overview.set(o);
			return o;
		} catch {
			this.overview.set(null);
			return null;
		}
	}

	async listUsers(page = 1, pagination = 25, q = "") {
		const params: Record<string, string> = {
			page: String(page),
			pagination: String(pagination),
		};
		if (q.trim()) params["q"] = q.trim();
		return firstValueFrom(
			this.http.get<{
				data: AdminUserRow[];
				meta: { page: number; limit: number; total: number; pageCount: number };
			}>(`${this.API}/users`, { params, withCredentials: true })
		);
	}

	async setUserRole(id: string, role: number) {
		try {
			await firstValueFrom(
				this.http.post(`${this.API}/users/${id}/role`, { role }, { withCredentials: true })
			);
			this.msg.add({ severity: "success", summary: "Rôle mis à jour", life: 4000 });
			return true;
		} catch (e: any) {
			this.msg.add({
				severity: "error",
				summary: "Rôle",
				detail: e?.error?.message ?? "Échec",
				life: 6000,
			});
			return false;
		}
	}

	async loadWallets(limit = 40) {
		return firstValueFrom(
			this.http.get<{
				top: Array<{
					userId: string;
					displayName: string;
					balance: number;
					currency: string;
				}>;
				recent: Array<{
					id: string;
					type: string;
					amount: number;
					reason: string | null;
					fromUserId: string | null;
					toUserId: string | null;
					createdAt: string;
				}>;
			}>(`${this.API}/wallets`, { params: { limit: String(limit) }, withCredentials: true })
		);
	}

	async adjustWallet(userId: string, amount: number, reason: string) {
		try {
			const r = await firstValueFrom(
				this.http.post<{ success: boolean; balance: number }>(
					`${this.API}/wallets/${userId}/adjust`,
					{ amount, reason },
					{ withCredentials: true }
				)
			);
			this.msg.add({
				severity: "success",
				summary: "Portefeuille",
				detail: `Nouveau solde : ${r.balance}`,
				life: 5000,
			});
			return true;
		} catch (e: any) {
			this.msg.add({
				severity: "error",
				summary: "Portefeuille",
				detail: e?.error?.message ?? "Échec ajustement",
				life: 6000,
			});
			return false;
		}
	}

	async loadHealth() {
		return firstValueFrom(
			this.http.get<{
				bot: {
					online: boolean;
					uptime: number;
					username: string | null;
					guilds: number;
					maintenance: boolean;
				};
				host: unknown;
				pid: unknown;
				latency: unknown;
			}>(`${this.API}/health`, { withCredentials: true })
		);
	}

	async loadMetricsSummary() {
		return firstValueFrom(
			this.http.get<{ counters: Record<string, number>; rawLines: number }>(
				`${this.API}/metrics-summary`,
				{ withCredentials: true }
			)
		);
	}

	async setMaintenance(maintenance: boolean) {
		try {
			await firstValueFrom(
				this.http.post(`${this.API}/maintenance`, { maintenance }, { withCredentials: true })
			);
			this.msg.add({
				severity: "success",
				summary: "Maintenance",
				detail: maintenance ? "Activée" : "Désactivée",
				life: 4000,
			});
			return true;
		} catch (e: any) {
			this.msg.add({
				severity: "error",
				summary: "Maintenance",
				detail: e?.error?.message ?? "Échec",
				life: 6000,
			});
			return false;
		}
	}

	async loadAudit(limit = 50) {
		return firstValueFrom(
			this.http.get<{
				data: Array<{
					id: string;
					ts: string;
					actorId: string | null;
					action: string;
					targetType: string;
					targetId: string | null;
					reason: string | null;
				}>;
			}>(`${this.API}/audit`, { params: { limit: String(limit) }, withCredentials: true })
		);
	}

	async loadCasts(page = 1, pageSize = 25) {
		return firstValueFrom(
			this.http.get<{
				data: unknown[];
				total: number;
				meta: { page: number; pageSize: number; pageCount: number };
			}>("/api/casts/events", {
				params: { page: String(page), pageSize: String(pageSize) },
				withCredentials: true,
			})
		);
	}

	async loadLeagues() {
		return firstValueFrom(
			this.http.get<{ items: unknown[] }>("/api/leagues", { withCredentials: true })
		);
	}

	async loadAstral() {
		return firstValueFrom(
			this.http.get<Record<string, unknown>>("/api/leagues/astral", { withCredentials: true })
		);
	}

	async loadGuilds() {
		return firstValueFrom(
			this.http.get<{
				data: Array<{
					id: string;
					name: string;
					iconURL: string | null;
					memberCount: number;
					ownerId: string;
					createdAt: string | null;
				}>;
			}>(`${this.API}/guilds`, { withCredentials: true })
		);
	}

	async createGuildInvite(id: string): Promise<string | null> {
		try {
			const r = await firstValueFrom(
				this.http.get<{ url: string }>(`${this.API}/guilds/${id}/invite`, {
					withCredentials: true,
				})
			);
			return r.url;
		} catch (e: any) {
			this.msg.add({
				severity: "error",
				summary: "Invitation",
				detail: e?.error?.message ?? "Impossible de générer une invitation.",
				life: 6000,
			});
			return null;
		}
	}

	async loadCommands() {
		return firstValueFrom(
			this.http.get<{ data: Array<{ name: string; description?: string; type: number }> }>(
				`${this.API}/commands`,
				{ withCredentials: true }
			)
		);
	}

	async loadLogs() {
		return firstValueFrom(
			this.http.get<{ data: string[] }>(`${this.API}/logs`, { withCredentials: true })
		);
	}

	// ── Base de données (Supabase direct, UI générique) ──────────────────────
	private readonly DB_API = "/api/admin/db";

	async dbListTables() {
		return firstValueFrom(
			this.http.get<{ data: Array<{ name: string; estimatedRows: number; protected: boolean }> }>(
				`${this.DB_API}/tables`,
				{ withCredentials: true }
			)
		);
	}

	async dbColumns(table: string) {
		return firstValueFrom(
			this.http.get<{ data: DbColumn[] }>(`${this.DB_API}/tables/${table}/columns`, {
				withCredentials: true,
			})
		);
	}

	async dbRows(table: string, page = 1, limit = 25, sort?: string, order?: "asc" | "desc") {
		const params: Record<string, string> = { page: String(page), limit: String(limit) };
		if (sort) params["sort"] = sort;
		if (order) params["order"] = order;
		return firstValueFrom(
			this.http.get<{
				data: Array<Record<string, unknown>>;
				columns: DbColumn[];
				meta: { page: number; limit: number; total: number; pageCount: number };
			}>(`${this.DB_API}/tables/${table}/rows`, { params, withCredentials: true })
		);
	}

	async dbInsertRow(table: string, values: Record<string, unknown>) {
		try {
			const res = await firstValueFrom(
				this.http.post<{ success: boolean; row: Record<string, unknown> }>(
					`${this.DB_API}/tables/${table}/rows`,
					{ values },
					{ withCredentials: true }
				)
			);
			this.msg.add({ severity: "success", summary: "Ligne insérée", life: 4000 });
			return res;
		} catch (e: any) {
			this.msg.add({
				severity: "error",
				summary: "Insertion",
				detail: e?.error?.message ?? "Échec de l'insertion.",
				life: 8000,
			});
			return null;
		}
	}

	async dbUpdateRow(table: string, pk: Record<string, unknown>, values: Record<string, unknown>) {
		try {
			const res = await firstValueFrom(
				this.http.patch<{ success: boolean; row: Record<string, unknown> }>(
					`${this.DB_API}/tables/${table}/rows`,
					{ pk, values },
					{ withCredentials: true }
				)
			);
			this.msg.add({ severity: "success", summary: "Ligne mise à jour", life: 4000 });
			return res;
		} catch (e: any) {
			this.msg.add({
				severity: "error",
				summary: "Mise à jour",
				detail: e?.error?.message ?? "Échec de la mise à jour.",
				life: 8000,
			});
			return null;
		}
	}

	async dbDeleteRow(table: string, pk: Record<string, unknown>): Promise<boolean> {
		try {
			await firstValueFrom(
				this.http.delete(`${this.DB_API}/tables/${table}/rows`, {
					body: { pk },
					withCredentials: true,
				})
			);
			this.msg.add({ severity: "success", summary: "Ligne supprimée", life: 4000 });
			return true;
		} catch (e: any) {
			this.msg.add({
				severity: "error",
				summary: "Suppression",
				detail: e?.error?.message ?? "Échec de la suppression.",
				life: 8000,
			});
			return false;
		}
	}

	async dbQuery(sql: string) {
		try {
			return await firstValueFrom(
				this.http.post<{
					data: Array<Record<string, unknown>>;
					rowCount: number;
					durationMs: number;
				}>(`${this.DB_API}/query`, { sql }, { withCredentials: true })
			);
		} catch (e: any) {
			this.msg.add({
				severity: "error",
				summary: "Requête SQL",
				detail: e?.error?.message ?? "Échec de la requête.",
				life: 8000,
			});
			return null;
		}
	}
}

export interface DbColumn {
	name: string;
	dataType: string;
	nullable: boolean;
	default: string | null;
	isPrimaryKey: boolean;
}
