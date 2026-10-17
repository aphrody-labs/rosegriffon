import { Component, computed, OnInit, signal, Signal, WritableSignal, inject } from "@angular/core";
import { Button, ButtonModule } from "primeng/button";

import { Panel } from "primeng/panel";
import { MenuModule } from "primeng/menu";
import { ClanDTO } from "../../core/models/Clan";
import { ClanMemberDTO, ClanMemberRole } from "../../core/models/ClanMember";
import { ClanService } from "../../shared/services/clan-service";
import { UserService } from "../../shared/services/user-service";
import { ManageMembers } from "../../shared/components/manage-members/manage-members";
import { ManageInvites } from "../../shared/components/manage-invites/manage-invites";
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { InviteMember } from "../../shared/components/invite-member/invite-member";
import { ManageApplications } from "../../shared/components/manage-applications/manage-applications";
import { ClanInfoForm } from "../../shared/components/clan-info-form/clan-info-form";

@Component({
	selector: "app-clan-dashboard",
	imports: [
		Button,
		ButtonModule,
		MenuModule,
		Panel,
		ManageMembers,
		ManageInvites,
		InviteMember,
		ManageApplications,
		ClanInfoForm,
	],
	templateUrl: "./clan-dashboard.html",
	styleUrl: "./clan-dashboard.css",
})
export class ClanDashboard implements OnInit {
	private clanService = inject(ClanService);
	private userService = inject(UserService);

	clan: ClanDTO | undefined;
	clanMembers: Signal<ClanMemberDTO[]>;
	areMembersLoading: Signal<boolean>;
	areInvitesLoading: Signal<boolean>;
	areApplicationsLoading: Signal<boolean>;
	showInviteDialog: WritableSignal<boolean> = signal<boolean>(false);

	// Le chef d'équipe (Président/Captain) du clan et les admins du site peuvent éditer
	// les infos du clan (logo, nom, tag, bio, réseaux, recrutement). Rôle de l'utilisateur
	// courant renseigné par inClanGuard (ClanMemberRole.SubCaptain requis pour accéder à
	// cette page) — cf. verification côté backend dans ClansController.updateClanInfo.
	canEditInfo = computed(
		() =>
			this.userService.userIsAdmin() || this.userService.userClanRole() === ClanMemberRole.Captain
	);

	constructor() {
		this.clan = this.clanService.clanValue();
		this.areMembersLoading = this.clanService.membersLoading;
		this.areInvitesLoading = this.clanService.dashboardClanInvitesLoading;
		this.areApplicationsLoading = this.clanService.dashboardClanApplicationsLoading;
		this.clanMembers = this.clanService.realMembersSignal;
	}

	async ngOnInit() {
		await this.clanService.getClanMembers(this.clan?.id ?? 0);
	}

	onClanInfoSaved(updated: ClanDTO) {
		this.clan = updated;
	}

	activeTabAction: string = "Membres";

	getTabClasses(label: string): string {
		if (this.activeTabAction === label) {
			return "font-semibold";
		} else {
			return "text-surface-500 dark:text-surface-300 font-normal";
		}
	}

	async synchronize() {
		switch (this.activeTabAction) {
			case "Membres":
				return this.refreshMembers();
			case "Invitations":
				return this.refreshInvites(true);
			case "Candidatures":
				return this.refreshApplications(true);
		}
	}

	isSynchronizing = computed(
		() => this.areMembersLoading() || this.areInvitesLoading() || this.areApplicationsLoading()
	);

	async refreshMembers() {
		await this.clanService.getClanMembers(this.clan?.id ?? 0);
	}

	async refreshInvites(success: boolean) {
		if (success) await this.clanService.getAndSetDashboardInvites();
	}

	async refreshApplications(success: boolean) {
		if (success) await this.clanService.getAndSetDashboardApplications();
	}

	async openInviteDialog() {
		this.showInviteDialog.set(true);
	}

	disableSync() {
		return this.activeTabAction === "Infos";
	}

	tabs: any[] = [
		{
			icon: "pi pi-info-circle",
			label: "Infos",
			disabled: false,
		},
		{
			icon: "pi pi-user",
			label: "Membres",
			disabled: false,
		},
		{
			icon: "pi pi-envelope",
			label: "Invitations",
			disabled: false,
		},
		{
			icon: "pi pi-check-square",
			label: "Candidatures",
			disabled: false,
		},
	];
}
