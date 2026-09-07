import { Component } from "@angular/core";

import { environment } from "../../../../environments/environment";

@Component({
	selector: "app-footer",
	imports: [],
	templateUrl: "./footer.html",
	styleUrl: "./footer.css",
})
export class Footer {
	currentYear = new Date().getFullYear();
	links = environment.links;
}
