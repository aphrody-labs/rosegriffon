import { Component, input, Input, OnInit, signal, Signal, inject } from "@angular/core";
import {
	ClanMemberDistinction,
	ClanMemberDTO,
	ClanMemberRole,
	clanMemberRoleLabel,
	sortClanMembers as sortMembersByRank,
} from "../../../core/models/ClanMember";
import { Column } from "../../../core/models/Column";
import { UserService } from "../../services/user-service";
import { Avatar } from "primeng/avatar";
import { DatePipe } from "@angular/common";
import { TableModule } from "primeng/table";
import { Tag } from "primeng/tag";
import { Router } from "@angular/router";
import { Button, ButtonDirective, ButtonIcon } from "primeng/button";
import { Menu } from "primeng/menu";
import { MenuItem, MessageService } from "primeng/api";
import { Dialog } from "primeng/dialog";
import { ClanService } from "../../services/clan-service";
import { ClanRoleSelect } from "../clan-role-select/clan-role-select";
import { ClanTagSelect } from "../clan-tag-select/clan-tag-select";
import { FormControl, FormsModule, ReactiveFormsModule, Validators } from "@angular/forms";
import { IftaLabel } from "primeng/iftalabel";
import { Textarea } from "primeng/textarea";
import { getEloImagePath, sqlDateToUsableDate } from "../../../core/helpers/misc";

@Component({
	selector: "app-manage-members",
	imports: [
		Avatar,
		DatePipe,
		TableModule,
		Tag,
		ButtonDirective,
		ButtonIcon,
		Menu,
		Button,
		Dialog,
		ClanRoleSelect,
		ClanTagSelect,
		FormsModule,
		ReactiveFormsModule,
		IftaLabel,
		Textarea,
	],
	templateUrl: "./manage-members.html",
	styleUrl: "./manage-members.css",
})
export class ManageMembers implements OnInit {
	userService = inject(UserService);
	private router = inject(Router);
	private clanService = inject(ClanService);
	private msg = inject(MessageService);

	clanMembers = input.required<ClanMemberDTO[]>();
	@Input() areMembersLoading: Signal<boolean> = signal(false);
	memberColumns: Column[] = [];
	selectedMember?: ClanMemberDTO;
	editedSelectedMember?: ClanMemberDTO;
	showKickModal: boolean = false;
	managingMember = signal(false);
	memberItems: MenuItem[] = [];
	kickReasonControl = new FormControl<string>("", [Validators.required, Validators.minLength(3)]);
	distinctionsControl = new FormControl<ClanMemberDistinction[]>(
		[],
		[Validators.required, Validators.minLength(1)]
	);

	async ngOnInit() {
		this.memberColumns = [
			{ field: "user", header: "Utilisateur" },
			{ field: "role", header: "Rôle" },
			{ field: "tags", header: "Tags" },
			{ field: "fame", header: "Gloire" },
			{ field: "arrived", header: "Arrivé le" },
			{ field: "lastInteract", header: "Actif le" },
			{ field: "level", header: "Niveau" },
			{ field: "rank", header: "Rang" },
			{ field: "edit", header: "" },
		];

		this.buildMenu();
		this.distinctionsControl.valueChanges.subscribe((distinctions) => {
			if (this.editedSelectedMember) {
				this.editedSelectedMember.distinctions = distinctions ?? [];
			}
		});
	}

