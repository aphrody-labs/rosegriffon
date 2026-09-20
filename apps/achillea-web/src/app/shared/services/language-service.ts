import { Injectable } from "@angular/core";
import { COUNTRIES as REFERENCE_COUNTRIES, countryByCode } from "@rosegriffon/achillea-core";
import type { Country } from "@rosegriffon/achillea-types";

// Table de référence et forme du pays : source unique dans les paquets
// Achilléa (`@…/achillea-core/reference`, `@…/achillea-types`).
export type { Country };
export const COUNTRIES: Country[] = [...REFERENCE_COUNTRIES];

@Injectable({
	providedIn: "root",
})
export class LanguageService {
	getLanguageFromCode(code: string): Country | null {
		return countryByCode(code);
	}
}
