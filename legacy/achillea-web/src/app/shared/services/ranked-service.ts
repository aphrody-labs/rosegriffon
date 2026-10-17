import { Injectable, signal, inject } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { firstValueFrom } from "rxjs";
import { MessageService } from "primeng/api";

import {
	LeaderboardPage,
	MatchMode,
	RankedActiveMatch,
	RankedAdminDispute,
	RankedAdminValidateRequest,
	RankedHistoryEntry,
	RankedMatchEvent,
	RankedMatchSummary,
	RankedAdminSeason,
	RankedOverview,
	RankedProfile,
	RankedSeasonInput,
	RankedTierInfo,
	RankedTrend,
} from "../../core/models/Ranked";

// Ligne brute renvoyée par les endpoints /api/admin/seasons (snake_case SQL).
interface SeasonRowRaw {
	id: string;
	name: string;
	state: RankedAdminSeason["state"];
	starts_at: string;
	ends_at: string;
	config: RankedAdminSeason["config"] | null;
	player_count: number;
}

function mapSeasonRow(r: SeasonRowRaw): RankedAdminSeason {
	return {
		id: r.id,
		name: r.name,
		state: r.state,
		startsAt: r.starts_at,
		endsAt: r.ends_at,
		config: r.config ?? { kFactor: 32, baseRating: 0, decayRate: 0 },
		playerCount: r.player_count ?? 0,
	};
}

@Injectable({ providedIn: "root" })
export class RankedService {
	private http = inject(HttpClient);
	private msg = inject(MessageService);

	private readonly API = "/api/ranked";

	readonly profile = signal<RankedProfile | null>(null);
	readonly lastSummary = signal<RankedMatchSummary | null>(null);
	readonly disputes = signal<RankedAdminDispute[]>([]);
	readonly activeMatches = signal<RankedActiveMatch[]>([]);
	readonly overview = signal<RankedOverview | null>(null);
	readonly telemetry = signal<RankedMatchEvent[]>([]);
	readonly tiers = signal<RankedTierInfo[]>([]);
	readonly leaderboard = signal<LeaderboardPage | null>(null);
	readonly history = signal<RankedHistoryEntry[]>([]);
	readonly historyHasMore = signal<boolean>(false);
	readonly trend = signal<RankedTrend | null>(null);
	readonly seasons = signal<RankedAdminSeason[]>([]);

	async loadProfile(mode: MatchMode = MatchMode.ONE_VS_ONE): Promise<RankedProfile | null> {
		try {
			const resp = await firstValueFrom(
				this.http.get<RankedProfile>(`${this.API}/me`, {
					params: { mode: mode.toString() },
					withCredentials: true,
				})
			);
			this.profile.set(resp);
			return resp;
		} catch {
			this.profile.set(null);
			return null;
		}
	}

	/**
	 * Upload d'une preuve de score (capture). Utilisé aussi bien à la saisie normale
	 * (les 2 joueurs peuvent fournir une preuve) qu'en litige. Le lobby doit déjà exister
	 * (créé dès le 1er « Fin de match » côté serveur).
	 */
	async uploadProof(lobbyId: number, file: File): Promise<string | null> {
		// Envoi en BASE64 (text/plain), PAS en binaire/multipart : bun-serve-express
		// reconstruit le corps via Buffer.from(req.text(), "utf8") → corrompt tout octet
		// non-UTF8, et multer casse (« Request closed »). Le back lit via express.text,
		// decode le base64 et valide le type par magic bytes.
		try {
			const dataUrl = await new Promise<string>((resolve, reject) => {
				const reader = new FileReader();
				reader.onload = () => resolve(reader.result as string);
				reader.onerror = () => reject(reader.error);
				reader.readAsDataURL(file);
			});
			const resp = await firstValueFrom(
				this.http.post<{ url: string }>(`${this.API}/${lobbyId}/dispute`, dataUrl, {
					headers: { "Content-Type": "text/plain" },
					withCredentials: true,
				})
			);
			return resp.url;
		} catch {
			this.msg.add({
				severity: "error",
				summary: "Upload échoué",
				detail: "Impossible d'envoyer la capture",
			});
			return null;
		}
	}

	async loadAdminDisputes(): Promise<RankedAdminDispute[]> {
		try {
			const resp = await firstValueFrom(
				this.http.get<RankedAdminDispute[]>("/api/admin/lobbies/disputes", {
					withCredentials: true,
				})
			);
			this.disputes.set(resp);
			return resp;
		} catch {
			this.disputes.set([]);
			return [];
		}
	}

