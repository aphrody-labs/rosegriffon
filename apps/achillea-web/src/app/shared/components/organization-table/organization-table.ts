import { Component, input, OnInit, Signal, inject } from "@angular/core";
import { UserService } from "../../services/user-service";
import { MessageService } from "primeng/api";
import { OrganizationService } from "../../services/organization-service";
import { OrganizationDTO } from "../../../core/models/Organization";
import { Column } from "../../../core/models/Column";
import { LanguageService } from "../../services/language-service";
import { Mode } from "../../../core/models/Forms";
import { Avatar } from "primeng/avatar";
import { Button } from "primeng/button";
import { DatePipe } from "@angular/common";
import { TableModule } from "primeng/table";
import { Tag } from "primeng/tag";
import { getEloImagePath, sqlDateToUsableDate } from "../../../core/helpers/misc";
import { RouterLink } from "@angular/router";

@Component({
	selector: "app-organization-table",
	imports: [Avatar, DatePipe, TableModule, Tag, RouterLink, Button, Button],
	templateUrl: "./organization-table.html",
	styleUrl: "./organization-table.css",
})
export class OrganizationTable implements OnInit {
	private orgService = inject(OrganizationService);
	private userService = inject(UserService);
	private msg = inject(MessageService);
	protected lgSvc = inject(LanguageService);

	mode = input.required<Mode>();

	organizations: Signal<OrganizationDTO[]>;
	organizationsAreLoading: Signal<boolean>;
	tableColumns: Column[] = [];

	constructor() {
		this.organizationsAreLoading = this.orgService.dashboardPendingOrganizationsLoading;
		this.organizations = this.orgService.dashboardPendingOrganizations;
	}

	async ngOnInit() {
		this.tableColumns = [
			{ field: "identity", header: "Identité" },
			{ field: "owner", header: "Propriétaire" },
			{ field: "origin", header: "Nationalité" },
			{ field: "creationDate", header: "Créée le" },
			{ field: "action", header: "" },
		];

		await this.orgService.getAndSetDashboardOrganizations();
	}

	sortOrganizationsByDate(organizations: OrganizationDTO[]): OrganizationDTO[] {
		return [...organizations].sort((a, b) => {
			const dateA = new Date(a.createdAt ?? new Date()).getTime();
			const dateB = new Date(b.createdAt ?? new Date()).getTime();
			return dateA - dateB; // oldest first
		});
	}

	protected readonly getEloImagePath = getEloImagePath;
	protected readonly sqlDateToUsableDate = sqlDateToUsableDate;
	protected readonly Mode = Mode;
}
