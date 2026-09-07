import { Component, Input, OnInit, signal, Signal, inject } from "@angular/core";
import { ClanDTO, ClanState } from "../../../core/models/Clan";
import {
	ClanMemberDistinction,
	ClanMemberDTO,
	ClanMemberRole,
	ClanMemberRoleName,
	distinctionPriority,
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

	getMemberRoleName(memberRole: ClanMemberRole) {
		return ClanMemberRoleName[memberRole];
	}

	sortClanMembers(members: ClanMemberDTO[]): ClanMemberDTO[] {
		return [...members].sort((a, b) => {
			// 🔹 1. Compare by role (Captain first → higher number first)
			if (a.clanRole !== b.clanRole) {
				return b.clanRole - a.clanRole;
			}

			// 🔹 2. Compare by distinction (Staff > Player > Artist > Content Creator)
			const getDistinctionScore = (m: ClanMemberDTO): number => {
				// Each member can have multiple distinctions
				const scores = m.distinctions.map((d) => {
					// The distinctionPriority keys are in English ("Staff", "Player", etc.),
					// but your enum values are in French ("Staff", "Joueur", "Artiste", "Créateur de contenu")
					// → so we normalize here:
					const translated = this.translateDistinctionToKey(d as ClanMemberDistinction);
					return distinctionPriority[translated] ?? 999;
				});
				return Math.min(...scores);
			};

			return getDistinctionScore(a) - getDistinctionScore(b);
		});
	}

	/** Converts enum values like "Joueur" -> "Player" to match priority map */
	translateDistinctionToKey(distinction: ClanMemberDistinction): keyof typeof distinctionPriority {
		switch (distinction) {
			case ClanMemberDistinction.Staff:
				return "Staff";
			case ClanMemberDistinction.Player:
				return "Player";
			case ClanMemberDistinction.Artist:
				return "Artist";
			case ClanMemberDistinction.ContentCreator:
				return "Content Creator";
			default:
				return "Player";
		}
	}

	getDate(dateStr: string) {
		return new Date(dateStr);
	}

	protected readonly getEloImagePath = getEloImagePath;
}
