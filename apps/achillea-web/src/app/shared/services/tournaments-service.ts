import { computed, Injectable, signal, inject } from "@angular/core";
import { HttpClient, HttpParams } from "@angular/common/http";
import { MessageService } from "primeng/api";
import { firstValueFrom } from "rxjs";
import {
	CircuitRanking,
	NewTournamentDTO,
	ParticipantDTO,
	PlayerCircuitProfile,
	ScoreReportPolicy,
	StatsHub,
	Tournament,
	TournamentEventDTO,
	TournamentState,
	TournamentSummary,
} from "../../core/models/Tournament";
import { UserDTO } from "./user-service";
import { GameScoreDTO, GameValidatorDTO, LobbyDTO } from "../../core/models/Lobby";

@Injectable({
	providedIn: "root",
})
export class TournamentsService {
	private http = inject(HttpClient);
	private msg = inject(MessageService);

	private API = "api/tournaments";

	public async createAchilleaTournament(tournament: NewTournamentDTO): Promise<boolean> {
		try {
			// 1. L'appel HTTP
			// On attend un objet (le tournoi créé), pas un wrapper { success: boolean }
			await firstValueFrom(
				this.http.post<any>( // Idéalement, remplacez <any> par l'interface <Tournament>
					`${this.API}/create/achillea`, // Adaptez selon votre route exacte
					tournament,
					{ withCredentials: true }
				)
			);

			this.msg.add({
				severity: "success",
				summary: "Tournoi créé",
				detail: "Le tournoi a été créé. Ouvre-le pour lancer les inscriptions.",
				life: 6000,
			});

			return true;
		} catch (err: any) {
			console.error("Erreur lors de la création :", err);
			this.msg.add({
				severity: "error",
				summary: "Erreur de création",
				detail: this.extractErrorMessage(err, "Impossible de créer le tournoi."),
				life: 8000,
			});
			return false;
		}
	}

	/** Mise à jour complète (champs + logo/affiche CDN). */
	public async updateAchilleaTournament(
		id: number,
		tournament: NewTournamentDTO
	): Promise<Tournament | null> {
		try {
			const updated = await firstValueFrom(
				this.http.put<Tournament>(`${this.API}/${id}/edit`, tournament, {
					withCredentials: true,
				})
			);
			this.msg.add({
				severity: "success",
				summary: "Tournoi mis à jour",
				detail: "Les modifications (dont images) ont été enregistrées.",
				life: 5000,
			});
			return updated;
		} catch (err: any) {
			console.error("Erreur lors de la mise à jour :", err);
			this.msg.add({
				severity: "error",
				summary: "Erreur de mise à jour",
				detail: this.extractErrorMessage(err, "Impossible de mettre à jour le tournoi."),
				life: 8000,
			});
			return null;
		}
	}

	/** Message d'erreur lisible depuis HttpErrorResponse Ts.ED / Express. */
	private extractErrorMessage(err: any, fallback: string): string {
		if (!err) return fallback;
		const body = err.error;
		if (typeof body === "string" && body.trim()) return body;
		if (body?.message) {
			return Array.isArray(body.message) ? body.message.join(", ") : String(body.message);
		}
		if (Array.isArray(body?.errors) && body.errors.length) {
			return body.errors
				.map((e: any) => e?.message ?? e)
				.filter(Boolean)
				.join(", ");
		}
		if (err.message && !String(err.message).startsWith("Http failure")) return err.message;
		return fallback;
	}

	private _dashboardTournaments = signal<Tournament[]>([]);
	public dashboardTournaments = computed(() => this._dashboardTournaments());
	private async getTournaments(
		page: number = 1,
		pagination: number = 25,
		organizationId?: number,
		states?: TournamentState[]
	): Promise<{
		data: Tournament[];
		meta: { page: number; limit: number; total: number; pageCount: number };
	}> {
		try {
			let params = new HttpParams()
				.set("page", page.toString())
				.set("pagination", pagination.toString());

			if (organizationId) {
				params = params.set("organization", organizationId);
			}

			if (states && Array.isArray(states)) {
				states.forEach((state) => {
					params = params.append("states", state);
				});
			}

			return await firstValueFrom(
				this.http.get<{
					data: Tournament[];
					meta: { page: number; limit: number; total: number; pageCount: number };
				}>(`${this.API}`, {
					params,
					withCredentials: true, // important si cookies d’auth
				})
			);
		} catch (err: any) {
			console.error("Error fetching tournaments:", err);
			this.msg.add({
				severity: "error",
				summary: "Erreur",
				detail: err.message,
			});
			return { data: [], meta: { page: 1, limit: 25, total: 0, pageCount: 1 } };
		}
	}

