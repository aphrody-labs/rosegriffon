import { Component, OnInit, signal, Signal, WritableSignal, inject } from "@angular/core";
import { ClanDTO, ClanState } from "../../core/models/Clan";
import { ClanService } from "../../shared/services/clan-service";
import { Panel } from "primeng/panel";
import { ScrollPanelModule } from "primeng/scrollpanel";
import { Button } from "primeng/button";
import { Tab, TabList, TabPanel, TabPanels, Tabs } from "primeng/tabs";
import { ClanMemberDTO } from "../../core/models/ClanMember";
import { TableModule } from "primeng/table";
import { UserService } from "../../shared/services/user-service";
import { ClanMembers } from "../../shared/components/clan-members/clan-members";
import { ClanOrgchart } from "../../shared/components/clan-orgchart/clan-orgchart";
import { ApplicationDialog } from "../../shared/components/application-dialog/application-dialog";

@Component({
	selector: "app-clan-profile",
	imports: [
		Panel,
		ScrollPanelModule,
		Button,
		Tabs,
		TabList,
		Tab,
		TabPanels,
		TabPanel,
		TableModule,
		ClanMembers,
		ClanMembers,
		ClanOrgchart,
		ApplicationDialog,
	],
	templateUrl: "./clan-profile.html",
	styleUrl: "./clan-profile.css",
})
export class ClanProfile implements OnInit {
	private clanService = inject(ClanService);
	private userService = inject(UserService);

	clan: ClanDTO | undefined;
	clanMembers: ClanMemberDTO[] = [];

	areMembersLoading: Signal<boolean>;
	showApplicationDialog: WritableSignal<boolean> = signal<boolean>(false);

	constructor() {
		this.clan = this.clanService.clanValue();
		this.areMembersLoading = this.clanService.membersLoading;
	}

	async ngOnInit() {
		this.clanMembers = await this.clanService.getClanMembers(this.clan?.id ?? 0);
	}

	disableApplicationButton() {
		return this.userService.userHasClan();
	}

	protected readonly ClanState = ClanState;
}
