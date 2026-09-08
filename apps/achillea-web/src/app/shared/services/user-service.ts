import { computed, effect, Injectable, Signal, signal, inject } from "@angular/core";
import { HttpClient, httpResource } from "@angular/common/http";
import { Suggestion, UserRole } from "../../core/models/Suggestion";
import { Router } from "@angular/router";
import { EnrichedUserDTO } from "../../core/models/User";
import { ClanMemberRole } from "../../core/models/ClanMember";
import { NotificationSocketService } from "./notification-socket-service";
import { firstValueFrom, Subscription } from "rxjs";
import { MessageService } from "primeng/api";
import { NotificationModel } from "../../core/models/Notification";
import { AuthSessionService } from "../../core/auth/auth-session.service";
import type { AuthUser } from "../../core/auth/auth.models";

export type UserDTO = AuthUser;

@Injectable({
	providedIn: "root",
})
export class UserService {
	private http = inject(HttpClient);
	private router = inject(Router);
	private notifWS = inject(NotificationSocketService);
	private msg = inject(MessageService);
	private auth = inject(AuthSessionService);

	private readonly USERS_API = "/api/users";
	private readonly NOTIFICATIONS_API = "/api/notifications";

	handleLogin = (returnUrl: string) => {
		this.auth.login(returnUrl);
	};

	readonly user = this.auth.user;
	readonly authStatus = this.auth.status;
	userHasClan = computed(() => this.user()?.clanId !== null && this.user()?.clanId !== undefined);
	userIsAdmin = computed(() => {
		const role = this.user()?.role;
		return role !== undefined && role >= UserRole.Administrator;
	});
	userIsSuperAdmin = computed(() => {
		const role = this.user()?.role;
		return role !== undefined && role >= UserRole.SuperAdministrator;
	});
	isUserLoading = computed(() => this.authStatus() === "loading");
	private _notifSub?: Subscription;

	patchUser(partial: Partial<UserDTO>) {
		this.auth.patchUser(partial);
	}

	async reloadUser() {
		this.auth.invalidate();
		await this.loadUserIfNeeded();
	}

	async loadUserIfNeeded() {
		const user = await this.auth.loadUser();
		if (!user) {
			this._notifSub?.unsubscribe();
			this._notifSub = undefined;
			this.notifWS.disconnect();
			return;
		}

		await this.notifWS.connect();
		if (!this._notifSub) {
			this._notifSub = this.notifWS.onNotification().subscribe((data) => {
				this._userNotifications.update((list) => [...list, data.notification]);
			});
			await this.getAndSetUserNotifications();
		}
	}

	async logOut() {
		const loggedOut = await this.auth.logout();
		if (loggedOut) {
			this._userNotifications.set([]);
			this._notifSub?.unsubscribe();
			this._notifSub = undefined;
			this.notifWS.disconnect();
			await this.router.navigate(["/"]);
		} else {
			this.msg.add({
				severity: "error",
				summary: "Déconnexion impossible",
				detail: "Réessaie dans quelques instants.",
			});
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
