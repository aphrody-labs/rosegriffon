import { computed, effect, Injectable, Signal, signal, inject } from "@angular/core";
import { HttpClient, httpResource } from "@angular/common/http";
import { Suggestion, SuggestionRank, UserRole } from "../../core/models/Suggestion";
import { Router } from "@angular/router";
import { EnrichedUserDTO } from "../../core/models/User";
import { ClanMemberRole } from "../../core/models/ClanMember";
import { NotificationSocketService } from "./notification-socket-service";
import { firstValueFrom, Subscription } from "rxjs";
import { MessageService } from "primeng/api";
import { NotificationModel } from "../../core/models/Notification";
import { SupabaseService } from "../../core/supabase/supabase.service";
import type { Session } from "@supabase/supabase-js";

export type UserDTO = {
	id: string;
	username: string;
	clanId?: number;
	sim: number;
	avatar?: string;
	soloRank: SuggestionRank;
	duoRank: SuggestionRank;
	lastInteract?: Date;
	role?: UserRole;
	currentLevel?: number;
	totalXp?: number;
	hasTwitch?: boolean;
	hasChallonge?: boolean;
	hasYoutube?: boolean;
};

@Injectable({
	providedIn: "root",
})
export class UserService {
	private http = inject(HttpClient);
	private router = inject(Router);
	private notifWS = inject(NotificationSocketService);
	private msg = inject(MessageService);
	private supabase = inject(SupabaseService);

	private readonly AUTH_API = "/api/auth";
	private readonly USERS_API = "/api/users";
	private readonly NOTIFICATIONS_API = "/api/notifications";

	// Session Supabase (auth OAuth Discord côté Supabase). Reste optionnelle :
	// tant que le provider Discord n'est pas activé dans le dashboard Supabase
	// (cf. apps/web/SUPABASE-AUTH.md), le flux cookie/JWT du bot sert de fallback.
	readonly supabaseSession = signal<Session | null>(null);

	constructor() {
		// Hydrate la session Supabase au démarrage + écoute les changements
		// (connexion via redirect OAuth, refresh token, déconnexion).
		void this.supabase.client.auth.getSession().then(({ data }) => {
			this.supabaseSession.set(data.session ?? null);
		});
		this.supabase.client.auth.onAuthStateChange((_event, session) => {
			this.supabaseSession.set(session ?? null);
		});
	}

	// Connexion via Supabase OAuth Discord. Prête côté code ; nécessite l'activation
	// du provider Discord dans le dashboard Supabase (cf. SUPABASE-AUTH.md).
	loginWithSupabase = async (returnUrl: string) => {
		const redirectTo = `${window.location.origin}${returnUrl.startsWith("/") ? returnUrl : `/${returnUrl}`}`;
		return this.supabase.client.auth.signInWithOAuth({
			provider: "discord",
			options: { redirectTo },
		});
	};

	handleLogin = (returnUrl: string) => {
		window.location.href = `api/auth/discord?state=${encodeURIComponent(returnUrl)}`;
		// This will hit your API, which redirects to Discord's OAuth page.
	};

	user = signal<UserDTO | undefined>(undefined);
	userHasClan = computed(() => this.user()?.clanId !== null && this.user()?.clanId !== undefined);
	userIsAdmin = computed(() => {
		const role = this.user()?.role;
		return role !== undefined && role >= UserRole.Administrator;
	});
	userIsSuperAdmin = computed(() => {
		const role = this.user()?.role;
		return role !== undefined && role >= UserRole.SuperAdministrator;
	});
	isUserLoading = signal<boolean>(false);
	private _loadingPromise: Promise<void> | null = null;
	private _notifSub?: Subscription;

	setUser(user: UserDTO | undefined) {
		this.user.set(user);
	}

	patchUser(partial: Partial<UserDTO>) {
		const current = this.user();
		if (!current) return;

		this.user.set({ ...current, ...partial });
	}

	async reloadUser() {
		this.setUser(undefined);
		await this.loadUserIfNeeded();
	}

	async loadUserIfNeeded() {
		// Already loaded
		if (this.user() !== undefined) return;

		// Already loading
		if (this.isUserLoading()) {
			// Wait for the current loading to finish
			if (this._loadingPromise) await this._loadingPromise;
			return;
		}

		// Start loading
		this.isUserLoading.set(true);
		this._loadingPromise = (async () => {
			try {
				// /api/users/me proxy via nginx vers ranked.rosegriffon.fr :
				// user enrichi (role, clanId, hasChallonge) depuis Postgres.
				const res = await fetch("/api/users/me", { credentials: "include" });
				if (res.ok) {
					const user = await res.json();
					this.user.set(user);

					// Connect to websockets (une seule souscription : remplace l'ancienne
					// pour éviter les notifications dupliquées après reloadUser).
					this.notifWS.connect();
					this._notifSub?.unsubscribe();
					this._notifSub = this.notifWS.onNotification().subscribe((data) => {
						this._userNotifications.update((list) => [...list, data.notification]);
					});

					await this.getAndSetUserNotifications();
				} else {
					this.user.set(undefined);
					// Disconnect, just in case
					this.notifWS.disconnect();
				}
			} finally {
				this.isUserLoading.set(false);
				this._loadingPromise = null;
			}
		})();
		await this._loadingPromise;
	}

