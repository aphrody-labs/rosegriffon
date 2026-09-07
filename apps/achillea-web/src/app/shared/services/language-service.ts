import { Injectable } from "@angular/core";

export interface Country {
	code: string; // ex. "fra"
	language: string; // ex. "French"
	flag: string; // URL SVG du drapeau
	name: string;
}

export const COUNTRIES: Country[] = [
	{ code: "fr", language: "Français", name: "France", flag: "flags/flag_fr.svg" },
	{ code: "en", language: "Anglais", name: "Royaume-Uni", flag: "flags/flag_en.svg" },
	{ code: "es", language: "Espagnol", name: "Espagne", flag: "flags/flag_sp.svg" },
	{ code: "de", language: "Allemand", name: "Allemagne", flag: "flags/flag_de.svg" },
	{ code: "it", language: "Italien", name: "Italie", flag: "flags/flag_it.svg" },
	{ code: "pt", language: "Portugais", name: "Portugal", flag: "flags/flag_pt.svg" },
	{ code: "jp", language: "Japonais", name: "Japon", flag: "flags/flag_jp.svg" },
];

@Injectable({
	providedIn: "root",
})
export class LanguageService {
	getLanguageFromCode(code: string): Country | null {
		return COUNTRIES.find((lang) => lang.code === code.toLowerCase()) ?? null;
	}
}
