import { Component, OnDestroy, OnInit, computed, effect, inject, signal } from "@angular/core";
import { CommonModule } from "@angular/common";
import { Router, RouterLink } from "@angular/router";
import { Card } from "primeng/card";
import { Button } from "primeng/button";
import { ProgressSpinner } from "primeng/progressspinner";
import { Tag } from "primeng/tag";
import { SelectButton } from "primeng/selectbutton";
import { Avatar } from "primeng/avatar";
import { Dialog } from "primeng/dialog";
import { InputText } from "primeng/inputtext";
import { Tooltip } from "primeng/tooltip";
import { FormsModule } from "@angular/forms";

import { RankedService } from "../../shared/services/ranked-service";
import { RankedRoomService } from "../../shared/services/ranked-room-service";
import { UserService } from "../../shared/services/user-service";
import { MatchMode } from "../../core/models/Ranked";
import { getEloImagePath } from "../../core/helpers/misc";
import { Sparkline } from "../../shared/components/sparkline/sparkline";

@Component({
	selector: "app-ranked",
	standalone: true,
	imports: [
		CommonModule,
		FormsModule,
		RouterLink,
		Card,
		Button,
		ProgressSpinner,
		Tag,
		SelectButton,
		Avatar,
		Dialog,
		InputText,
		Tooltip,
		Sparkline,
	],
	templateUrl: "./ranked.html",
	styleUrl: "./ranked.css",
})
export class Ranked implements OnInit, OnDestroy {
	private ranked = inject(RankedService);
	private room = inject(RankedRoomService);
	private user = inject(UserService);
	private router = inject(Router);

	readonly profile = this.ranked.profile;
	readonly trend = this.ranked.trend;
	readonly searching = this.room.searching;
	readonly etaSeconds = this.room.etaSeconds;
	readonly players = this.room.players;
	// Temps écoulé (s) pendant la recherche — la file est INFINIE côté serveur (on cherche
	// jusqu'à trouver un adversaire, la fenêtre elo s'élargit avec le temps), donc on affiche
	// un compteur qui monte plutôt qu'un ETA fixe trompeur.
	readonly searchElapsed = signal(0);

	// Défi direct (présence en ligne + invitations).
	readonly onlinePlayers = this.room.onlinePlayers;
	readonly pendingInvite = this.room.pendingInvite;
	readonly inviteSent = this.room.inviteSent;
	readonly inviteDialogVisible = computed(() => this.pendingInvite() !== null);

	readonly modeOptions = [
		{ label: "1v1", value: MatchMode.ONE_VS_ONE },
		{ label: "2v2", value: MatchMode.TWO_VS_TWO },
	];
	readonly selectedMode = signal<MatchMode>(MatchMode.ONE_VS_ONE);

	// Classé (ELO) / Non classé (amical, aucun impact sur le rang).
	readonly rankedOptions = [
		{ label: "Classé", value: true },
		{ label: "Non classé", value: false },
	];
	readonly selectedRanked = signal<boolean>(true);

	// Lien de défi partageable (en attente d'acceptation).
	readonly challengeLink = this.room.challengeLink;
	readonly creatingLink = signal(false);

	readonly tierLabel = computed(() => this.profile()?.tier?.key ?? "Non classé");
	readonly tierGradient = computed(() => {
		const g = this.profile()?.tier?.gradient ?? [];
		return g.length >= 2 ? `linear-gradient(135deg, ${g.join(", ")})` : "";
	});
	readonly tierImage = computed(() => getEloImagePath(this.profile()?.tier?.key));
	readonly winrate = computed(() => {
		const p = this.profile();
		if (!p || p.gamesPlayed === 0) return 0;
		return Math.round((p.wins / p.gamesPlayed) * 100);
	});

	readonly trendDeltaLabel = computed(() => {
		const t = this.trend();
		if (!t) return null;
		const sign = t.deltaPeriod > 0 ? "+" : "";
		return `${sign}${t.deltaPeriod} AP`;
	});

