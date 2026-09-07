import {
	computed,
	effect,
	Injectable,
	Injector,
	resource,
	runInInjectionContext,
	signal,
	WritableSignal,
	inject,
} from "@angular/core";
import { HttpClient, httpResource } from "@angular/common/http";
import { Paginated } from "../../core/models/Paginated";
import { ClanApplicationDTO, ClanDTO, ClanInviteDTO, ClanState } from "../../core/models/Clan";
import { ClanMemberDistinction, ClanMemberDTO } from "../../core/models/ClanMember";
import { filter, firstValueFrom } from "rxjs";
import { toObservable } from "@angular/core/rxjs-interop";
import { take } from "rxjs/operators";
import { MessageService } from "primeng/api";
import { SupabaseService } from "../../core/supabase/supabase.service";

export type NewClanResponse = { success: true; clanId: number } | { error: string; code?: string };

export type UpdateClanInfoPatch = Partial<{
	name: string;
	shortenedName: string;
	clanBiography: string;
	clanAvatarUrl: string;
	xUrl: string | null;
	instagramUrl: string | null;
	tiktokUrl: string | null;
	isRecruiting: boolean;
	autoAcceptMembers: boolean;
	/** Réservé aux administrateurs (page "gestion des clans" du dashboard admin). */
	isInactive: boolean;
}>;

@Injectable({
	providedIn: "root",
})
export class ClanService {
	private injector = inject(Injector);
	private http = inject(HttpClient);
	private msg = inject(MessageService);
	private supabase = inject(SupabaseService);

	private readonly API = "/api/clans";

	// Projection des colonnes camelCase de la vue clan_list_view (matche ClanDTO).
	private static readonly CLAN_COLUMNS =
		'id, founders, name, "shortenedName", "normalizedShortName", "normalizedName", "clanAvatarUrl", "clanBiography", fame, "xUrl", "instagramUrl", "tiktokUrl", "isRecruiting", "isInactive", "isHidden", "isDisbanded", "autoAcceptMembers", state, "createdAt", languages, origin, experience, "membersCount", president';

	constructor() {
		effect(() => {
			const resp = this.clansResource.value();
			if (!resp) return;
			if (resp.meta.page === 1) {
				this._accumulated.set(resp.data);
			} else {
				this._accumulated.update((old) => [...old, ...resp.data]);
			}
		});
	}

	page = signal<number>(0);
	limit = signal<number>(25);

	// Liste paginée des clans depuis Supabase (vue clan_list_view) — réplique
	// ClanService.getClans : clans approuvés, non dissous, non cachés, triés par
	// date de création croissante. Le rang de page (1-indexé) est conservé pour
	// l'accumulation incrémentale côté front.
	readonly clansResource = resource<
		Paginated<ClanDTO>,
		{ page: number; limit: number } | undefined
	>({
		params: () => (this.page() !== 0 ? { page: this.page(), limit: this.limit() } : undefined),
		defaultValue: {
			data: [],
			meta: { page: 0, limit: this.limit(), total: 0, pageCount: 0 },
		},
		loader: async ({ params }) => {
			const { page, limit } = params!;
			const from = (page - 1) * limit;
			const to = from + limit - 1;
			const { data, error, count } = await this.supabase
				.from("clan_list_view")
				.select(ClanService.CLAN_COLUMNS, { count: "exact" })
				.eq("state", ClanState.Approved)
				.eq("isDisbanded", false)
				.eq("isHidden", false)
				.order("createdAt", { ascending: true })
				.range(from, to);
			if (error) throw error;
			const total = count ?? 0;
			return {
				data: (data ?? []) as unknown as ClanDTO[],
				meta: { page, limit, total, pageCount: Math.ceil(total / limit) },
			};
		},
	});

	total = computed(() => this.clansResource.value().meta.total);
	loading = computed<boolean>(() => this.clansResource.isLoading());

	loadNext() {
		if (this._accumulated().length >= this.total()) return;
		this.page.update((n) => n + 1);
	}

	private readonly _accumulated = signal<ClanDTO[]>([]);
	clans = computed(() => this._accumulated());

	clanId = signal<number | undefined>(undefined);
	fetchMembers = signal<boolean>(false);
	// Profil d'un clan depuis Supabase (vue clan_list_view) — réplique
	// ClanService.findById (404 si introuvable → le clan-guard redirige).
	readonly clanFromRoute = resource<ClanDTO | undefined, number | undefined>({
		params: () => (this.clanId() && !this.fetchMembers() ? this.clanId()! : undefined),
		defaultValue: undefined,
		loader: async ({ params: id }) => {
			const { data, error } = await this.supabase
				.from("clan_list_view")
				.select(ClanService.CLAN_COLUMNS)
				.eq("id", id)
				.maybeSingle();
			if (error) throw error;
			if (!data) throw new Error("Clan not found");
			return data as unknown as ClanDTO;
		},
	});