	buildMenu() {
		this.memberItems = [
			{
				label: "Actions possibles",
				items: [
					{
						label: "Profil Membre",
						icon: "pi pi-user",
						command: () => this.router.navigate(["/users", this.selectedMember?.user.id]),
					},
					{
						label: "Editer Membre",
						icon: "pi pi-briefcase",
						command: () => this.manageMember(),
						disabled: this.isHigherOrSameRankedMemberSelected() && !this.isPresident(),
					},
					{
						label: "Exclure",
						icon: "pi pi-ban",
						command: () => (this.showKickModal = true),
						disabled: !this.canKickMember(),
					},
				],
			},
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

	manageMember() {
		this.editedSelectedMember = structuredClone(this.selectedMember);
		const distinctions = this.editedSelectedMember?.distinctions as ClanMemberDistinction[];
		this.distinctionsControl.setValue(distinctions ?? []);
		this.managingMember.set(true);
	}

	openMemberMenu(event: Event, menu: Menu, member: ClanMemberDTO) {
		// If the same menu for the same member is open → close it
		if (menu.overlayVisible && this.selectedMember?.user.id === member.user.id) {
			this.selectedMember = undefined;
			menu.hide();
			return;
		}

		this.endEdition();
		this.selectedMember = member;
		this.buildMenu();
		menu.show(event);
	}

	endEdition() {
		this.managingMember.set(false);
		this.editedSelectedMember = undefined;
		this.distinctionsControl.reset();
	}

	onDialogClose() {
		this.selectedMember = undefined;
	}

	kickLoading = signal<boolean>(false);

	async kickMember() {
		if (this.selectedMember?.user) {
			this.kickLoading.set(true);
			const res = await this.clanService.kickMember(
				this.selectedMember.user.id,
				this.kickReasonControl.value ?? ""
			);
			if (!res.success) {
				this.msg.add({
					severity: "error",
					summary: "Erreur",
					detail: res.error ?? "Impossible d’exclure ce membre.",
				});
			} else {
				this.msg.add({
					severity: "success",
					summary: "Membre exclu",
					detail: `${this.selectedMember.user.username} a été exclu avec succès.`,
				});
			}
		} else {
			this.msg.add({
				severity: "error",
				summary: "Erreur",
				detail: "Impossible d’exclure ce membre.",
			});
		}
		this.showKickModal = false;
		this.kickLoading.set(false);
	}

	// Success => clear selected member & editedMember
	async saveMemberChanges() {
		if (!this.editedSelectedMember) {
			return this.msg.add({
				severity: "error",
				summary: "Erreur",
				detail: "Mise à jour impossible, sélection manquante.",
			});
		}
		const result = await this.clanService.updateMember(this.editedSelectedMember);
		if (result.success && result.members) {
			this.msg.add({
				severity: "success",
				summary: "Membre mis à jour",
				detail: `${this.editedSelectedMember.user.username} a été mis à jour.`,
			});
			this.endEdition();
		} else {
			this.msg.add({
				severity: "error",
				summary: "Erreur",
				detail: result.error ?? "Une erreur est survenue.",
			});
		}
	}

	updateMemberRoles(event: any) {
		if (this.editedSelectedMember) {
			this.editedSelectedMember.clanRole = event;
		}
	}

	canUpdate() {
		return (
			!!this.editedSelectedMember &&
			this.editedSelectedMember?.distinctions.length >= 1 &&
			(this.editedSelectedMember?.clanRole !== this.selectedMember?.clanRole ||
				!this.haveSameValues(
					this.selectedMember?.distinctions ?? [],
					this.editedSelectedMember?.distinctions
				))
		);
	}

	canManageRole() {
		return (
			!!this.selectedMember &&
			this.selectedMember.user.id !== this.userService.user()?.id &&
			this.selectedMember.clanRole !== ClanMemberRole.Captain
		);
	}

	canKickMember() {
		return !this.isSelfSelected() && !this.isHigherOrSameRankedMemberSelected();
	}

	isSelfSelected() {
		return !!this.selectedMember && this.selectedMember.user.id === this.userService.user()?.id;
	}

	isPresident() {
		return this.userService.userClanRole() === ClanMemberRole.Captain;
	}

	isHigherOrSameRankedMemberSelected() {
		const currentUserRole = this.userService.userClanRole() ?? -1;
		const selectedRole = this.selectedMember?.clanRole;

		return selectedRole !== undefined && selectedRole >= currentUserRole;
	}

	haveSameValues(a: any[], b: any[]) {
		if (a.length !== b.length) return false;
		const as = [...a].sort();
		const bs = [...b].sort();
		return as.every((v, i) => v === bs[i]);
	}

	protected readonly getEloImagePath = getEloImagePath;
	protected readonly sqlDateToUsableDate = sqlDateToUsableDate;
}