	// Matchs EN COURS (lobby 'Ongoing') avec leur état live persisté. Modérateur+.
	async loadActiveMatches(): Promise<RankedActiveMatch[]> {
		try {
			const resp = await firstValueFrom(
				this.http.get<RankedActiveMatch[]>("/api/admin/lobbies/active", {
					withCredentials: true,
				})
			);
			this.activeMatches.set(resp);
			return resp;
		} catch {
			this.activeMatches.set([]);
			return [];
		}
	}

	// Compteurs synthétiques du ranked (overview admin). Modérateur+.
	async loadOverview(): Promise<RankedOverview | null> {
		try {
			const resp = await firstValueFrom(
				this.http.get<RankedOverview>("/api/admin/ranked/overview", {
					withCredentials: true,
				})
			);
			this.overview.set(resp);
			return resp;
		} catch {
			this.overview.set(null);
			return null;
		}
	}

	// Paliers + nb de joueurs par palier (saison active) — endpoint LIVE du sous-process
	// ranked. On n'interroge plus la vue Supabase `tier_view` (qui filtrait `season_id IS
	// NULL` → comptes faux depuis « Saison 1 »).
	async loadTiers(mode: MatchMode = MatchMode.ONE_VS_ONE): Promise<RankedTierInfo[]> {
		try {
			const resp = await firstValueFrom(
				this.http.get<RankedTierInfo[]>(`${this.API}/tiers`, {
					params: { mode: mode.toString() },
					withCredentials: true,
				})
			);
			this.tiers.set(resp);
			return resp;
		} catch {
			this.tiers.set([]);
			return [];
		}
	}

	async loadTrend(
		mode: MatchMode = MatchMode.ONE_VS_ONE,
		days: number = 7,
		last: number = 20
	): Promise<RankedTrend | null> {
		try {
			const resp = await firstValueFrom(
				this.http.get<RankedTrend>(`/api/users/me/ranked-trend`, {
					params: {
						mode: mode.toString(),
						days: days.toString(),
						last: last.toString(),
					},
					withCredentials: true,
				})
			);
			this.trend.set(resp);
			return resp;
		} catch {
			this.trend.set(null);
			return null;
		}
	}

	// Classement de la saison active — endpoint LIVE du sous-process ranked (DENSE_RANK par
	// mode, tri Elo desc, enrichissement user). On n'interroge plus la vue Supabase
	// `leaderboard_view` (qui filtrait `season_id IS NULL` → vide depuis « Saison 1 »).
	// `seasonId` conservé pour compat d'API (la saison courante fait foi côté serveur).
	async loadLeaderboard(
		mode: MatchMode = MatchMode.ONE_VS_ONE,
		seasonId: string | null = null,
		page = 0,
		pageSize = 50
	): Promise<LeaderboardPage | null> {
		void seasonId;
		try {
			const resp = await firstValueFrom(
				this.http.get<LeaderboardPage>(`${this.API}/leaderboard`, {
					params: {
						mode: mode.toString(),
						page: page.toString(),
						pageSize: pageSize.toString(),
					},
					withCredentials: true,
				})
			);
			this.leaderboard.set(resp);
			return resp;
		} catch {
			this.leaderboard.set(null);
			return null;
		}
	}

	async loadHistory(
		mode: MatchMode | null = null,
		page = 0,
		pageSize = 20,
		append = false
	): Promise<RankedHistoryEntry[]> {
		try {
			const params: Record<string, string> = {
				limit: pageSize.toString(),
				offset: (page * pageSize).toString(),
			};
			if (mode != null) params["mode"] = mode.toString();
			const resp = await firstValueFrom(
				this.http.get<RankedHistoryEntry[]>(`/api/users/me/ranked-history`, {
					params,
					withCredentials: true,
				})
			);
			if (append) this.history.update((list) => [...list, ...resp]);
			else this.history.set(resp);
			this.historyHasMore.set(resp.length === pageSize);
			return resp;
		} catch {
			if (!append) this.history.set([]);
			this.historyHasMore.set(false);
			return [];
		}
	}

	async adminValidateMatch(lobbyId: number, body: RankedAdminValidateRequest): Promise<boolean> {
		try {
			await firstValueFrom(
				this.http.post(`/api/admin/lobbies/${lobbyId}/validate`, body, {
					withCredentials: true,
				})
			);
			this.msg.add({
				severity: "success",
				summary: "Match validé",
				detail: `Lobby #${lobbyId} résolu`,
			});
			await this.loadAdminDisputes();
			return true;
		} catch {
			this.msg.add({
				severity: "error",
				summary: "Échec validation",
				detail: "Erreur serveur",
			});
			return false;
		}
	}

