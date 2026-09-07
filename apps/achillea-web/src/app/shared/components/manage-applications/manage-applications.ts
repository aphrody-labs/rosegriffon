import { Component, OnInit, signal, Signal, inject } from "@angular/core";
import { ClanApplicationDTO, ClanInviteDTO } from "../../../core/models/Clan";
import { Column } from "../../../core/models/Column";
import { ClanService } from "../../services/clan-service";
import { UserService } from "../../services/user-service";
import { MessageService } from "primeng/api";
import { ClanMemberRole } from "../../../core/models/ClanMember";
import { TableModule } from "primeng/table";
import { Avatar } from "primeng/avatar";
import { Tag } from "primeng/tag";
import { getEloImagePath, sqlDateToUsableDate } from "../../../core/helpers/misc";
import { DatePipe } from "@angular/common";
import { Button, ButtonDirective, ButtonIcon } from "primeng/button";
import { Dialog } from "primeng/dialog";

@Component({
	selector: "app-manage-applications",
	imports: [TableModule, Avatar, Tag, DatePipe, ButtonDirective, ButtonIcon, Dialog, Button],
	templateUrl: "./manage-applications.html",
	styleUrl: "./manage-applications.css",
})
export class ManageApplications implements OnInit {
	private clanService = inject(ClanService);
	private userService = inject(UserService);
	private msg = inject(MessageService);

	clanApplications: Signal<ClanApplicationDTO[]>;
	clanApplicationsAreLoading: Signal<boolean>;
	applicationsColumns: Column[] = [];
	selectedApplication: ClanApplicationDTO | undefined;
	decision: boolean | undefined;
	showDecisionsDialog = signal(false);
	decisionLoading = signal<boolean>(false);

	constructor() {
		this.clanApplicationsAreLoading = this.clanService.dashboardClanApplicationsLoading;
		this.clanApplications = this.clanService.dashboardClanApplications;
	}

	async ngOnInit() {
		this.applicationsColumns = [
			{ field: "user", header: "Invité" },
			{ field: "rank", header: "Rang" },
			{ field: "level", header: "Niveau" },
			{ field: "tags", header: "En qualité de" },
			{ field: "date", header: "Invité le" },
			{ field: "decision", header: "" },
		];

		await this.clanService.getAndSetDashboardApplications();
	}

	sortApplicationsByDate(invites: ClanApplicationDTO[]): ClanApplicationDTO[] {
		return [...invites].sort((a, b) => {
			const dateA = new Date(a.createdAt).getTime();
			const dateB = new Date(b.createdAt).getTime();
			return dateA - dateB; // oldest first
		});
	}

	canDecide() {
		const currentUserRole = this.userService.userClanRole() ?? -1;

		return currentUserRole >= ClanMemberRole.SubCaptain;
	}

	decisionDialog(event: any, applicationDTO: ClanApplicationDTO, decision: boolean) {
		this.selectedApplication = applicationDTO;
		this.decision = decision;
		this.showDecisionsDialog.set(true);
	}

	getDecisionHeaderString() {
		if (this.decision) {
			return "Confirmation d'Acceptation";
		}
		return "Confirmation de Refus";
	}

	getDecisionBodyString() {
		const applicationDTO = this.selectedApplication;
		if (applicationDTO && this.decision) {
			return `Souhaitez-vous vraiment accepter la candidature de ${applicationDTO.user.username} ?`;
		}
		if (applicationDTO && !this.decision) {
			return `Souhaitez-vous vraiment rejeter la candidature de ${applicationDTO.user.username} ?`;
		}
		return "Erreur lors du chargement de la Candidature, veuillez réessayer.";
	}

	onDialogClose() {
		this.selectedApplication = undefined;
		this.decision = undefined;
	}

	async confirmApplicationDecision() {
		const decision = this.decision;
		if (this.selectedApplication && decision !== undefined) {
			this.decisionLoading.set(true);
			decision
				? await this.clanService.acceptApplication(this.selectedApplication)
				: await this.clanService.rejectApplication(this.selectedApplication);
			await this.clanService.getAndSetDashboardApplications();
		} else {
			this.msg.add({
				severity: "error",
				summary: "Erreur",
				detail: "Impossible de traiter cette action.",
			});
		}
		this.showDecisionsDialog.set(false);
		this.decisionLoading.set(false);
	}

	protected readonly getEloImagePath = getEloImagePath;
	protected readonly sqlDateToUsableDate = sqlDateToUsableDate;
}
