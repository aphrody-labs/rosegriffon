import { Component, OnInit, signal, WritableSignal, inject } from "@angular/core";
import { CommonModule, DatePipe, DecimalPipe } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { EnrichedUserDTO } from "../../core/models/User";
import { ActivatedRoute, RouterLink } from "@angular/router";
import { UserService } from "../../shared/services/user-service";
import { TournamentsService } from "../../shared/services/tournaments-service";
import { PlayerCircuitProfile } from "../../core/models/Tournament";
import { Panel } from "primeng/panel";
import { ClanMemberRole } from "../../core/models/ClanMember";
import { getEloImagePath } from "../../core/helpers/misc";
import { InviteMember } from "../../shared/components/invite-member/invite-member";
import { Button } from "primeng/button";
import { UserAvatar } from "../../shared/components/user-avatar/user-avatar";
import { Dialog } from "primeng/dialog";
import { Textarea } from "primeng/textarea";
import { InputTextModule } from "primeng/inputtext";

@Component({
	selector: "app-user-profile",
	imports: [
		CommonModule,
		FormsModule,
		Panel,
		RouterLink,
		InviteMember,
		Button,
		DecimalPipe,
		DatePipe,
		UserAvatar,
		Dialog,
		Textarea,
		InputTextModule,
	],
	templateUrl: "./user-profile.component.html",
	styleUrl: "./user-profile.component.css",
})
export class UserProfile implements OnInit {
	private tournaments = inject(TournamentsService);
	userService = inject(UserService);

	userProfile: EnrichedUserDTO | undefined;
	showInviteDialog: WritableSignal<boolean> = signal<boolean>(false);
	disableInviteButtonSig: WritableSignal<boolean> = signal<boolean>(true);

	readonly circuit = signal<PlayerCircuitProfile | null>(null);
	readonly circuitLoading = signal<boolean>(true);

	readonly showEditDialog = signal<boolean>(false);
	readonly savingProfile = signal<boolean>(false);
	editBio = "";
	editTwitchUrl = "";

	constructor() {
		this.userProfile = this.userService.userProfileValue();
		this.userService.userProfileId.set(undefined);
	}

	async ngOnInit() {
		this.disableInviteButtonSig.set(this.disableInviteButton());

		if (this.userProfile?.id) {
			const profile = await this.tournaments.getPlayerCircuitProfile(this.userProfile.id);
			this.circuit.set(profile);
		}
		this.circuitLoading.set(false);
	}

	disableInviteButton() {
		return !!this.userProfile?.clan || !this.userService.user()?.clanId;
	}

	/** Ratio de victoires formaté ("—" si aucun match joué). */
	winrate(wins?: number, losses?: number): string {
		const total = (wins ?? 0) + (losses ?? 0);
		return total === 0 ? "—" : `${Math.round(((wins ?? 0) / total) * 100)}%`;
	}

	/** Sentinel GOAL_AVERAGE_PERFECT (999, voir @achillea/core/tournaments) -> "∞". */
	formatGoalAverage(value: number): string {
		if (value >= 999) return "∞";
		return value.toFixed(2);
	}

	get isOwnProfile(): boolean {
		return !!this.userProfile?.id && this.userProfile.id === this.userService.user()?.id;
	}

	openEditDialog(): void {
		this.editBio = this.userProfile?.bio ?? "";
		this.editTwitchUrl = this.userProfile?.twitchUrl ?? "";
		this.showEditDialog.set(true);
	}

	async saveProfile(): Promise<void> {
		this.savingProfile.set(true);
		const ok = await this.userService.updateMyProfile({
			bio: this.editBio.trim() || null,
			twitchUrl: this.editTwitchUrl.trim() || null,
		});
		this.savingProfile.set(false);
		if (ok) {
			// Optimiste : évite d'attendre le rechargement de la resource pour l'affichage.
			if (this.userProfile) {
				this.userProfile = {
					...this.userProfile,
					bio: this.editBio.trim() || null,
					twitchUrl: this.editTwitchUrl.trim() || null,
				};
			}
			this.showEditDialog.set(false);
		}
	}

	protected readonly ClanMemberRole = ClanMemberRole;
	protected readonly getEloImagePath = getEloImagePath;
}
