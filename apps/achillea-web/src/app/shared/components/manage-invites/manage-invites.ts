import { Component, OnInit, signal, Signal, inject } from "@angular/core";
import { ClanService } from "../../services/clan-service";
import { ClanInviteDTO } from "../../../core/models/Clan";
import { TableModule } from "primeng/table";
import { Avatar } from "primeng/avatar";
import { Tag } from "primeng/tag";
import { Column } from "../../../core/models/Column";
import { getEloImagePath, sqlDateToUsableDate } from "../../../core/helpers/misc";
import { DatePipe } from "@angular/common";
import { Button, ButtonDirective, ButtonIcon } from "primeng/button";
import { Dialog } from "primeng/dialog";
import { ReactiveFormsModule } from "@angular/forms";
import { UserService } from "../../services/user-service";
import { ClanMemberRole } from "../../../core/models/ClanMember";
import { MessageService } from "primeng/api";

@Component({
	selector: "app-manage-invites",
	imports: [
		TableModule,
		Avatar,
		Tag,
		DatePipe,
		ButtonDirective,
		ButtonIcon,
		Button,
		Dialog,
		ReactiveFormsModule,
	],
	templateUrl: "./manage-invites.html",
	styleUrl: "./manage-invites.css",
})
export class ManageInvites implements OnInit {
	private clanService = inject(ClanService);
	private userService = inject(UserService);
	private msg = inject(MessageService);

	clanInvites: Signal<ClanInviteDTO[]>;
	clanInvitesAreLoading: Signal<boolean>;
	inviteColumns: Column[] = [];
	selectedInvite: ClanInviteDTO | undefined;
	showRevokeDialog = signal(false);
	showNotifyDialog = signal(false);
	revokeLoading = signal<boolean>(false);
	notifyLoading = signal<boolean>(false);

	constructor() {
		this.clanInvitesAreLoading = this.clanService.dashboardClanInvitesLoading;
		this.clanInvites = this.clanService.dashboardClanInvites;
	}

	async ngOnInit() {
		this.inviteColumns = [
			{ field: "user", header: "Invité" },
			{ field: "rank", header: "Rang" },
			{ field: "level", header: "Niveau" },
			{ field: "inviter", header: "Invité par" },
			{ field: "tags", header: "En qualité de" },
			{ field: "date", header: "Invité le" },
			{ field: "revoke", header: "" },
		];

		await this.clanService.getAndSetDashboardInvites();
	}

	sortInvitesByDate(invites: ClanInviteDTO[]): ClanInviteDTO[] {
		return [...invites].sort((a, b) => {
			const dateA = new Date(a.createdAt).getTime();
			const dateB = new Date(b.createdAt).getTime();
			return dateA - dateB; // oldest first
		});
	}

	canRevoke(invite: ClanInviteDTO) {
		return this.isHigherOrSameRankedMemberSelected(invite.inviter.clanRole) && !this.isPresident();
	}

	isPresident() {
		return this.userService.userClanRole() === ClanMemberRole.Captain;
	}

	isHigherOrSameRankedMemberSelected(targetRole: ClanMemberRole) {
		const currentUserRole = this.userService.userClanRole() ?? -1;
		const selectedRole = targetRole;

		return selectedRole !== undefined && selectedRole >= currentUserRole;
	}

	revokeDialog(event: any, invite: ClanInviteDTO) {
		this.selectedInvite = invite;
		this.showRevokeDialog.set(true);
	}

	onDialogClose() {
		this.selectedInvite = undefined;
	}

	async revokeInvite() {
		if (this.selectedInvite) {
			this.revokeLoading.set(true);
			await this.clanService.revokeInvite(this.selectedInvite);
			await this.clanService.getAndSetDashboardInvites();
		} else {
			this.msg.add({
				severity: "error",
				summary: "Erreur",
				detail: "Impossible de traiter cette action.",
			});
		}
		this.showRevokeDialog.set(false);
		this.revokeLoading.set(false);
	}

	notifyDialog(event: any, invite: ClanInviteDTO) {
		this.selectedInvite = invite;
		this.showNotifyDialog.set(true);
	}

	async notifyInvite() {
		if (this.selectedInvite) {
			this.notifyLoading.set(true);
			await this.clanService.notifyInvite(this.selectedInvite);
		} else {
			this.msg.add({
				severity: "error",
				summary: "Erreur",
				detail: "Impossible de traiter cette action.",
			});
		}
		this.showNotifyDialog.set(false);
		this.notifyLoading.set(false);
	}

	protected readonly sqlDateToUsableDate = sqlDateToUsableDate;
	protected readonly getEloImagePath = getEloImagePath;
}
