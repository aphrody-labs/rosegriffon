import { Component, Input, OnChanges, OnInit, signal, Signal, SimpleChanges } from "@angular/core";
import {
	ClanMemberDistinction,
	ClanMemberDTO,
	ClanMemberRole,
} from "../../../core/models/ClanMember";
import { PrimeTemplate, TreeNode } from "primeng/api";
import { ActivatedRoute, RouterLink } from "@angular/router";
import { ClanService } from "../../services/clan-service";
import { UserService } from "../../services/user-service";
import { ProgressSpinner } from "primeng/progressspinner";
import { OrganizationChart } from "primeng/organizationchart";
import { Avatar } from "primeng/avatar";

@Component({
	selector: "app-clan-orgchart",
	imports: [ProgressSpinner, OrganizationChart, Avatar, RouterLink, PrimeTemplate],
	templateUrl: "./clan-orgchart.html",
	styleUrl: "./clan-orgchart.css",
})
export class ClanOrgchart implements OnChanges {
	@Input() clanMembers: ClanMemberDTO[] = [];
	@Input() areMembersLoading: Signal<boolean> = signal(false);
	data: TreeNode[] = [];

	constructor() {}

	ngOnChanges(changes: SimpleChanges) {
		if (changes["clanMembers"] && this.clanMembers?.length > 0) {
			this.createTreeNodes();
		}
	}

	createTreeNodes() {
		const staffMembers = this.clanMembers.filter(
			(m) =>
				m.distinctions.includes(ClanMemberDistinction.Staff) &&
				m.clanRole !== ClanMemberRole.Captain &&
				m.clanRole !== ClanMemberRole.SubCaptain
		);
		const staffChildren = staffMembers.map((m) => ({
			expanded: true,
			label: m.user.username,
			type: "person",
			data: {
				image: m.user.avatar,
				name: m.user.username,
				title: "Staff",
				id: m.user.id,
			},
		}));

		const viceCaptains = this.clanMembers.filter((m) => m.clanRole === ClanMemberRole.SubCaptain);
		const viceCaptainsChildren = viceCaptains.map((m) => ({
			expanded: true,
			type: "person",
			data: {
				image: m.user.avatar,
				name: m.user.username,
				title: "Vice CEO",
				id: m.user.id,
			},
		}));

		const president = this.clanMembers.find((cm) => cm.clanRole === ClanMemberRole.Captain);

		this.data = [
			{
				expanded: true,
				type: "person",
				data: {
					image: president?.user.avatar,
					name: president?.user.username,
					title: "CEO",
					id: president?.user.id,
				},
				children: [
					...viceCaptainsChildren,
					{
						expanded: true,
						label: "Staff",
						children: staffChildren,
					},
				],
			},
		];
	}
}