	private _dashboardTournamentsLoading = signal<boolean>(false);
	public dashboardTournamentsLoading = computed(() => this._dashboardTournamentsLoading());

	public async getAndSetDashboardTournaments(
		page: number = 1,
		pagination: number = 25,
		organizationId?: number,
		states?: TournamentState[]
	) {
		this._dashboardTournamentsLoading.set(true);
		const organizations = await this.getTournaments(page, pagination, organizationId, states);
		this._dashboardTournaments.set(organizations.data);
		this._dashboardTournamentsLoading.set(false);
	}

	/**
	 * Verse le bonus AP podium (1er / 2e / demis) d'un tournoi terminé.
	 * Idempotent côté API.
	 */
	public async applyPlacementPrizes(id: number): Promise<{
		success: boolean;
		applied?: boolean;
		reason?: string;
		deltas?: Record<string, number>;
		tournamentSize?: number;
	} | null> {
		try {
			const res = await firstValueFrom(
				this.http.post<{
					success: boolean;
					applied?: boolean;
					reason?: string;
					deltas?: Record<string, number>;
					tournamentSize?: number;
					error?: string;
				}>(`${this.API}/${id}/apply-placement-prizes`, {}, { withCredentials: true })
			);

			if (res.success || res.applied) {
				const n = res.deltas ? Object.keys(res.deltas).length : 0;
				this.msg.add({
					severity: "success",
					summary: "Bonus podium versé",
					detail:
						n > 0
							? `${n} joueur(s) récompensé(s) (taille ${res.tournamentSize ?? "?"} ).`
							: "Bonus marqué comme appliqué (aucun delta).",
					life: 6000,
				});
			} else {
				const reason = res.reason ?? res.error ?? "non appliqué";
				this.msg.add({
					severity: "warn",
					summary: "Bonus podium",
					detail: this.placementPrizeReasonLabel(reason),
					life: 7000,
				});
			}
			return res;
		} catch (err: any) {
			console.error("Erreur apply-placement-prizes:", err);
			this.msg.add({
				severity: "error",
				summary: "Bonus podium",
				detail: this.extractErrorMessage(err, "Impossible d'appliquer le bonus podium."),
				life: 8000,
			});
			return null;
		}
	}

	private placementPrizeReasonLabel(reason: string): string {
		const map: Record<string, string> = {
			deja_applique: "Bonus déjà versé pour ce tournoi.",
			tournoi_non_termine: "Le tournoi doit être terminé.",
			format_non_eligible: "Format non éligible (élimination simple/double uniquement).",
			aucune_stage: "Aucun bracket technique trouvé.",
			classement_vide: "Classement final indisponible.",
			aucun_placement_mappable: "Impossible de relier le podium aux joueurs.",
			tournoi_introuvable: "Tournoi introuvable.",
		};
		return map[reason] ?? reason;
	}

	/**
	 * Liste publique silencieuse (pas de toast) — homepage / previews.
	 */
	public async listTournamentsQuiet(
		page: number = 1,
		pagination: number = 12,
		states?: TournamentState[]
	): Promise<Tournament[]> {
		try {
			let params = new HttpParams()
				.set("page", page.toString())
				.set("pagination", pagination.toString());
			if (states?.length) {
				for (const state of states) {
					params = params.append("states", state);
				}
			}
			const res = await firstValueFrom(
				this.http.get<{
					data: Tournament[];
					meta: { page: number; limit: number; total: number; pageCount: number };
				}>(`${this.API}`, { params, withCredentials: true })
			);
			return res.data ?? [];
		} catch (err) {
			console.error("Error listing tournaments (quiet):", err);
			return [];
		}
	}

