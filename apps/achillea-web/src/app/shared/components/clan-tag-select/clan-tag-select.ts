import { Component, Input } from "@angular/core";
import { ClanMemberDistinction, ClanMemberDistinctionName } from "../../../core/models/ClanMember";
import { FloatLabel } from "primeng/floatlabel";
import { MultiSelect } from "primeng/multiselect";
import { FormControl, FormsModule, ReactiveFormsModule } from "@angular/forms";

@Component({
	selector: "app-clan-tag-select",
	imports: [FloatLabel, MultiSelect, FormsModule, ReactiveFormsModule],
	templateUrl: "./clan-tag-select.html",
	styleUrl: "./clan-tag-select.css",
})
export class ClanTagSelect {
	@Input({ required: true }) distinctionsFormControl!: FormControl; // optional initial values

	distinctions = Object.values(ClanMemberDistinction).map((distinction) => ({
		label: ClanMemberDistinctionName[distinction],
		value: distinction,
	}));
}
