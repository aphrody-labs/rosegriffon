import { Component, inject, OnInit } from "@angular/core";
import { Panel } from "primeng/panel";
import { Button } from "primeng/button";
import { UserService } from "../../shared/services/user-service";
import { ActivatedRoute, Router } from "@angular/router";
import { HistoryService } from "../../shared/services/history-service";
import { safeReturnUrl } from "../../core/auth/auth-session.service";

@Component({
	selector: "app-auth-page",
	imports: [Panel, Button],
	templateUrl: "./auth-page.html",
	styleUrl: "./auth-page.css",
})
export class AuthPage implements OnInit {
	private svc = inject(UserService);
	private router = inject(Router);
	private history = inject(HistoryService);
	private route = inject(ActivatedRoute);
	protected readonly authStatus = this.svc.authStatus;

	async ngOnInit() {
		await this.svc.loadUserIfNeeded();
		if (this.svc.user()) {
			const user = this.svc.user()!;
			const fallback = `/users/${encodeURIComponent(user.id)}`;
			await this.router.navigateByUrl(
				safeReturnUrl(this.route.snapshot.queryParamMap.get("returnUrl"), fallback)
			);
		}
	}

	onReturn() {
		const returnUrl = safeReturnUrl(this.history.getPreviousUrl());
		this.router.navigateByUrl(returnUrl);
	}

	onAuth() {
		// Le callback revient sur cette page : elle connaît alors l'identité et
		// peut envoyer l'utilisateur vers son profil réel.
		const url = this.route.snapshot.queryParamMap.get("returnUrl") || "/auth";
		this.svc.handleLogin(url);
	}
}