	/**
	 * Classement circuit : cumul de points sur tous les tournois élimination
	 * terminés (voir `TournamentsService.getCircuitRanking` côté bot). Public,
	 * pas de toast d'erreur — page dédiée qui gère son propre état vide/erreur.
	 */
	public async getCircuitRanking(): Promise<CircuitRanking | null> {
		try {
			return await firstValueFrom(this.http.get<CircuitRanking>(`${this.API}/circuit/ranking`));
		} catch (err) {
			console.error("Error fetching circuit ranking:", err);
			return null;
		}
	}

	/**
	 * Profil circuit d'un joueur (cumul all-time + historique) — page profil public.
	 * Public, pas de toast d'erreur.
	 */
	public async getPlayerCircuitProfile(userId: string): Promise<PlayerCircuitProfile | null> {
		try {
			return await firstValueFrom(
				this.http.get<PlayerCircuitProfile>(`${this.API}/circuit/players/${userId}`)
			);
		} catch (err) {
			console.error("Error fetching player circuit profile:", err);
			return null;
		}
	}

	/**
	 * Hub statistiques circuit — vue d'ensemble, records all-time, joueurs/clans
	 * enrichis (buts, séries), historique complet. Public, pas de toast d'erreur.
	 */
	public async getStatsHub(): Promise<StatsHub | null> {
		try {
			return await firstValueFrom(this.http.get<StatsHub>(`${this.API}/circuit/stats`));
		} catch (err) {
			console.error("Error fetching stats hub:", err);
			return null;
		}
	}

	/**
	 * Top 10 + stats matchs d'un tournoi — page publique du tournoi. Pas de toast
	 * d'erreur, le composant gère son propre affichage vide/partiel.
	 */
	public async getTournamentSummary(id: number): Promise<TournamentSummary | null> {
		try {
			return await firstValueFrom(this.http.get<TournamentSummary>(`${this.API}/${id}/summary`));
		} catch (err) {
			console.error("Error fetching tournament summary:", err);
			return null;
		}
	}

	/** Détail silencieux (pas de toast) — homepage preview. */
	public async getTournamentQuiet(id: number): Promise<[Tournament, ParticipantDTO[], any] | null> {
		try {
			return await firstValueFrom(
				this.http.get<[Tournament, ParticipantDTO[], any]>(`${this.API}/${id}`, {
					withCredentials: true,
				})
			);
		} catch (err) {
			console.error("Error fetching tournament (quiet):", err);
			return null;
		}
	}

	public async getTournament(id: number) {
		try {
			return await firstValueFrom(
				this.http.get<[Tournament, ParticipantDTO[], any]>(`${this.API}/${id}`, {
					withCredentials: true, // important si cookies d’auth
				})
			);
		} catch (err: any) {
			console.error("Error fetching tournament:", err);
			this.msg.add({
				severity: "error",
				summary: "Erreur",
				detail: err.error.message ?? err.message,
			});
			return null;
		}
	}

	public async getTournamentLobby(lobbyId: number) {
		try {
			return await firstValueFrom(
				this.http.get<LobbyDTO>(`${this.API}/lobby/${lobbyId}`, {
					withCredentials: true,
				})
			);
		} catch (err: any) {
			console.error("Error fetching lobby:", err);
			this.msg.add({
				severity: "error",
				summary: "Erreur",
				detail: err.error.message ?? err.message,
			});
			return null;
		}
	}

	public async participate(id: number) {
		try {
			return await firstValueFrom(
				// Body {} obligatoire : `null` → Content-Length 0 → bun-serve-express 500
				this.http.post<ParticipantDTO>(
					`${this.API}/participate/${id}`,
					{},
					{
						withCredentials: true, // important si cookies d’auth
					}
				)
			);
		} catch (err: any) {
			console.error("Error registering for the tournament:", err);
			this.msg.add({
				severity: "error",
				summary: "Erreur",
				detail: err.error.message ?? err.message,
			});
			return null;
		}
	}

	public async unregister(id: number) {
		try {
			await firstValueFrom(
				this.http.post<void>(
					`${this.API}/unregister/${id}`,
					{},
					{
						withCredentials: true, // important si cookies d’auth
					}
				)
			);

			return true;
		} catch (err: any) {
			console.error("Error unregistering from the tournament:", err);
			this.msg.add({
				severity: "error",
				summary: "Erreur",
				detail: err.error.message ?? err.message,
			});
			return false;
		}
	}

