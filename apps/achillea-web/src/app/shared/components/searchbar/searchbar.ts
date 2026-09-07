import { Component, computed, effect, Input, Signal, signal, inject } from "@angular/core";
import { UserService } from "../../services/user-service";
import { httpResource } from "@angular/common/http";
import { Suggestion } from "../../../core/models/Suggestion";
import { IconField } from "primeng/iconfield";
import { AutoComplete } from "primeng/autocomplete";
import { FormControl, FormsModule, ReactiveFormsModule } from "@angular/forms";
import { Tag } from "primeng/tag";
import { InputIcon } from "primeng/inputicon";
import { getEloImagePath } from "../../../core/helpers/misc";
import { RouterLink } from "@angular/router";

@Component({
	selector: "app-searchbar",
	imports: [IconField, AutoComplete, FormsModule, Tag, InputIcon, ReactiveFormsModule, RouterLink],
	templateUrl: "./searchbar.html",
	styleUrl: "./searchbar.css",
})
export class Searchbar {
	protected svc = inject(UserService);

	@Input({ required: true }) searchType!: "users" | "clans" | "all";
	@Input({ required: true }) behaviour!: "routerLink" | "select";
	@Input({ required: true }) multiple!: boolean;
	@Input({ required: true }) searchFormControl!: FormControl;

	query = signal<string | undefined>(undefined);
	debouncedQuery = this.debouncedSignal(this.query, 300);
	suggestions = computed(() => this.suggestionsResource.value());

	readonly suggestionsResource = httpResource<Suggestion[]>(
		() =>
			this.debouncedQuery()
				? {
						url: `/api/misc/suggest/${this.searchType}`,
						params: {
							query: this.debouncedQuery()!,
						},
					}
				: undefined,
		{
			defaultValue: [],
		}
	);

	debouncedSignal<T>(input: Signal<T>, debounceMs: number): Signal<T> {
		const result = signal(input());
		effect((onCleanup) => {
			const v = input();
			const handle = setTimeout(() => result.set(v), debounceMs);
			onCleanup(() => clearTimeout(handle));
		});
		return result;
	}

	getPlaceholder() {
		switch (this.searchType) {
			case "users":
				return "Cherche un Joueur";
			case "clans":
				return "Cherche un Clan";
			default:
				return "Cherche un Joueur ou un Clan";
		}
	}

	getRouterLinkUrl(suggestion: Suggestion) {
		if (this.behaviour === "select") return null;
		return suggestion.type === "clan" ? `/clans/${suggestion.id}` : `/users/${suggestion.id}`;
	}

	protected readonly getEloImagePath = getEloImagePath;
}
