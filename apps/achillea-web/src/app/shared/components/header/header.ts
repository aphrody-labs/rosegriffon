import { Component, computed, inject, OnInit, signal, Signal } from "@angular/core";
import { Menubar } from "primeng/menubar";
import { Avatar } from "primeng/avatar";
import { Button } from "primeng/button";
import { Ripple } from "primeng/ripple";
import { DOCUMENT, NgClass } from "@angular/common";
import { MenuItem } from "primeng/api";
import { Router, RouterLink } from "@angular/router";
import { Menu } from "primeng/menu";
import { OverlayBadgeModule } from "primeng/overlaybadge";
import { UserService } from "../../services/user-service";
import { HistoryService } from "../../services/history-service";
import { NotifPreview } from "../notif-preview/notif-preview";
import { NotificationModel } from "../../../core/models/Notification";
import { Popover } from "primeng/popover";
import { UserAvatar } from "../user-avatar/user-avatar";

@Component({
	selector: "app-header",
	imports: [
		Menubar,
		Avatar,
		Button,
		Ripple,
		NgClass,
		RouterLink,
		Menu,
		OverlayBadgeModule,
		NotifPreview,
		Popover,
		UserAvatar,
	],
	templateUrl: "./header.html",
	styleUrl: "./header.css",
})
export class Header implements OnInit {
	private router = inject(Router);
	protected svc = inject(UserService);
	private history = inject(HistoryService);

	items: MenuItem[] | undefined;
	userItems: MenuItem[] = [];
	loggedOut: MenuItem[] = [];
	badge: Signal<string | undefined> = computed(() => undefined);

	isDark = signal(true);
	themeIcon = computed(() => (this.isDark() ? "pi pi-sun" : "pi pi-moon"));

	private document = inject(DOCUMENT);

	constructor() {
		const saved = localStorage.getItem("achillea-theme");
		if (saved === "light") {
			this.isDark.set(false);
			this.applyTheme(false);
		}
	}

	toggleTheme() {
		const next = !this.isDark();
		this.isDark.set(next);
		this.applyTheme(next);
		localStorage.setItem("achillea-theme", next ? "dark" : "light");
	}

	private applyTheme(dark: boolean) {
		const el = this.document.documentElement;
		if (dark) {
			el.classList.add("p-dark");
			el.classList.remove("p-light");
		} else {
			el.classList.add("p-light");
			el.classList.remove("p-dark");
		}
	}

	async ngOnInit() {
		await this.svc.loadUserIfNeeded();

		// Navigation principale : chaque destination une seule fois (pas d'Astral
		// en top-level ET dans un sous-menu, pas d'entrées disabled « Liste/Gestion »).
		this.items = [
			{
				label: "Classé",
				icon: "pi pi-chart-bar",
				command: () => this.router.navigate(["/ranked"]),
			},
			{
				label: "Clans",
				icon: "pi pi-users",
				items: [
					{
						label: "Explorer",
						icon: "pi pi-list",
						command: () => this.router.navigate(["/clans"]),
					},
					{
						label: "Mon clan",
						icon: "pi pi-home",
						command: () => this.router.navigate(["/clans/dashboard"]),
						visible: !!(this.svc.user() && this.svc.userHasClan()),
					},
					{
						label: "Créer un clan",
						icon: "pi pi-plus",
						command: () => this.router.navigate(["/clans/create"]),
						visible: !!(this.svc.user() && !this.svc.userHasClan()),
					},
				],
			},
			{
				label: "Tournois",
				icon: "pi pi-trophy",
				items: [
					{
						label: "Tous les tournois",
						icon: "pi pi-list",
						command: () => this.router.navigate(["/events/list/tournament"]),
					},
					{
						label: "Classement & stats",
						icon: "pi pi-chart-bar",
						command: () => this.router.navigate(["/events/tournaments/circuit/ranking"]),
					},
					{
						label: "Astral League",
						icon: "pi pi-star-fill",
						command: () => this.router.navigate(["/leagues/astral"]),
					},
					{
						label: "Créer un tournoi",
						icon: "pi pi-plus",
						command: () => this.router.navigate(["/events/create/tournament"]),
						visible: !!this.svc.user(),
					},
				],
			},
			{
				label: "Guide",
				icon: "pi pi-book",
				command: () => this.router.navigate(["/guide"]),
			},
		];

		// Entrée Organisation uniquement si action utile (création) — plus de
		// sous-menu Liste/Gestion désactivés.
		if (this.svc.user()) {
			this.items.push({
				label: "Organisation",
				icon: "pi pi-building",
				command: () => this.router.navigate(["/organizations/create"]),
			});
		}

		this.userItems = [
			{
				label: "Mon profil",
				icon: "pi pi-user",
				command: () => this.router.navigate([`/users/${this.svc.user()?.id}`]),
			},
			{
				label: "Ma licence",
				icon: "pi pi-id-card",
				command: () => this.router.navigate(["/licence"]),
			},
			{
				label: "Portefeuille",
				icon: "pi pi-wallet",
				command: () => this.router.navigate(["/wallet"]),
			},
			{
				label: "Espace Admin",
				icon: "pi pi-key",
				command: () => this.router.navigate([`/admins/dashboard`]),
				visible: this.svc?.userIsAdmin(),
			},
			{ separator: true },
			{
				label: "Se déconnecter",
				icon: "pi pi-sign-out",
				command: () => this.svc.logOut(),
			},
		];

		this.loggedOut = [
			{
				label: "Se connecter",
				icon: "pi pi-sign-in",
				command: () => this.svc.handleLogin(this.history.getCurrentUrl()),
			},
		];

		this.badge = computed(() => this.svc.userNotifications().length.toString());
	}

	get newestNotifications() {
		return [...this.svc.userNotifications()].reverse().slice(0, 3);
	}

	protected getNotif(strId: string) {
		const id: number = Number(strId);
		return (
			this.svc.userNotifications().find((notification) => notification.id === id) ??
			({} as NotificationModel)
		);
	}

	get notificationItems(): MenuItem[] {
		return this.newestNotifications.map((notif) => {
			return { label: notif.id.toString() };
		});
	}

	protected async notificationHandler(notification: NotificationModel) {
		console.info(`click on ${notification.id}`);
	}
}
