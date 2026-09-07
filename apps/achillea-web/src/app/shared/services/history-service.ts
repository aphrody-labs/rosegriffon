import { Injectable, inject } from "@angular/core";
import { NavigationEnd, Router } from "@angular/router";
import { filter } from "rxjs";

@Injectable({
	providedIn: "root",
})
export class HistoryService {
	private router = inject(Router);

	private previousUrl: string | null = null;
	private currentUrl: string | null = null;

	constructor() {
		this.currentUrl = this.router.url;
		this.router.events
			.pipe(filter((event) => event instanceof NavigationEnd))
			.subscribe((event: NavigationEnd) => {
				this.previousUrl = this.currentUrl;
				this.currentUrl = event.urlAfterRedirects;
			});
	}

	getPreviousUrl() {
		return this.previousUrl ?? "";
	}

	getCurrentUrl() {
		return this.currentUrl ?? "";
	}
}