	public async removeParticipant(id: number, userId: string) {
		try {
			await firstValueFrom(
				this.http.post<void>(
					`${this.API}/remove-participant/${id}`,
					{
						userId,
					},
					{
						withCredentials: true,
					}
				)
			);

			return true;
		} catch (err: any) {
			console.error("Error removing participant from the tournament:", err);
			this.msg.add({
				severity: "error",
				summary: "Erreur",
				detail: err.error.message ?? err.message,
			});
			return false;
		}
	}

	public async setParticipantSeed(id: number, participant: ParticipantDTO) {
		try {
			const result = await firstValueFrom(
				this.http.post<{
					participantId: number;
					seed: number | null;
					previousSeed: number | null;
					swappedWith: string | null;
					bracketUpdated: boolean;
				}>(
					`${this.API}/set-participant-seeding/${id}`,
					{
						// Payload minimal : l'API ne s'appuie que sur id + seed (+ path param tournoi).
						participant: {
							id: participant.id,
							seed: participant.seed,
							tournament: { id },
							user: participant.user,
							hasCheckedIn: participant.hasCheckedIn,
						},
					},
					{ withCredentials: true }
				)
			);

			const name = participant.user.username;
			let detail =
				result.seed != null ? `${name} → seed ${result.seed}` : `Seed retirée pour ${name}`;
			if (result.swappedWith) {
				detail += ` (échange avec ${result.swappedWith})`;
			}
			if (result.bracketUpdated) {
				detail += " · bracket régénéré";
			}

			this.msg.add({
				severity: "success",
				summary: result.swappedWith ? "Seeds échangées" : "Seeding mis à jour",
				detail,
			});

			return true;
		} catch (err: any) {
			console.error("Error editing participant seeding:", err);
			this.msg.add({
				severity: "error",
				summary: "Erreur",
				detail: err?.error?.message ?? err?.message,
			});
			return false;
		}
	}

	/** Seed 1..N selon le classement ranked solo (ELO décroissant). Écrase le seeding actuel. */
	public async seedByRanked(id: number) {
		try {
			const result = await firstValueFrom(
				this.http.post<{ mode: string; bracketUpdated: boolean; assignments: unknown[] }>(
					`${this.API}/seed-by-ranked/${id}`,
					{},
					{ withCredentials: true }
				)
			);

			this.msg.add({
				severity: "success",
				summary: "Seeding ranked appliqué",
				detail: result.bracketUpdated
					? "Seeds 1…N par ELO solo · bracket régénéré."
					: "Seeds 1…N par ELO solo (bracket non régénéré — pas encore de stage).",
			});

			return true;
		} catch (err: any) {
			console.error("Error seeding by ranked:", err);
			this.msg.add({
				severity: "error",
				summary: "Erreur",
				detail: err?.error?.message ?? err?.message ?? "Impossible d'appliquer le seeding ranked.",
			});
			return false;
		}
	}

	/** Mélange aléatoire des seeds. */
	public async seedRandom(id: number) {
		try {
			const result = await firstValueFrom(
				this.http.post<{ mode: string; bracketUpdated: boolean }>(
					`${this.API}/seed-random/${id}`,
					{},
					{ withCredentials: true }
				)
			);

			this.msg.add({
				severity: "success",
				summary: "Seeding aléatoire",
				detail: result.bracketUpdated ? "Seeds mélangées · bracket régénéré." : "Seeds mélangées.",
			});

			return true;
		} catch (err: any) {
			console.error("Error random seeding:", err);
			this.msg.add({
				severity: "error",
				summary: "Erreur",
				detail: err?.error?.message ?? err?.message ?? "Impossible de mélanger les seeds.",
			});
			return false;
		}
	}