	clanLoading = computed(() => this.clanFromRoute.isLoading());
	clanValue = computed(() => this.clanFromRoute.value());
	clanError = computed(() => this.clanFromRoute.error());

	readonly membersFromRoute = httpResource<ClanMemberDTO[]>(
		() =>
			this.clanId() && this.fetchMembers()
				? {
						url: `${this.API}/${this.clanId()}/members`,
					}
				: undefined,
		{
			defaultValue: undefined,
		}
	);

	membersLoading = computed(() => this.membersFromRoute.isLoading());
	membersValue = computed(() => this.membersFromRoute.value());
	membersError = computed(() => this.membersFromRoute.error());

	realMembersSignal: WritableSignal<ClanMemberDTO[]> = signal([]);

	async getClanMembers(clanId: number): Promise<ClanMemberDTO[]> {
		this.fetchMembers.set(true);
		if (!this.clanId()) this.clanId.set(clanId);

		try {
			// ✅ Wrap in injection context
			return await runInInjectionContext(this.injector, async () => {
				const members = await firstValueFrom(
					toObservable(this.membersValue).pipe(
						filter((m): m is NonNullable<typeof m> => m != null),
						take(1)
					)
				);
				this.realMembersSignal.set(members);
				return members;
			});
		} catch (err) {
			console.error("Error while fetching clan members:", err);
			return [];
		} finally {
			this.fetchMembers.set(false);
			this.clanId.set(undefined);
		}
	}

	setMembers(members: ClanMemberDTO[]) {
		// directly mutate the httpResource’s value
		this.realMembersSignal.update(() => members);
	}

	async updateMember(
		member: ClanMemberDTO
	): Promise<{ success: boolean; members?: ClanMemberDTO[]; error?: string }> {
		try {
			const response = await firstValueFrom(
				this.http.post<{ success: boolean; members?: ClanMemberDTO[]; error?: string }>(
					`${this.API}/updateMember`,
					member
				)
			);

			if (response.success && response.members) {
				// ✅ Update the httpResource (auto-refresh UI)
				this.setMembers(response.members);
			}

			return response;
		} catch (err: any) {
			console.error("Error updating member:", err);
			return { success: false, error: "Erreur de communication avec le serveur." };
		}
	}

	async kickMember(
		memberId: string,
		reason: string
	): Promise<{ success: boolean; members?: ClanMemberDTO[]; error?: any }> {
		try {
			const res = await firstValueFrom(
				this.http.post<{ success: boolean; members?: ClanMemberDTO[] }>(
					`${this.API}/kick/${memberId}`,
					{ reason }
				)
			);

			if (res.success && res.members) {
				// ✅ Update the httpResource (auto-refresh UI)
				this.setMembers(res.members);
			}

			return res;
		} catch (err: any) {
			if (err.error && typeof err.error === "object" && "error" in err.error) {
				return err.error; // Return the backend JSON
			}
			return { success: false, error: "Erreur réseau ou serveur." };
		}
	}

	newClanLoading = signal(false);
	newClanResponse = signal<NewClanResponse | null>(null);
	newClanError = signal<string | null>(null);
	submitNewClan(payload: any) {
		this.newClanLoading.set(true);
		this.newClanError.set(null);

		this.http.post<NewClanResponse>(`${this.API}/create`, payload).subscribe({
			next: (res) => {
				this.newClanResponse.set(res);
				this.newClanLoading.set(false);
			},
			error: (err) => {
				// Auto-unify errors
				const backend = err.error ?? { error: "Unknown error", code: "UNKNOWN" };
				this.newClanError.set(backend.error);
				this.newClanResponse.set(backend);
				this.newClanLoading.set(false);
			},
		});
	}

	resetNewClan() {
		this.newClanLoading.set(false);
		this.newClanResponse.set(null);
		this.newClanError.set(null);
	}

	private _dashboardClanInvites = signal<ClanInviteDTO[]>([]);
	public dashboardClanInvites = computed(() => this._dashboardClanInvites());
	private async getClanInvites(): Promise<ClanInviteDTO[]> {
		try {
			return await firstValueFrom(
				this.http.get<ClanInviteDTO[]>(`${this.API}/invites`, {
					withCredentials: true, // important si cookies d’auth
				})
			);
		} catch (err: any) {
			console.error("Error fetching clan invites:", err);
			this.msg.add({
				severity: "error",
				summary: "Erreur",
				detail: err.message,
			});
			return [];
		}
	}

