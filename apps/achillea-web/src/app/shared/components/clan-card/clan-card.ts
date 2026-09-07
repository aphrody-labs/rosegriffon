import { Component, Input } from "@angular/core";
import { ClanDTO } from "../../../core/models/Clan";
import { Card } from "primeng/card";
import { PrimeTemplate } from "primeng/api";
import { Button } from "primeng/button";
import { Tooltip } from "primeng/tooltip";
import { Tag } from "primeng/tag";
import { COUNTRIES, Country } from "../../services/language-service";

@Component({
	selector: "app-clan-card",
	imports: [Card, PrimeTemplate, Tooltip, Button, Tag],
	templateUrl: "./clan-card.html",
	styleUrl: "./clan-card.css",
})
export class ClanCard {
	@Input() clan!: ClanDTO;
	languages: Country[] = COUNTRIES;

	get gradientCss(): string {
		// return `linear-gradient(0deg, ${this.clan.rank?.gradient.join(', ') ?? "#ffffff"})`;
		return `linear-gradient(0deg, #ffffff)`;
	}

	protected displayLanguageFullName(code: string) {
		return this.languages.find((l) => l.code === code)?.language;
	}
}
