import { Component, EventEmitter, Output } from "@angular/core";
import { COUNTRIES, Country } from "../../services/language-service";
import { FloatLabel } from "primeng/floatlabel";
import { Select } from "primeng/select";
import { FormsModule } from "@angular/forms";
import { PrimeTemplate } from "primeng/api";

@Component({
	selector: "app-country-select",
	imports: [FloatLabel, Select, FormsModule, PrimeTemplate],
	templateUrl: "./country-select.html",
	styleUrl: "./country-select.css",
})
export class CountrySelect {
	@Output() singleSelectionChange = new EventEmitter<Country>();
	selected?: Country;
	languages: Country[] = COUNTRIES;

	constructor() {}

	onChange(lang: Country) {
		this.selected = lang;
		this.singleSelectionChange.emit(lang);
	}
}
