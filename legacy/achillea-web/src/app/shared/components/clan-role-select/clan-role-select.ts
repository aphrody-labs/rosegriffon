import { Component, EventEmitter, Input, OnInit, Output } from "@angular/core";
import { ClanMemberRole, ClanMemberRoleName } from "../../../core/models/ClanMember";
import { FloatLabel } from "primeng/floatlabel";
import { Select } from "primeng/select";
import { FormsModule } from "@angular/forms";

@Component({
	selector: "app-clan-role-select",
	imports: [FloatLabel, Select, FormsModule],
	templateUrl: "./clan-role-select.html",
	styleUrl: "./clan-role-select.css",
})
export class ClanRoleSelect implements OnInit {
	@Input() preselectedRole?: ClanMemberRole;
	@Input() disabled = false;
	@Output() singleSelectionChange = new EventEmitter<ClanMemberRole>();
	selected?: ClanMemberRole;

	ngOnInit() {
		if (this.preselectedRole !== undefined) {
			this.selected = this.preselectedRole;
			this.roles = Object.values(ClanMemberRole)
				.filter((v): v is ClanMemberRole => typeof v === "number")
				.map((role) => ({
					label: ClanMemberRoleName[role],
					value: role,
					disabled:
						this.preselectedRole !== ClanMemberRole.Captain && role === ClanMemberRole.Captain,
				}));
		}
	}

	roles = Object.values(ClanMemberRole)
		.filter((v): v is ClanMemberRole => typeof v === "number")
		.map((role) => ({
			label: ClanMemberRoleName[role],
			value: role,
		}));

	onChange(role: ClanMemberRole) {
		this.selected = role;
		this.singleSelectionChange.emit(role);
	}
}