	// Annule un match contesté (aucun ELO appliqué). Admin only côté serveur.
	async cancelMatch(lobbyId: number): Promise<boolean> {
		try {
			await firstValueFrom(
				this.http.post(`/api/admin/lobbies/${lobbyId}/cancel`, {}, { withCredentials: true })
			);
			this.msg.add({
				severity: "success",
				summary: "Match annulé",
				detail: `Lobby #${lobbyId} annulé (aucun ELO appliqué)`,
			});
			await this.loadAdminDisputes();
			return true;
		} catch {
			this.msg.add({ severity: "error", summary: "Échec annulation", detail: "Erreur serveur" });
			return false;
		}
	}

	// Charge le journal de télémétrie (vue staff). Filtres optionnels.
	async loadTelemetry(
		opts: { lobbyId?: number; roomCode?: string; userId?: string; limit?: number } = {}
	): Promise<RankedMatchEvent[]> {
		try {
			const params = new URLSearchParams();
			if (opts.lobbyId) params.set("lobbyId", String(opts.lobbyId));
			if (opts.roomCode) params.set("roomCode", opts.roomCode);
			if (opts.userId) params.set("userId", opts.userId);
			params.set("limit", String(opts.limit ?? 200));
			const resp = await firstValueFrom(
				this.http.get<RankedMatchEvent[]>(`/api/admin/ranked/telemetry?${params.toString()}`, {
					withCredentials: true,
				})
			);
			this.telemetry.set(resp);
			return resp;
		} catch {
			this.telemetry.set([]);
			return [];
		}
	}

	// ---- Administration des saisons (lecture Modérateur+, mutations Admin+) ----

	async loadSeasons(): Promise<RankedAdminSeason[]> {
		try {
			const resp = await firstValueFrom(
				this.http.get<SeasonRowRaw[]>("/api/admin/seasons", { withCredentials: true })
			);
			const seasons = resp.map(mapSeasonRow);
			this.seasons.set(seasons);
			return seasons;
		} catch {
			this.seasons.set([]);
			return [];
		}
	}

	async createSeason(input: RankedSeasonInput): Promise<boolean> {
		try {
			await firstValueFrom(
				this.http.post<SeasonRowRaw>("/api/admin/seasons", input, { withCredentials: true })
			);
			this.msg.add({ severity: "success", summary: "Saison créée", detail: input.name });
			await this.loadSeasons();
			return true;
		} catch {
			this.msg.add({ severity: "error", summary: "Échec création", detail: "Vérifie les dates" });
			return false;
		}
	}

	async updateSeason(
		id: string,
		patch: Partial<RankedSeasonInput & { state: string }>
	): Promise<boolean> {
		try {
			await firstValueFrom(
				this.http.patch<SeasonRowRaw>(`/api/admin/seasons/${id}`, patch, {
					withCredentials: true,
				})
			);
			this.msg.add({ severity: "success", summary: "Saison mise à jour", detail: "" });
			await this.loadSeasons();
			return true;
		} catch {
			this.msg.add({ severity: "error", summary: "Échec mise à jour", detail: "Erreur serveur" });
			return false;
		}
	}

	async activateSeason(id: string): Promise<boolean> {
		try {
			await firstValueFrom(
				this.http.post(`/api/admin/seasons/${id}/activate`, {}, { withCredentials: true })
			);
			this.msg.add({
				severity: "success",
				summary: "Saison activée",
				detail: "La saison active précédente a été clôturée.",
			});
			await this.loadSeasons();
			return true;
		} catch {
			this.msg.add({ severity: "error", summary: "Échec activation", detail: "Erreur serveur" });
			return false;
		}
	}

	async resetLadder(id: string): Promise<boolean> {
		try {
			const resp = await firstValueFrom(
				this.http.post<{ ok: boolean; affected: number }>(
					`/api/admin/seasons/${id}/reset`,
					{},
					{ withCredentials: true }
				)
			);
			this.msg.add({
				severity: "success",
				summary: "Ladder réinitialisé",
				detail: `${resp.affected} joueur(s) remis à la base.`,
			});
			await this.loadSeasons();
			return true;
		} catch {
			this.msg.add({ severity: "error", summary: "Échec reset", detail: "Erreur serveur" });
			return false;
		}
	}
}
