import { Component, OnInit, computed, effect, inject, signal } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { RouterLink } from "@angular/router";
import { Card } from "primeng/card";
import { SelectButton } from "primeng/selectbutton";
import { ProgressSpinner } from "primeng/progressspinner";

import { RankedService } from "../../shared/services/ranked-service";
import { UserService } from "../../shared/services/user-service";
import { MatchMode } from "../../core/models/Ranked";
import { getEloImagePath } from "../../core/helpers/misc";
import { TierDistribution } from "../../shared/components/tier-distribution/tier-distribution";

@Component({
	selector: "app-ranked-tiers",
	standalone: true,
	imports: [
		CommonModule,
		FormsModule,
		RouterLink,
		Card,
		SelectButton,
		ProgressSpinner,
		TierDistribution,
	],
	templateUrl: "./ranked-tiers.html",
	styleUrl: "./ranked-tiers.css",
})
export class RankedTiers implements OnInit {
	private ranked = inject(RankedService);
	private userSvc = inject(UserService);

	readonly tiers = this.ranked.tiers;
	readonly profile = this.ranked.profile;
	readonly loading = signal<boolean>(false);

	readonly modeOptions = [
		{ label: "1v1", value: MatchMode.ONE_VS_ONE },
		{ label: "2v2", value: MatchMode.TWO_VS_TWO },
	];
	readonly selectedMode = signal<MatchMode>(MatchMode.ONE_VS_ONE);

	readonly totalPlayers = computed(() =>
		this.tiers().reduce((acc, t) => acc + (t.playerCount ?? 0), 0)
	);

	// Si le user est authentifie + a un profil ELO, on highlight la card de
	// son tier courant. Sinon retourne null.
	readonly myTierKey = computed(() => this.profile()?.tier?.key ?? null);

	constructor() {
		effect(() => {
			const mode = this.selectedMode();
			this.loading.set(true);
			// Parallel : tiers (publique) + profile (auth, best-effort) en 1 RTT.
			void Promise.all([this.ranked.loadTiers(mode), this.ranked.loadProfile(mode)]).finally(() =>
				this.loading.set(false)
			);
		});
	}

	async ngOnInit(): Promise<void> {
		await this.userSvc.loadUserIfNeeded();
	}

	getImage(key: string): string {
		return getEloImagePath(key);
	}

	gradient(g: string[] | undefined): string {
		if (!g || g.length < 2) return "linear-gradient(135deg, #555, #222)";
		return `linear-gradient(135deg, ${g.join(", ")})`;
	}

	tierShare(count: number): number {
		const total = this.totalPlayers();
		if (total === 0) return 0;
		return Math.round((count / total) * 1000) / 10;
	}

	isMyTier(key: string): boolean {
		const my = this.myTierKey();
		return my != null && my === key;
	}
}