	/** Retire toutes les seeds. */
	public async clearSeeds(id: number) {
		try {
			const result = await firstValueFrom(
				this.http.post<{ mode: string; bracketUpdated: boolean; cleared: number }>(
					`${this.API}/clear-seeds/${id}`,
					{},
					{ withCredentials: true }
				)
			);

			this.msg.add({
				severity: "success",
				summary: "Seeds effacées",
				detail: result.bracketUpdated
					? `${result.cleared} seed(s) retirée(s) · bracket régénéré.`
					: `${result.cleared} seed(s) retirée(s).`,
			});

			return true;
		} catch (err: any) {
			console.error("Error clearing seeds:", err);
			this.msg.add({
				severity: "error",
				summary: "Erreur",
				detail: err?.error?.message ?? err?.message ?? "Impossible d'effacer les seeds.",
			});
			return false;
		}
	}

	/** Bascule « qui saisit les scores » (organisateurs uniquement, API `/:id/score-policy`). */
	public async setScoreReportPolicy(id: number, policy: ScoreReportPolicy) {
		try {
			await firstValueFrom(
				this.http.post<{ success: boolean; scoreReportPolicy: ScoreReportPolicy }>(
					`${this.API}/${id}/score-policy`,
					{ policy },
					{ withCredentials: true }
				)
			);

			this.msg.add({
				severity: "success",
				summary: "Saisie des scores mise à jour",
				detail:
					policy === ScoreReportPolicy.STAFF_ONLY
						? "Seuls les organisateurs peuvent désormais saisir les scores."
						: "Les joueurs peuvent désormais saisir le score de leur match.",
			});

			return true;
		} catch (err: any) {
			console.error("Error setting score policy:", err);
			this.msg.add({
				severity: "error",
				summary: "Erreur",
				detail:
					err?.error?.error ??
					err?.error?.message ??
					err?.message ??
					"Impossible de changer la saisie des scores.",
			});
			return false;
		}
	}

	public async reportScore(score: GameScoreDTO) {
		try {
			await firstValueFrom(
				this.http.post<void>(
					`${this.API}/report-score`,
					{
						score,
					},
					{
						withCredentials: true,
					}
				)
			);

			this.msg.add({
				severity: "success",
				summary: "Résultats mis à jour",
				detail: "Les résultats ont été mis à jour avec succès !",
			});

			return true;
		} catch (err: any) {
			console.error("Error setting score:", err);
			this.msg.add({
				severity: "error",
				summary: "Erreur",
				detail: err.error.message ?? err.message,
			});
			return false;
		}
	}

	public async validateScore(gameValidation: GameValidatorDTO) {
		try {
			await firstValueFrom(
				this.http.post<void>(
					`${this.API}/validate-score`,
					{
						gameValidation,
					},
					{
						withCredentials: true,
					}
				)
			);

			this.msg.add({
				severity: "success",
				summary: "Résultats validés",
				detail: "Vous avez validé les scores avec succès  !",
			});

			return true;
		} catch (err: any) {
			console.error("Error validating score:", err);
			this.msg.add({
				severity: "error",
				summary: "Erreur",
				detail: err.error.message ?? err.message,
			});
			return false;
		}
	}

	public async unvalidateScore(gameValidation: GameValidatorDTO) {
		try {
			await firstValueFrom(
				this.http.post<void>(
					`${this.API}/unvalidate-score`,
					{
						gameValidation,
					},
					{
						withCredentials: true,
					}
				)
			);

			this.msg.add({
				severity: "success",
				summary: "Résultats invalidés",
				detail: "Vous avez invalidé les scores avec succès  !",
			});

			return true;
		} catch (err: any) {
			console.error("Error unvalidating score:", err);
			this.msg.add({
				severity: "error",
				summary: "Erreur",
				detail: err.error.message ?? err.message,
			});
			return false;
		}
	}

	public async openRegistrations(id: number) {
		try {
			await firstValueFrom(
				this.http.post<{ success: boolean; error?: any }>(
					`${this.API}/open-registrations/${id}`,
					{},
					{
						withCredentials: true, // important si cookies d’auth
					}
				)
			);

			this.msg.add({
				severity: "success",
				summary: "Inscriptions ouvertes",
				detail: `Les inscriptions ont été ouvertes avec succès !`,
			});

			return true;
		} catch (err: any) {
			console.error("Error opening registrations:", err);
			this.msg.add({
				severity: "error",
				summary: "Erreur",
				detail: this.extractErrorMessage(err, "Impossible d'ouvrir les inscriptions."),
			});
			return false;
		}
	}