	private _dashboardClanInvitesLoading = signal<boolean>(false);
	public dashboardClanInvitesLoading = computed(() => this._dashboardClanInvitesLoading());

	public async getAndSetDashboardInvites() {
		this._dashboardClanInvitesLoading.set(true);
		const invites = await this.getClanInvites();
		this._dashboardClanInvites.set(invites);
		this._dashboardClanInvitesLoading.set(false);
	}

	public async revokeInvite(invite: ClanInviteDTO) {
		try {
			const res = await firstValueFrom(
				this.http.post<{ success: boolean; error?: any }>(`${this.API}/invites/revoke`, invite, {
					withCredentials: true,
				})
			);

			// ✅ Only reached if HTTP 200 OK
			if (!res.success) {
				this.msg.add({
					severity: "error",
					summary: "Erreur",
					detail: res.error ?? "Une erreur inconnue est survenue.",
				});
			} else {
				this.msg.add({
					severity: "success",
					summary: "Succès",
					detail: "Invitation révoquée avec succès.",
				});
			}
		} catch (err: any) {
			// ✅ Handle Angular HttpErrorResponse
			const serverError =
				err.error?.error || err.error?.message || "Erreur de communication avec le serveur.";
			this.msg.add({
				severity: "error",
				summary: "Erreur",
				detail: serverError,
			});
		}
	}

	public async notifyInvite(invite: ClanInviteDTO) {
		try {
			const res = await firstValueFrom(
				this.http.post<{ success: boolean; error?: any }>(`${this.API}/invites/notify`, invite, {
					withCredentials: true,
				})
			);

			// 🔥 Si backend répond HTTP 200, on arrive ici
			if (!res.success) {
				this.msg.add({
					severity: "error",
					summary: "Erreur",
					detail: res.error ?? "Impossible de notifier cette invitation.",
				});
			} else {
				this.msg.add({
					severity: "success",
					summary: "Succès",
					detail: "Notification envoyée avec succès.",
				});
			}
		} catch (err: any) {
			// 🔥 Gestion correcte des erreurs Angular HttpErrorResponse
			const serverError =
				err.error?.error ||
				err.error?.message ||
				err.message ||
				"Erreur de communication avec le serveur.";

			this.msg.add({
				severity: "error",
				summary: "Erreur",
				detail: serverError,
			});
		}
	}

	public async createInvite(userId: string, distinctions: ClanMemberDistinction[]) {
		try {
			const res = await firstValueFrom(
				this.http.post<{ success: boolean; error?: any }>(
					`${this.API}/invites/create`,
					{ userId, distinctions },
					{ withCredentials: true }
				)
			);

			// 🔥 HTTP 200 OK → response received
			if (!res.success) {
				this.msg.add({
					severity: "error",
					summary: "Erreur",
					detail: res.error ?? "Impossible de créer l’invitation.",
				});
			} else {
				this.msg.add({
					severity: "success",
					summary: "Succès",
					detail: "Invitation créée avec succès.",
				});
			}

			return res.success;
		} catch (err: any) {
			// 🔥 Handle Angular HttpErrorResponse
			const serverError =
				err.error?.error ||
				err.error?.message ||
				err.message ||
				"Erreur de communication avec le serveur.";

			this.msg.add({
				severity: "error",
				summary: "Erreur",
				detail: serverError,
			});

			return false;
		}
	}

	private _dashboardClanApplications = signal<ClanApplicationDTO[]>([]);
	public dashboardClanApplications = computed(() => this._dashboardClanApplications());
	private async getClanApplications(): Promise<ClanInviteDTO[]> {
		try {
			return await firstValueFrom(
				this.http.get<ClanInviteDTO[]>(`${this.API}/applications`, {
					withCredentials: true, // important si cookies d’auth
				})
			);
		} catch (err: any) {
			console.error("Error fetching clan applications:", err);
			this.msg.add({
				severity: "error",
				summary: "Erreur",
				detail: err.message,
			});
			return [];
		}
	}

	private _dashboardClanApplicationsLoading = signal<boolean>(false);
	public dashboardClanApplicationsLoading = computed(() =>
		this._dashboardClanApplicationsLoading()
	);