	readonly trendSeverity = computed<"success" | "danger" | "secondary">(() => {
		const t = this.trend();
		if (!t || t.deltaPeriod === 0) return "secondary";
		return t.deltaPeriod > 0 ? "success" : "danger";
	});

	readonly percentileLabel = computed(() => {
		const p = this.profile();
		if (!p || !p.percentile || !p.totalPlayers) return null;
		return `Top ${p.percentile}% mondial · #${p.globalRank} / ${p.totalPlayers}`;
	});

	constructor() {
		// Quand le matchmaking trouve un opposant (state=2 joueurs), on redirige
		// vers la page match. Détection signal-based via effect. On NE redirige PAS si le
		// match est déjà terminé (les joueurs persistent dans le state tant qu'on n'a pas
		// quitté la salle) → évite un rebond intempestif vers un match clos.
		effect(() => {
			const ps = this.players();
			if (ps.length >= 2 && this.searching() === false && this.room.status() !== "finished") {
				void this.router.navigate(["/ranked/match"]);
			}
		});

		// Reload profile + trend quand le mode change. Promise.all → 1 RTT cumule
		// au lieu de 2 sequentiels (~150-300ms gagnes selon mode).
		effect(() => {
			const mode = this.selectedMode();
			void Promise.all([this.ranked.loadProfile(mode), this.ranked.loadTrend(mode, 7, 20)]);
		});

		// Compteur de temps écoulé pendant la recherche (démarre/arrête avec searching()).
		// Pas de cycle : l'effect lit searching() et écrit searchElapsed (jamais relu ici).
		effect((onCleanup) => {
			this.searchElapsed.set(0);
			if (!this.searching()) return;
			const id = setInterval(() => this.searchElapsed.update((s) => s + 1), 1000);
			onCleanup(() => clearInterval(id));
		});
	}

	async ngOnInit(): Promise<void> {
		await this.user.loadUserIfNeeded();
		if (!this.user.user()) {
			void this.router.navigate(["/auth"]);
			return;
		}
		// L'effect du constructor a deja kick les loads en parallele,
		// pas besoin de reloader ici.
		// Rejoint le salon de présence pour le défi direct (liste des joueurs en ligne).
		void this.room.joinLobby(this.selectedMode());
	}

	ngOnDestroy(): void {
		// Si l'utilisateur quitte la page sans avoir matché, on annule la queue.
		if (this.searching()) {
			void this.room.cancelQueue();
		}
		// On quitte le salon de présence (sauf si un match vient d'être lancé,
		// auquel cas leaveLobby reste inoffensif).
		void this.room.leaveLobby();
	}

	async startSearch(): Promise<void> {
		await this.room.joinQueue(this.selectedMode(), this.selectedRanked());
	}

	async cancelSearch(): Promise<void> {
		await this.room.cancelQueue();
	}

	// Défie un joueur en ligne dans le mode + le type (classé/non classé) sélectionnés.
	challenge(targetUserId: string): void {
		this.room.invite(targetUserId, this.selectedMode(), this.selectedRanked());
	}

	// Réponse au dialog d'invitation reçue.
	respondInvite(accept: boolean): void {
		this.room.respondInvite(accept);
	}

	// Crée un lien de défi partageable (copie automatique dans le presse-papier).
	async createLink(): Promise<void> {
		if (this.creatingLink()) return;
		this.creatingLink.set(true);
		const link = await this.room.createChallengeLink(this.selectedMode(), this.selectedRanked());
		this.creatingLink.set(false);
		if (link) this.copyLink();
	}

	copyLink(): void {
		const link = this.challengeLink();
		if (link && navigator.clipboard) {
			void navigator.clipboard.writeText(link.url);
		}
	}

	async cancelLink(): Promise<void> {
		await this.room.cancelChallengeLink();
	}
}