	public async startTournament(id: number) {
		try {
			await firstValueFrom(this.http.put(`${this.API}/start/${id}`, {}, { withCredentials: true }));
			this.msg.add({
				severity: "success",
				summary: "Tournoi démarré",
				detail: "Le tournoi a démarré avec succès !",
			});
			return true;
		} catch (err: any) {
			console.error("Error starting tournament:", err);
			this.msg.add({
				severity: "error",
				summary: "Erreur",
				detail: this.extractErrorMessage(err, "Impossible de démarrer le tournoi."),
			});
			return false;
		}
	}

	public async generateBracket(id: number) {
		try {
			await firstValueFrom(
				this.http.post(`${this.API}/generate-bracket/${id}`, {}, { withCredentials: true })
			);
			this.msg.add({
				severity: "success",
				summary: "Bracket généré",
				detail: "Le bracket a été généré avec succès !",
			});
			return true;
		} catch (err: any) {
			console.error("Error generating bracket:", err);
			this.msg.add({
				severity: "error",
				summary: "Erreur",
				detail: this.extractErrorMessage(err, "Impossible de générer le bracket."),
			});
			return false;
		}
	}

	public async addTOs(id: number, newManagers: UserDTO[]) {
		try {
			const res = await firstValueFrom(
				this.http.post<{ success: boolean; error?: any }>(
					`${this.API}/add-managers/${id}`,
					newManagers,
					{
						withCredentials: true, // important si cookies d’auth
					}
				)
			);

			if (res.success) {
				this.msg.add({
					severity: "success",
					summary: "TOs ajoutés",
					detail: `Les nouveaux TOs ont été ajoutés !`,
				});
			}

			return res.success;
		} catch (err: any) {
			console.error("Error adding new TOs:", err);
			this.msg.add({
				severity: "error",
				summary: "Erreur",
				detail: err.error.error ?? err.message,
			});
			return false;
		}
	}

	public async removeTO(id: number, toRemove: UserDTO) {
		try {
			const res = await firstValueFrom(
				this.http.post<{ success: boolean; error?: any }>(
					`${this.API}/remove-manager/${id}`,
					toRemove,
					{
						withCredentials: true, // important si cookies d’auth
					}
				)
			);

			if (res.success) {
				this.msg.add({
					severity: "success",
					summary: "TO retiré",
					detail: `L'utilisateur ${toRemove.username} a été retiré de la liste des TOs!`,
				});
			}

			return res.success;
		} catch (err: any) {
			console.error("Error removing TO:", err);
			this.msg.add({
				severity: "error",
				summary: "Erreur",
				detail: err.error.error ?? err.message,
			});
			return false;
		}
	}

	// ── Liste d'attente, disqualification, clôture (docs/plan-tournois.md) ──────

	/** Promotion manuelle d'un joueur depuis la liste d'attente (organisateur). */
	public async promoteParticipant(id: number, userId: string) {
		try {
			const res = await firstValueFrom(
				this.http.post<{ success: boolean; error?: string }>(
					`${this.API}/${id}/promote-participant`,
					{ userId },
					{ withCredentials: true }
				)
			);

			if (res.success) {
				this.msg.add({
					severity: "success",
					summary: "Joueur promu",
					detail: "Le joueur passe de la liste d'attente aux inscrits.",
				});
			}

			return res.success;
		} catch (err: any) {
			console.error("Error promoting participant:", err);
			this.msg.add({
				severity: "error",
				summary: "Erreur",
				detail: err.error?.error ?? err.error?.message ?? err.message,
			});
			return false;
		}
	}

	/** Disqualification d'un participant — motif obligatoire côté API. */
	public async disqualifyParticipant(id: number, userId: string, reason: string) {
		try {
			const res = await firstValueFrom(
				this.http.post<{
					success: boolean;
					forfeitedLobbies?: number;
					promoted?: string | null;
					error?: string;
				}>(`${this.API}/${id}/disqualify`, { userId, reason }, { withCredentials: true })
			);

			if (res.success) {
				const forfeited = res.forfeitedLobbies ?? 0;
				this.msg.add({
					severity: "success",
					summary: "Joueur disqualifié",
					detail: forfeited
						? `${forfeited} match(s) en cours passés en forfait, le bracket a avancé.`
						: "Le joueur a été disqualifié et sa place libérée.",
				});
			}

			return res.success;
		} catch (err: any) {
			console.error("Error disqualifying participant:", err);
			this.msg.add({
				severity: "error",
				summary: "Erreur",
				detail: err.error?.error ?? err.error?.message ?? err.message,
			});
			return false;
		}
	}

