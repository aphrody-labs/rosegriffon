import {
	Component,
	computed,
	effect,
	EventEmitter,
	Input,
	OnInit,
	Output,
	signal,
	inject,
} from "@angular/core";
import { COUNTRIES, Country, LanguageService } from "../../services/language-service";
import { Select } from "primeng/select";
import { FormsModule } from "@angular/forms";
import { PrimeTemplate } from "primeng/api";
import { FloatLabel } from "primeng/floatlabel";
import { MultiSelect } from "primeng/multiselect";

@Component({
	selector: "app-language-select",
	imports: [Select, FormsModule, PrimeTemplate, FloatLabel, MultiSelect],
	templateUrl: "./language-select.html",
	styleUrl: "./language-select.css",
})
export class LanguageSelect implements OnInit {
	private svc = inject(LanguageService);

	@Output() singleSelectionChange = new EventEmitter<Country>();
	@Output() multiSelectionChange = new EventEmitter<Country[]>();
	@Input() mode: "single" | "multiple" = "single";
	private _originLanguage = signal<Country | null>(null);
	@Input()
	set originLanguage(lang: Country | null) {
		this._originLanguage.set(lang);
	}
	get originLanguage() {
		return this._originLanguage();
	}
	languages: Country[] = COUNTRIES;
	selected?: Country;
	multiSelected: Country[] = [];

	constructor() {
		effect(() => {
			const required = this._originLanguage();
			if (!required) return;

			// Add required language if it's not already selected
			const current = this.multiSelected;
			const found = current.some((lang) => lang.code === required.code);

			if (!found) {
				this.multiSelected = [...this.multiSelected, required];
				this.multiSelectionChange.emit(this.multiSelected);
			}
		});
	}

	ngOnInit() {}

	onChange(lang: Country) {
		this.selected = lang;
		this.singleSelectionChange.emit(lang);
	}

	onMultiChange() {
		if (this._originLanguage()) {
			if (!this.multiSelected.some((opt) => opt.code === this._originLanguage()!.code)) {
				this.multiSelected = [this._originLanguage()!, ...this.multiSelected];
			}
		}

		this.multiSelectionChange.emit(this.multiSelected);
	}

	onMultiClear() {
		if (this._originLanguage()) {
			this.multiSelected = [this._originLanguage()!];
		} else {
			this.multiSelected = [];
		}
		this.multiSelectionChange.emit(this.multiSelected);
	}
}
