import { Component, OnInit, signal, inject } from "@angular/core";
import { RouterOutlet } from "@angular/router";
import { Location } from "@angular/common";
import { MessageService } from "primeng/api";
import { Header } from "./shared/components/header/header";
import { Footer } from "./shared/components/footer/footer";
import { Toast } from "primeng/toast";
import { PrimeNG } from "primeng/config";
import { TranslateService } from "@ngx-translate/core";

@Component({
	selector: "app-root",
	imports: [RouterOutlet, Header, Footer, Toast],
	templateUrl: "./app.html",
	styleUrl: "./app.css",
})
export class App implements OnInit {
	private config = inject(PrimeNG);
	private translateService = inject(TranslateService);
	private messageService = inject(MessageService);
	private location = inject(Location);

	protected readonly title = signal("achillea-web");

	ngOnInit() {
		this.translateService.setDefaultLang("fr");
		this.translateService.use("fr");
		this.translateToPrimeNG();
		this.showAuthNotice();
	}

	/**
	 * Retour du callback Discord : `?auth=denied` (autorisation refusée) ou
	 * `?auth=error` (échec de l'échange). On affiche un message puis on nettoie
	 * l'URL pour que le paramètre ne survive pas à un rafraîchissement.
	 */
	private showAuthNotice() {
		if (typeof window === "undefined") return;

		const url = new URL(window.location.href);
		const notice = url.searchParams.get("auth");
		if (notice !== "denied" && notice !== "error") return;

		this.messageService.add(
			notice === "denied"
				? {
						summary: "Connexion annulée",
						detail: "L'autorisation Discord a été refusée.",
						severity: "warn",
						life: 6000,
					}
				: {
						summary: "Connexion impossible",
						detail: "La connexion Discord a échoué, réessayez dans un instant.",
						severity: "error",
						life: 8000,
					}
		);

		url.searchParams.delete("auth");
		this.location.replaceState(`${url.pathname}${url.search}${url.hash}`);
	}

	translateToPrimeNG() {
		this.translateService.stream("fr").subscribe((res) => {
			this.config.setTranslation(res);
		});
	}
}
