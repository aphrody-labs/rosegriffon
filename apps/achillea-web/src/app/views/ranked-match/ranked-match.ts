import {
	AfterViewChecked,
	Component,
	ElementRef,
	OnDestroy,
	OnInit,
	ViewChild,
	computed,
	effect,
	inject,
	signal,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { Router } from "@angular/router";
import { MessageService } from "primeng/api";
import { Card } from "primeng/card";
import { Button } from "primeng/button";
import { Tag } from "primeng/tag";
import { Avatar } from "primeng/avatar";
import { InputText } from "primeng/inputtext";
import { InputNumber } from "primeng/inputnumber";
import { Dialog } from "primeng/dialog";
import { FileUpload } from "primeng/fileupload";
import { ProgressSpinner } from "primeng/progressspinner";

import { RankedRoomService } from "../../shared/services/ranked-room-service";
import { RankedService } from "../../shared/services/ranked-service";
import { UserService } from "../../shared/services/user-service";

@Component({
	selector: "app-ranked-match",
	standalone: true,
	imports: [
		CommonModule,
		FormsModule,
		Card,
		Button,
		Tag,
		Avatar,
		InputText,
		InputNumber,
		Dialog,
		FileUpload,
		ProgressSpinner,
	],
	templateUrl: "./ranked-match.html",
	styleUrl: "./ranked-match.css",
})
export class RankedMatch implements OnInit, OnDestroy, AfterViewChecked {
	private room = inject(RankedRoomService);
	private ranked = inject(RankedService);
	private user = inject(UserService);
	private router = inject(Router);
	private msg = inject(MessageService);

	@ViewChild("chatScroll") chatScroll?: ElementRef<HTMLDivElement>;

	readonly status = this.room.status;
	readonly roomCode = this.room.roomCode;
	readonly isRanked = this.room.ranked;
	readonly chat = this.room.chat;
	readonly disputeReason = this.room.disputeReason;
	readonly summary = this.room.summary;
	readonly pendingRematch = this.room.pendingRematch;
	readonly rematchVisible = computed(() => this.pendingRematch() !== null);

	readonly chatInput = signal("");
	// Saisie du score COMPLET du point de vue du joueur (mes buts + buts adverse).
	readonly myScoreInput = signal<number>(0);
	readonly oppScoreInput = signal<number>(0);
	readonly disputeOpen = signal(false);
	// Preuve de score (capture) — partagée entre la saisie normale et le litige.
	readonly proofFile = signal<File | null>(null);
	readonly uploadingProof = signal(false);
	// Verrou anti double-envoi du score (fenêtre entre le clic et la synchro serveur).
	readonly scoreSubmitting = signal(false);
	// Abandon : confirmation + revanche proposée à l'adversaire.
	readonly surrenderConfirmVisible = signal(false);
	readonly rematchSentTo = signal<string | null>(null);

	readonly currentUser = computed(() => this.user.user());

	readonly me = computed(() => {
		const uid = this.currentUser()?.id;
		if (!uid) return undefined;
		return this.room.players().find((p) => p.userId === uid);
	});

	readonly opponent = computed(() => {
		const uid = this.currentUser()?.id;
		if (!uid) return undefined;
		return this.room.players().find((p) => p.userId !== uid);
	});

	// Affichage fixe domicile (1er joueur, team 1) / extérieur (2e joueur, team 2).
	readonly home = computed(() => this.room.players().find((p) => p.team === 1));
	readonly away = computed(() => this.room.players().find((p) => p.team === 2));
	// Le joueur courant joue-t-il à domicile ?
	readonly isHome = computed(() => this.me()?.team === 1);

	// Id du lobby (créé dès le 1er « Fin de match ») requis pour uploader une preuve.
	readonly lobbyId = computed(() => this.room.matchLobbyId());

	readonly statusLabel = computed(() => {
		switch (this.status()) {
			case "waiting":
				return "En attente";
			case "playing":
				return "En cours";
			case "scoring":
				return "Saisie du score";
			case "disputed":
				return "Contesté";
			case "finished":
				return "Terminé";
		}
	});

	private prevStatus: string = "waiting";
	private draftLoaded = false;

	constructor() {
		// Ouvre la popup de contestation dès que le serveur passe en "disputed" — TOUJOURS, même si
		// le joueur a déjà fourni une preuve proactivement pendant la saisie : il doit être informé du
		// désaccord (la popup reflète l'état « preuve envoyée » le cas échéant et propose le retour
		// au matchmaking). Ne jamais l'éjecter silencieusement.
		effect(() => {
			const s = this.status();
			if (s === "disputed" && this.prevStatus !== "disputed") {
				this.disputeOpen.set(true);
			}
			this.prevStatus = s;
		});
		// Libère le verrou d'envoi du score dès que le serveur l'a pris en compte
		// (me().submitted) ou qu'on quitte la phase de saisie.
		effect(() => {
			if (this.me()?.submitted || this.status() !== "scoring") {
				this.scoreSubmitting.set(false);
			}
		});
		// Restaure le brouillon de score saisi (résilience : un refresh en pleine saisie ne
		// perd plus les valeurs tapées). Une seule fois, dès que le code de salle est connu.
		effect(() => {
			const code = this.roomCode();
			if (!code || this.draftLoaded) return;
			this.draftLoaded = true;
			try {
				const raw = localStorage.getItem(this.draftKey(code));
				if (raw) {
					const d = JSON.parse(raw) as { my?: number; opp?: number };
					this.myScoreInput.set(Number(d.my) || 0);
					this.oppScoreInput.set(Number(d.opp) || 0);
				}
			} catch {
				// noop
			}
		});
		// Sauvegarde le brouillon à chaque frappe pendant la phase de saisie (non soumise).
		effect(() => {
			const code = this.roomCode();
			const my = this.myScoreInput();
			const opp = this.oppScoreInput();
			if (!code || this.status() !== "scoring" || this.me()?.submitted) return;
			try {
				localStorage.setItem(this.draftKey(code), JSON.stringify({ my, opp }));
			} catch {
				// noop
			}
		});
	}

	private draftKey(roomCode: string): string {
		return `ranked_score_draft_${roomCode}`;
	}

	private clearDraft(): void {
		try {
			const code = this.roomCode();
			if (code) localStorage.removeItem(this.draftKey(code));
		} catch {
			// noop
		}
	}

	ngOnInit(): void {
		// Si on arrive ici sans state Colyseus actif (ex. refresh / coupure réseau), on tente
		// de revenir dans le match en cours via l'id de salle mémorisé. Échec → retour /ranked.
		if (!this.roomCode() && this.room.players().length === 0) {
			void this.room.tryRejoinStoredMatch().then((ok) => {
				if (!ok) void this.router.navigate(["/ranked"]);
			});
		}
	}

	ngAfterViewChecked(): void {
		const el = this.chatScroll?.nativeElement;
		if (el) el.scrollTop = el.scrollHeight;
	}

	ngOnDestroy(): void {
		// Volontairement ne pas leaveMatch ici — onLeave laisse le summary visible
		// si on revient (ex: refresh). Le service gère le reset après leaveMatch().
	}

	sendChat(): void {
		const t = this.chatInput().trim();
		if (!t) return;
		this.room.sendChat(t);
		this.chatInput.set("");
	}

	// « Début de match » — confirme que ce joueur est prêt (les 2 → status playing).
	startMatch(): void {
		this.room.startMatch();
	}

	// « Fin de match » — confirme la fin côté ce joueur (asynchrone : n'attend pas l'autre).
	finishMatch(): void {
		this.room.finishMatch();
	}

	// « Abandonner » — ouvre la confirmation puis déclare forfait (l'adversaire gagne).
	askSurrender(): void {
		this.surrenderConfirmVisible.set(true);
	}

	confirmSurrender(): void {
		this.surrenderConfirmVisible.set(false);
		this.room.surrender();
	}

	// « Revanche » (écran de fin) — propose une revanche à l'adversaire via une notification
	// temps réel. On reste sur la page : l'auto-join lance le nouveau match dès l'acceptation.
	async proposeRematch(): Promise<void> {
		const s = this.summary();
		if (!s) return;
		this.rematchSentTo.set(s.opponent.displayName);
		await this.room.createChallengeLink(s.mode, s.ranked !== false, s.opponent.userId);
	}

	// Accepte une revanche reçue : quitte le match terminé puis rejoint le nouveau.
	async acceptRematch(): Promise<void> {
		const offer = this.pendingRematch();
		if (!offer) return;
		await this.room.leaveMatch();
		await this.room.acceptChallenge(offer.code);
	}

	declineRematch(): void {
		this.room.dismissRematch();
	}

	// Envoie le score complet (concordance des 2 saisies → validation, sinon litige).
	submitScore(): void {
		if (this.scoreSubmitting() || this.me()?.submitted) return;
		this.scoreSubmitting.set(true);
		this.room.submitScore(this.myScoreInput(), this.oppScoreInput());
		this.clearDraft();
	}

	onProofSelect(event: { files: File[]; currentFiles?: File[] }): void {
		// Ne pas changer le fichier pendant un upload en cours (désync UI vs fichier envoyé).
		if (this.uploadingProof()) return;
		// PrimeNG : `currentFiles` = sélection VALIDÉE (accept image/* + maxFileSize 5 Mo) ;
		// `files` = sélection BRUTE. On revalide explicitement la taille/le type : une image
		// trop lourde (screenshot téléphone > ~6 Mo) gonflerait le corps base64 du POST /dispute
		// au-delà de la limite serveur (express.text 8 Mo) → 413 → upload figé côté front.
		const file = event.currentFiles?.[0] ?? event.files?.[0] ?? null;
		if (file && (file.size > 5_000_000 || !file.type.startsWith("image/"))) {
			this.proofFile.set(null);
			this.msg.add({
				severity: "warn",
				summary: "Fichier invalide",
				detail: "Capture image de 5 Mo maximum.",
			});
			return;
		}
		this.proofFile.set(file);
	}

	// Upload de la preuve de score (saisie normale OU litige). Disponible aux 2 joueurs
	// dès que le lobby existe. Reflète l'upload dans le state Colyseus.
	async sendProof(): Promise<void> {
		const file = this.proofFile();
		// En litige, `summary` est null (pas de matchEnded) → on lit l'id du lobby exposé
		// par le state Colyseus (créé dès le 1er « Fin de match »).
		const lobbyId = this.lobbyId() || this.summary()?.lobbyId;
		if (!file || !lobbyId) return;
		// Intention FIGÉE avant l'await : status() est un signal temps réel. On ne renvoie au lobby
		// QUE si la preuve est envoyée EN litige (popup / écran contesté). Une preuve envoyée
		// proactivement pendant la saisie ne doit pas éjecter le joueur — et si un litige tombe
		// PENDANT cet upload proactif, on ne bascule pas non plus (sinon éjection perçue « crash »).
		const wasDispute = this.status() === "disputed";
		this.uploadingProof.set(true);
		const url = await this.ranked.uploadProof(lobbyId, file);
		this.uploadingProof.set(false);
		if (!url) return;
		this.room.markProofUploaded();
		this.proofFile.set(null);
		this.disputeOpen.set(false);
		// Preuve envoyée EN litige : plus rien à faire côté joueur (arbitrage 100% admin) → on le
		// ramène au matchmaking avec un message ; il sera notifié de la décision admin par un toast
		// (cf. RankedRoomService.onDisputeResolved). En saisie (hors litige), la preuve est
		// optionnelle et le match continue → on reste sur place.
		if (wasDispute) {
			this.msg.add({
				severity: "info",
				summary: "Preuve envoyée",
				detail: "Un administrateur va trancher le litige. Tu seras notifié de la décision.",
				life: 8000,
			});
			await this.backToMatchmaking();
		}
	}

	async backToMatchmaking(): Promise<void> {
		this.clearDraft();
		await this.room.leaveMatch();
		await this.router.navigate(["/ranked"]);
	}

	copyRoomCode(): void {
		const code = this.roomCode();
		if (code && navigator.clipboard) {
			void navigator.clipboard.writeText(code);
		}
	}
}
