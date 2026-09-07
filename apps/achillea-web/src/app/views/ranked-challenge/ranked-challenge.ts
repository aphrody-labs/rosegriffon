import { Component, OnInit, inject, signal } from "@angular/core";
import { CommonModule } from "@angular/common";
import { ActivatedRoute, Router } from "@angular/router";
import { Card } from "primeng/card";
import { Button } from "primeng/button";
import { Avatar } from "primeng/avatar";
import { Tag } from "primeng/tag";
import { ProgressSpinner } from "primeng/progressspinner";

import { RankedRoomService } from "../../shared/services/ranked-room-service";
import { UserService } from "../../shared/services/user-service";
import { RankedChallengePreview } from "../../core/models/Ranked";

// Page d'acceptation d'un défi par lien : /ranked/defi/:code.
// Affiche qui invite (mode + classé/non classé) puis crée le match à l'acceptation.
@Component({
	selector: "app-ranked-challenge",
	standalone: true,
	imports: [CommonModule, Card, Button, Avatar, Tag, ProgressSpinner],
	templateUrl: "./ranked-challenge.html",
})
export class RankedChallenge implements OnInit {
	private route = inject(ActivatedRoute);
	private router = inject(Router);
	private room = inject(RankedRoomService);
	private user = inject(UserService);

	readonly loading = signal(true);
	readonly accepting = signal(false);
	readonly preview = signal<RankedChallengePreview | null>(null);
	readonly notFound = signal(false);
	readonly needAuth = signal(false);
	private code = "";

	async ngOnInit(): Promise<void> {
		this.code = (this.route.snapshot.paramMap.get("code") ?? "").toUpperCase();
		await this.user.loadUserIfNeeded();
		if (!this.user.user()) {
			// Non connecté : on garde le lien pour y revenir après authentification.
			this.needAuth.set(true);
			this.loading.set(false);
			return;
		}
		const p = await this.room.previewChallenge(this.code);
		if (!p) this.notFound.set(true);
		else this.preview.set(p);
		this.loading.set(false);
	}

	goAuth(): void {
		void this.router.navigate(["/auth"], {
			queryParams: { redirect: `/ranked/defi/${this.code}` },
		});
	}

	async accept(): Promise<void> {
		if (this.accepting()) return;
		this.accepting.set(true);
		const ok = await this.room.acceptChallenge(this.code);
		this.accepting.set(false);
		if (ok) void this.router.navigate(["/ranked/match"]);
		else this.notFound.set(true);
	}

	decline(): void {
		void this.router.navigate(["/ranked"]);
	}
}
