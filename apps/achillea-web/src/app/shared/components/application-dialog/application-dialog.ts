import { Component, Input, signal, WritableSignal, inject } from "@angular/core";
import { Button } from "primeng/button";
import { ClanTagSelect } from "../clan-tag-select/clan-tag-select";
import { Dialog } from "primeng/dialog";
import { Searchbar } from "../searchbar/searchbar";
import { ClanService } from "../../services/clan-service";
import { MessageService } from "primeng/api";
import { FormControl, Validators } from "@angular/forms";
import { Suggestion } from "../../../core/models/Suggestion";
import { ClanMemberDistinction } from "../../../core/models/ClanMember";
import { UserService } from "../../services/user-service";

@Component({
	selector: "app-application-dialog",
	imports: [Button, ClanTagSelect, Dialog, Searchbar],
	templateUrl: "./application-dialog.html",
	styleUrl: "./application-dialog.css",
})
export class ApplicationDialog {
	private clanSvc = inject(ClanService);
	private msg = inject(MessageService);
	private userService = inject(UserService);

	@Input({ required: true }) showDialog!: WritableSignal<boolean>;
	@Input() targetClanId: number | undefined = undefined;

	searchFormControl = new FormControl<Suggestion | undefined>(undefined, [Validators.required]);
	distinctionsFormControl = new FormControl<ClanMemberDistinction[]>(
		[],
		[Validators.required, Validators.minLength(1)]
	);

	applicationLoading = signal<boolean>(false);

	async applyToClan() {
		const distinctions = this.distinctionsFormControl.value;
		const clanId = this.targetClanId ? this.targetClanId : Number(this.searchFormControl.value?.id);
		if (distinctions && clanId) {
			this.applicationLoading.set(true);
			const [, autojoin] = await this.clanSvc.createApplication(clanId, distinctions);
			if (autojoin) await this.userService.reloadUser();
		} else {
			this.msg.add({
				severity: "error",
				summary: "Erreur",
				detail: "Impossible de traiter cette action.",
			});
		}
		this.showDialog.set(false);
		this.applicationLoading.set(false);
	}

	isApplicationValid() {
		const isValidTarget = this.targetClanId ? !!this.targetClanId : this.searchFormControl.valid;
		return this.distinctionsFormControl.valid && isValidTarget;
	}

	onDialogClose() {
		this.searchFormControl.reset();
		this.distinctionsFormControl.reset();
	}
}