	/** Annule une disqualification (avant démarrage du tournoi). */
	public async reinstateParticipant(id: number, userId: string) {
		try {
			const res = await firstValueFrom(
				this.http.post<{ success: boolean; error?: string }>(
					`${this.API}/${id}/reinstate`,
					{ userId },
					{ withCredentials: true }
				)
			);

			if (res.success) {
				this.msg.add({
					severity: "success",
					summary: "Joueur réintégré",
					detail: "La disqualification a été annulée.",
				});
			}

			return res.success;
		} catch (err: any) {
			console.error("Error reinstating participant:", err);
			this.msg.add({
				severity: "error",
				summary: "Erreur",
				detail: err.error?.error ?? err.error?.message ?? err.message,
			});
			return false;
		}
	}

	/**
	 * Clôture manuelle. Sans `force`, l'API refuse tant que des matchs sont ouverts —
	 * le nombre restant est remonté tel quel pour que l'appelant puisse proposer le forçage.
	 */
	public async closeTournament(id: number, force = false) {
		try {
			const res = await firstValueFrom(
				this.http.post<{ success: boolean; openLobbies?: number; error?: string }>(
					`${this.API}/${id}/close`,
					{ force },
					{ withCredentials: true }
				)
			);

			if (res.success) {
				this.msg.add({
					severity: "success",
					summary: "Tournoi clôturé",
					detail: "Les résultats sont figés et les récompenses appliquées.",
				});
			}

			return res;
		} catch (err: any) {
			console.error("Error closing tournament:", err);
			this.msg.add({
				severity: "error",
				summary: "Erreur",
				detail: err.error?.error ?? err.error?.message ?? err.message,
			});
			return { success: false, error: err.error?.error ?? err.message };
		}
	}

	/** Annulation — le tournoi reste en base, seul son état change. */
	public async cancelTournament(id: number, reason: string) {
		try {
			const res = await firstValueFrom(
				this.http.post<{ success: boolean; notified?: number; error?: string }>(
					`${this.API}/${id}/cancel`,
					{ reason },
					{ withCredentials: true }
				)
			);

			if (res.success) {
				this.msg.add({
					severity: "success",
					summary: "Tournoi annulé",
					detail: `${res.notified ?? 0} inscrit(s) prévenu(s). Le tournoi reste consultable.`,
				});
			}

			return res.success;
		} catch (err: any) {
			console.error("Error canceling tournament:", err);
			this.msg.add({
				severity: "error",
				summary: "Erreur",
				detail: err.error?.error ?? err.error?.message ?? err.message,
			});
			return false;
		}
	}

	public async restoreTournament(id: number) {
		try {
			const res = await firstValueFrom(
				this.http.post<{ success: boolean; internalState?: TournamentState; error?: string }>(
					`${this.API}/${id}/restore`,
					{},
					{ withCredentials: true }
				)
			);

			if (res.success) {
				this.msg.add({
					severity: "success",
					summary: "Tournoi restauré",
					detail: "Le tournoi est de nouveau actif.",
				});
			}

			return res.success;
		} catch (err: any) {
			console.error("Error restoring tournament:", err);
			this.msg.add({
				severity: "error",
				summary: "Erreur",
				detail: err.error?.error ?? err.error?.message ?? err.message,
			});
			return false;
		}
	}

	/** Journal du tournoi. Silencieux en cas d'erreur : c'est un affichage secondaire. */
	public async getTournamentEvents(id: number): Promise<TournamentEventDTO[]> {
		try {
			return await firstValueFrom(
				this.http.get<TournamentEventDTO[]>(`${this.API}/${id}/events`, {
					withCredentials: true,
				})
			);
		} catch (err: any) {
			console.error("Error loading tournament events:", err);
			return [];
		}
	}
}
