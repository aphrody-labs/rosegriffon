import { Component, OnInit, signal, inject } from "@angular/core";
import { RouterOutlet } from "@angular/router";
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

	protected readonly title = signal("achillea-web");

	ngOnInit() {
		this.translateService.setDefaultLang("fr");
		this.translateService.use("fr");
		this.translateToPrimeNG();
	}

	translateToPrimeNG() {
		this.translateService.stream("fr").subscribe((res) => {
			this.config.setTranslation(res);
		});
	}
}