	public async getAndSetDashboardApplications() {
		this._dashboardClanApplicationsLoading.set(true);
		const applications = await this.getClanApplications();
		this._dashboardClanApplications.set(applications);
		this._dashboardClanApplicationsLoading.set(false);
	}

	public async rejectApplication(applicationDTO: ClanApplicationDTO) {
		try {
			const res = await firstValueFrom(
				this.http.post<{ success: boolean; error?: any }>(
					`${this.API}/applications/reject`,
					applicationDTO,
					{ withCredentials: true }
				)
			);

			// ✅ Only reached if HTTP 200 OK
			if (!res.success) {
				this.msg.add({
					severity: "error",
					summary: "Erreur",
					detail: res.error ?? "Une erreur inconnue est survenue.",
				});
			} else {
				this.msg.add({
					severity: "success",
					summary: "Succès",
					detail: "Candidature rejetée avec succès.",
				});
			}
		} catch (err: any) {
			// ✅ Handle Angular HttpErrorResponse
			const serverError =
				err.error?.error || err.error?.message || "Erreur de communication avec le serveur.";
			this.msg.add({
				severity: "error",
				summary: "Erreur",
				detail: serverError,
			});
		}
	}

	public async acceptApplication(applicationDTO: ClanApplicationDTO) {
		try {
			const res = await firstValueFrom(
				this.http.post<{ success: boolean; error?: any }>(
					`${this.API}/applications/accept`,
					applicationDTO,
					{ withCredentials: true }
				)
			);

			// ✅ Only reached if HTTP 200 OK
			if (!res.success) {
				this.msg.add({
					severity: "error",
					summary: "Erreur",
					detail: res.error ?? "Une erreur inconnue est survenue.",
				});
			} else {
				this.msg.add({
					severity: "success",
					summary: "Succès",
					detail: "Candidature acceptée avec succès.",
				});
			}
		} catch (err: any) {
			// ✅ Handle Angular HttpErrorResponse
			const serverError =
				err.error?.error || err.error?.message || "Erreur de communication avec le serveur.";
			this.msg.add({
				severity: "error",
				summary: "Erreur",
				detail: serverError,
			});
		}
	}

	// Onglet "Infos" du dashboard de clan — chef d'équipe (Captain) ou admin site
	// (permissions vérifiées côté backend, cf. ClansController.updateClanInfo).
	public async updateClanInfo(
		clanId: number,
		patch: UpdateClanInfoPatch
	): Promise<{ success: boolean; clan?: ClanDTO; error?: string }> {
		try {
			const res = await firstValueFrom(
				this.http.patch<{ success: boolean; clan?: ClanDTO; error?: string }>(
					`${this.API}/${clanId}`,
					patch,
					{ withCredentials: true }
				)
			);

			if (res.success) {
				this.msg.add({
					severity: "success",
					summary: "Succès",
					detail: "Informations du clan mises à jour.",
				});
			} else {
				this.msg.add({
					severity: "error",
					summary: "Erreur",
					detail: res.error ?? "Une erreur inconnue est survenue.",
				});
			}

			return res;
		} catch (err: any) {
			const serverError =
				err.error?.error || err.error?.message || "Erreur de communication avec le serveur.";
			this.msg.add({
				severity: "error",
				summary: "Erreur",
				detail: serverError,
			});
			return { success: false, error: serverError };
		}
	}

	public async createApplication(clanId: number, distinctions: ClanMemberDistinction[]) {
		try {
			const res = await firstValueFrom(
				this.http.post<{ success: boolean; error?: any; autojoin?: boolean }>(
					`${this.API}/applications/create`,
					{ clanId, distinctions },
					{ withCredentials: true }
				)
			);

			// 🔥 HTTP 200 OK → response received
			if (!res.success) {
				this.msg.add({
					severity: "error",
					summary: "Erreur",
					detail: res.error ?? "Impossible de créer la candidature.",
				});
			} else {
				if (res.autojoin) {
					this.msg.add({
						severity: "success",
						summary: "Succès",
						detail: "Votre candidature a été soumise et acceptée automatiquement.",
					});
				} else {
					this.msg.add({
						severity: "success",
						summary: "Succès",
						detail: "Candidature créée avec succès.",
					});
				}
			}

			return [res.success, res.autojoin];
		} catch (err: any) {
			// 🔥 Handle Angular HttpErrorResponse
			const serverError =
				err.error?.error ||
				err.error?.message ||
				err.message ||
				"Erreur de communication avec le serveur.";

			this.msg.add({
				severity: "error",
				summary: "Erreur",
				detail: serverError,
			});

			return [false, false];
		}
	}
}