	async logOut() {
		const res = await fetch("api/auth/logout", { credentials: "include" });
		// Déconnexion Supabase best-effort (purge la session locale si présente).
		void this.supabase.client.auth.signOut().catch(() => undefined);
		this.supabaseSession.set(null);
		if (res.ok) {
			this.user.set(undefined);
			this._userNotifications.set([]);
			this._notifSub?.unsubscribe();
			this._notifSub = undefined;
			this.notifWS.disconnect();
			this.router.navigate(["/"]);
		} else {
			return undefined;
		}
	}

	query = signal<string | undefined>(undefined);
	debouncedQuery = this.debouncedSignal(this.query, 300);
	userSuggestions = computed(() => this.suggestionsResource.value());

	readonly suggestionsResource = httpResource<Suggestion[]>(
		() =>
			this.debouncedQuery()
				? {
						url: "/api/misc/suggest/users",
						params: {
							query: this.debouncedQuery()!,
						},
					}
				: undefined,
		{
			defaultValue: [],
		}
	);

	debouncedSignal<T>(input: Signal<T>, debounceMs: number): Signal<T> {
		const result = signal(input());
		effect((onCleanup) => {
			const v = input();
			const handle = setTimeout(() => result.set(v), debounceMs);
			onCleanup(() => clearTimeout(handle));
		});
		return result;
	}

	userProfileId = signal<string | undefined>(undefined);
	readonly userProfileFromRoute = httpResource<EnrichedUserDTO>(
		() =>
			this.userProfileId()
				? {
						url: `${this.USERS_API}/${this.userProfileId()}`,
					}
				: undefined,
		{
			defaultValue: undefined,
		}
	);

	userProfileLoading = computed(() => this.userProfileFromRoute.isLoading());
	userProfileValue = computed(() => this.userProfileFromRoute.value());
	userProfileError = computed(() => this.userProfileFromRoute.error());

	/**
	 * Édite bio / lien Twitch du profil connecté. Réservé au titulaire — l'API
	 * ignore tout id fourni et prend l'utilisateur du cookie d'auth. Recharge le
	 * profil affiché (`userProfileFromRoute`) en cas de succès.
	 */
	async updateMyProfile(fields: {
		bio?: string | null;
		twitchUrl?: string | null;
	}): Promise<boolean> {
		try {
			await firstValueFrom(
				this.http.put(`${this.USERS_API}/me/profile`, fields, { withCredentials: true })
			);
			this.msg.add({ severity: "success", summary: "Profil mis à jour", detail: "Enregistré." });
			this.userProfileFromRoute.reload();
			return true;
		} catch (err: any) {
			this.msg.add({
				severity: "error",
				summary: "Erreur",
				detail: err?.error?.message ?? "Impossible de mettre à jour le profil.",
			});
			return false;
		}
	}

	userClanRole = signal<ClanMemberRole | undefined>(undefined);
	getUserClanRole() {
		return this.http.get<{ role: ClanMemberRole }>("/api/clans/role");
	}

	private _userNotifications = signal<NotificationModel[]>([]);
	public userNotifications = computed(() => this._userNotifications());
	private async getUserNotifications(): Promise<NotificationModel[]> {
		try {
			const result = await firstValueFrom(
				this.http.get<{
					success: boolean;
					data?: NotificationModel[];
					error?: any;
				}>(`${this.NOTIFICATIONS_API}/me`, {
					withCredentials: true, // important si cookies d’auth
				})
			);
			return result.data ?? [];
		} catch (err: any) {
			console.error("Error fetching user notifications");
			return [];
		}
	}

	private _userNotificationsLoading = signal<boolean>(false);
	public userNotificationsLoading = computed(() => this._userNotificationsLoading());

	public async getAndSetUserNotifications() {
		this._userNotificationsLoading.set(true);
		const notifications = await this.getUserNotifications();
		this._userNotifications.set(notifications);
		this._userNotificationsLoading.set(false);
	}

	public async markUserNotificationsAsRead(notif: NotificationModel): Promise<boolean> {
		try {
			// 1. Changement de .get en .patch
			const result = await firstValueFrom(
				this.http.patch<{ success: boolean; error?: any }>(
					`${this.NOTIFICATIONS_API}/read/${notif.id}`,
					{}, // Le corps de la requête (vide ici)
					{ withCredentials: true }
				)
			);

			if (!result.success) {
				this.msg.add({
					severity: "error",
					summary: "Erreur",
					detail: result.error ?? "Impossible de marquer cette notification comme lue.",
				});
			} else {
				// 2. Mise à jour propre du Signal (approche immuable)
				this._userNotifications.update((notifs) => notifs.filter((n) => n.id !== notif.id));

				this.msg.add({
					severity: "success",
					summary: "Succès",
					detail: "Notification marquée comme lue.",
				});
			}
			return result.success;
		} catch (err: any) {
			console.error("Error marking user notifications as read", err);
			return false;
		}
	}
}
