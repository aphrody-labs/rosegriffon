import {
	Component,
	EventEmitter,
	Input,
	Output,
	signal,
	WritableSignal,
	inject,
} from "@angular/core";
import { Suggestion } from "../../../core/models/Suggestion";
import { FormControl, FormsModule, ReactiveFormsModule, Validators } from "@angular/forms";
import { Searchbar } from "../searchbar/searchbar";
import { ClanTagSelect } from "../clan-tag-select/clan-tag-select";
import { ClanMemberDistinction } from "../../../core/models/ClanMember";
import { Button } from "primeng/button";
import { Dialog } from "primeng/dialog";
import { ClanService } from "../../services/clan-service";
import { MessageService } from "primeng/api";

@Component({
	selector: "app-invite-member",
	imports: [FormsModule, Searchbar, ReactiveFormsModule, ClanTagSelect, Button, Dialog],
	templateUrl: "./invite-member.html",
	styleUrl: "./invite-member.css",
})
export class InviteMember {
	private clanSvc = inject(ClanService);
	private msg = inject(MessageService);

	@Input({ required: true }) showDialog!: WritableSignal<boolean>;
	@Output() success = new EventEmitter<boolean>();
	@Input() targetUserId: string | undefined = undefined;

	searchFormControl = new FormControl<Suggestion | undefined>(undefined, [Validators.required]);
	distinctionsFormControl = new FormControl<ClanMemberDistinction[]>(
		[],
		[Validators.required, Validators.minLength(1)]
	);

	inviteLoading = signal<boolean>(false);

	async inviteMember() {
		const distinctions = this.distinctionsFormControl.value;
		const userId = this.targetUserId ? this.targetUserId : this.searchFormControl.value?.id;
		if (distinctions && userId) {
			this.inviteLoading.set(true);
			const success = await this.clanSvc.createInvite(userId, distinctions);
			this.success.emit(success);
		} else {
			this.msg.add({
				severity: "error",
				summary: "Erreur",
				detail: "Impossible de traiter cette action.",
			});
		}
		this.showDialog.set(false);
		this.inviteLoading.set(false);
	}

	isInviteValid() {
		const isValidTarget = this.targetUserId ? !!this.targetUserId : this.searchFormControl.valid;
		return this.distinctionsFormControl.valid && isValidTarget;
	}

	onDialogClose() {
		this.searchFormControl.reset();
		this.distinctionsFormControl.reset();
	}
}
