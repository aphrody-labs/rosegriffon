import { Component, Input, OnInit, signal, Signal, inject } from "@angular/core";
import { ClanDTO, ClanState } from "../../../core/models/Clan";
import {
	ClanMemberDTO,
	ClanMemberRole,
	clanMemberRoleLabel,
	sortClanMembers as sortMembersByRank,
} from "../../../core/models/ClanMember";
import { Column } from "../../../core/models/Column";
import { ActivatedRoute, RouterLink } from "@angular/router";
import { ClanService } from "../../services/clan-service";
import { UserService } from "../../services/user-service";
import { TableModule } from "primeng/table";
import { Avatar } from "primeng/avatar";
import { DatePipe } from "@angular/common";
import { Tag } from "primeng/tag";
import { ProgressSpinner } from "primeng/progressspinner";
import { getEloImagePath } from "../../../core/helpers/misc";

@Component({
	selector: "app-clan-members",
	imports: [TableModule, RouterLink, Avatar, DatePipe, Tag, ProgressSpinner],
	templateUrl: "./clan-members.html",
	styleUrl: "./clan-members.css",
})
export class ClanMembers implements OnInit {
	userService = inject(UserService);

	@Input() clanMembers: ClanMemberDTO[] = [];
	@Input() areMembersLoading: Signal<boolean> = signal(false);
	memberColumns: Column[] = [];

	async ngOnInit() {
		this.memberColumns = [
			{ field: "user", header: "Utilisateur" },
			{ field: "role", header: "Rôle" },
			{ field: "tags", header: "Tags" },
			{ field: "fame", header: "Gloire" },
			{ field: "arrived", header: "Arrivé le" },
			{ field: "level", header: "Niveau" },
			{ field: "rank", header: "Rang" },
		];
	}

	// Libellé et tri viennent de `@rosegriffon/achillea-core` : la version locale
	// traduisait `ContentCreator` en « Content Creator », clé absente de la table
	// de priorité, ce qui reléguait ces membres en fin de liste.
	protected getMemberRoleName(memberRole: ClanMemberRole): string {
		return clanMemberRoleLabel(memberRole);
	}

	protected sortClanMembers(members: ClanMemberDTO[]): ClanMemberDTO[] {
		return sortMembersByRank(members);
	}

	getDate(dateStr: string) {
		return new Date(dateStr);
	}

	protected readonly getEloImagePath = getEloImagePath;
}
