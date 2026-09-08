import { Injectable, NgZone, inject, signal } from "@angular/core";
import { Router } from "@angular/router";
import { Client, Room } from "@colyseus/sdk";
import { MessageService } from "primeng/api";

import { environment } from "../../../environments/environment";
import { AuthSessionService } from "../../core/auth/auth-session.service";
import {
	MatchMode,
	RankedChallengeLink,
	RankedChallengePreview,
	RankedChatMessage,
	RankedMatchSummary,
	RankedPlayerView,
	MatchRoomStatus,
	RankedLobbyPlayer,
	RankedPendingInvite,
	RankedRematchOffer,
	RankedSentInvite,
} from "../../core/models/Ranked";
import { NotificationSocketService } from "./notification-socket-service";
import { UserService } from "./user-service";

// Wrapper signal-based autour du client Colyseus.
// Le state Colyseus côté serveur est défini dans apps/achillea-bot/src/ranked/rooms/MatchRoom.ts
// (cf docs/ranking.md §5).

// Clés localStorage : id de la salle (reconnexion) + snapshot d'état (affichage instantané +
// résilience si la reconnexion tarde/échoue). Le serveur reste la source de vérité.
const MATCH_ROOM_KEY = "ranked_active_room_id";
const MATCH_STATE_KEY = "ranked_match_state";

@Injectable({ providedIn: "root" })
export class RankedRoomService {
	private msg = inject(MessageService);
	private router = inject(Router);
	// Les callbacks Colyseus s'exécutent dans le handler `onmessage` du WebSocket. Selon le
	// chemin de connexion (auto-join via Socket.IO, reconnexion…), ce handler peut s'exécuter
	// HORS de la zone Angular → les `signal.set()` mettent bien à jour l'état mais NE
	// déclenchent PAS la détection de changement, donc la vue ne se rafraîchit pas (il fallait
	// recharger la page pour voir les nouveaux messages du chat / scores / statut poussés par
	// le serveur). On ré-entre explicitement dans la zone pour garantir le re-render.
	private zone = inject(NgZone);

	private client = new Client(environment.colyseusUrl);
	private queueRoom: Room | null = null;
	private matchRoom: Room | null = null;
	private lobbyRoom: Room | null = null;
	private auth = inject(AuthSessionService);

	readonly searching = signal(false);
	readonly etaSeconds = signal<number | null>(null);

	readonly roomCode = signal<string>("");
	readonly status = signal<MatchRoomStatus>("waiting");
	readonly ranked = signal<boolean>(true); // match courant classé / non classé
	readonly players = signal<RankedPlayerView[]>([]);
	readonly chat = signal<RankedChatMessage[]>([]);
	readonly disputeReason = signal<string>("");
	readonly summary = signal<RankedMatchSummary | null>(null);
	// Id du lobby persisté (exposé même en litige, où `summary` reste null car il n'y a
	// pas de message `matchEnded`) → requis pour l'upload de la capture de preuve.
	readonly matchLobbyId = signal<number>(0);
	// Désaccord de score en partie amicale : on signale qu'il faut ressaisir (toast one-shot).
	readonly scoreMismatch = signal<number>(0);

	// Présence + invitations (défi direct).
	readonly onlinePlayers = signal<RankedLobbyPlayer[]>([]);
	readonly pendingInvite = signal<RankedPendingInvite | null>(null);
	readonly inviteSent = signal<RankedSentInvite | null>(null);
	// Lien de défi partageable généré par le joueur courant (en attente d'acceptation).
	readonly challengeLink = signal<RankedChallengeLink | null>(null);
	// Proposition de revanche reçue (Socket.IO `rematch_offer`).
	readonly pendingRematch = signal<RankedRematchOffer | null>(null);
	private myUserId: string | null = null;

	// Dé-doublonnage des entrées en MatchRoom : un même roomId peut arriver par 2 canaux
	// (réservation Colyseus + push Socket.IO `match_found`) → on ne rejoint qu'une fois.
	private joinedRoomIds = new Set<string>();

	private notifSocket = inject(NotificationSocketService);
	private userSvc = inject(UserService);
	private matchFoundAudio: HTMLAudioElement | null = null;
	private matchFoundSubscribed = false;

	constructor() {
		this.subscribeMatchFound();
	}

	// Connecte le socket /notifications et abonne le toast `match_found` pour
	// les 2 joueurs apparies par QueueRoom (events emis par le sub-process Colyseus
	// via POST /notifications/emit-match-found cote bot TSed).
	private subscribeMatchFound(): void {
		if (this.matchFoundSubscribed) return;
		this.matchFoundSubscribed = true;

		try {
			this.notifSocket.connect();
		} catch {
			// noop — si le socket n'est pas dispo, on ne cassera pas le ranked.
		}

		this.notifSocket.onMatchFound().subscribe((data) => {
			const me = this.userSvc.user();
			const opp = me && data?.opponents ? data.opponents[me.id] : null;
			const detail = opp ? `Adversaire : ${opp.displayName} (${opp.elo} AP)` : "Match trouvé !";

			this.msg.add({
				severity: "success",
				summary: data?.ranked === false ? "Partie amicale trouvée !" : "Match trouvé !",
				detail,
				life: 8000,
			});

			this.playMatchFoundSound();

			// Auto-join : si on n'est pas en file (la file consomme déjà sa réservation), on
			// rejoint la salle par son id. C'est CE canal qui fait entrer l'INVITEUR d'un défi
			// par lien (pas de réservation Colyseus) et l'initiateur d'une revanche (dont le match
			// précédent, terminé, est encore en mémoire). Dé-doublonnage par roomId.
			if (data?.roomId && !this.searching()) {
				const finished = this.status() === "finished";
				if (!this.matchRoom || finished) {
					void (async () => {
						if (this.matchRoom && finished) await this.leaveMatch();
						await this.enterMatchByRoomId(data.roomId);
					})();
				}
			}
		});

		// Litige tranché par un admin → notif (toast) de la décision + sortie du match resté ouvert.
		this.notifSocket.onDisputeResolved().subscribe((data) => {
			const myId = this.userSvc.user()?.id;
			if (data?.cancelled) {
				this.msg.add({
					severity: "info",
					summary: "Litige tranché",
					detail: "Un administrateur a annulé le match — aucun impact sur ton rang.",
					life: 10000,
				});
			} else {
				const me = data?.players?.find((p) => p.userId === myId);
				const opp = data?.players?.find((p) => p.userId !== myId);
				if (me) {
					const myScore = me.score;
					const oppScore = opp?.score ?? 0;
					const issue = me.forfeit
						? "Forfait"
						: myScore > oppScore
							? "Victoire"
							: myScore < oppScore
								? "Défaite"
								: "Match nul";
					const delta = me.eloDelta ?? 0;
					this.msg.add({
						severity: issue === "Victoire" ? "success" : issue === "Match nul" ? "info" : "warn",
						summary: `Litige tranché — ${issue}`,
						detail: `Décision d'un administrateur : score ${myScore} – ${oppScore} · ${delta >= 0 ? "+" : ""}${delta} AP.`,
						life: 12000,
					});
				}
			}
			// Si le joueur est ENCORE dans ce match (écran « contesté » jamais quitté), on le ramène
			// proprement au lobby (l'arbitrage admin ne met à jour que la DB, pas la room Colyseus).
			if (data?.lobbyId && this.matchLobbyId() === data.lobbyId) {
				void this.leaveMatch().then(() => this.router.navigate(["/ranked"]));
			}
		});

		// Proposition de revanche ciblée → on l'expose (dialog accepter/refuser).
		this.notifSocket.onRematchOffer().subscribe((data) => {
			if (!data?.code) return;
			this.pendingRematch.set({
				code: data.code,
				fromUserId: data.fromUserId,
				fromDisplayName: data.fromDisplayName,
				fromAvatar: data.fromAvatar,
				fromElo: data.fromElo,
				mode: data.mode as MatchMode,
				ranked: data.ranked,
				url: data.url,
			});
		});
	}

	// Rejoint une MatchRoom par son id Colyseus (dé-doublonné). Le serveur admet le joueur
	// via `expectedUserIds` (pas besoin de la réservation). Sert l'auto-join `match_found`.
	private async enterMatchByRoomId(roomId: string): Promise<void> {
		if (this.matchRoom || this.joinedRoomIds.has(roomId)) return;
		this.joinedRoomIds.add(roomId);
		try {
			const token = await this.getAuthToken();
			this.matchRoom = await this.client.joinById(roomId, token ? { token } : {});
			this.bindMatchRoom(this.matchRoom);
			this.searching.set(false);
			// Cet appel sert les flux SANS composant routeur (inviteur d'un défi par lien,
			// initiateur d'une revanche) → on route nous-mêmes vers l'écran de match.
			void this.router.navigate(["/ranked/match"]);
		} catch (err) {
			this.joinedRoomIds.delete(roomId);
			this.msg.add({ severity: "error", summary: "Match perdu", detail: String(err) });
		}
	}

	private playMatchFoundSound(): void {
		try {
			if (!this.matchFoundAudio) {
				this.matchFoundAudio = new Audio("/sounds/match-found.mp3");
				this.matchFoundAudio.volume = 0.6;
			}
			this.matchFoundAudio.currentTime = 0;
			void this.matchFoundAudio.play().catch(() => {
				// Autoplay bloque — silencieux, le toast suffit.
			});
		} catch {
			// noop
		}
	}

	// Le cookie session (HttpOnly, posé par le bot) ne traverse pas vers
	// ranked.rosegriffon.fr (cross-domain). On récupère le JWT via
	// /api/auth/token (proxy nginx) et on le passe en options Colyseus.
	private async getAuthToken(): Promise<string | null> {
		const token = await this.auth.getRealtimeToken();
		if (token) this.client.auth.token = token;
		return token;
	}

	clearAuthCache(): void {
		this.auth.clearRealtimeToken();
		this.client.auth.token = "";
	}

	get me(): RankedPlayerView | undefined {
		const ps = this.players();
		// Identité résolue côté serveur via onAuth (token JWT passé en options).
		// Le serveur mappe sessionId → userId via this.sessionToUser.
		return ps[0];
	}

	get opponent(): RankedPlayerView | undefined {
		const ps = this.players();
		return ps.length > 1 ? ps[1] : undefined;
	}

	async joinQueue(mode: MatchMode, ranked = true): Promise<boolean> {
		if (this.searching()) return false;
		const token = await this.getAuthToken();
		if (!token) {
			this.msg.add({
				severity: "error",
				summary: "Non authentifié",
				detail: "Connecte-toi avant de rechercher un adversaire",
			});
			return false;
		}
		this.searching.set(true);
		try {
			this.queueRoom = await this.client.joinOrCreate("queue", {
				mode,
				ranked,
				token,
			});
			this.queueRoom.onMessage("matched", (payload: { reservation: any }) => {
				this.zone.run(() => {
					void this.consumeReservation(payload.reservation);
				});
			});
			this.queueRoom.onMessage("eta", (payload: { seconds: number }) => {
				this.zone.run(() => {
					this.etaSeconds.set(payload.seconds);
				});
			});
			this.queueRoom.onLeave(() => {
				this.zone.run(() => {
					this.searching.set(false);
				});
			});
			return true;
		} catch (err) {
			this.searching.set(false);
			this.msg.add({
				severity: "error",
				summary: "Connexion impossible",
				detail: String(err),
			});
			return false;
		}
	}

	async cancelQueue(): Promise<void> {
		if (this.queueRoom) {
			await this.queueRoom.leave(true);
			this.queueRoom = null;
		}
		this.searching.set(false);
		this.etaSeconds.set(null);
	}

	private async consumeReservation(reservation: any): Promise<void> {
		// Dé-doublonnage : si on a déjà rejoint cette salle (via auto-join match_found),
		// on n'essaie pas de re-consommer la réservation.
		const roomId: string | undefined = reservation?.room?.roomId;
		if (roomId && this.joinedRoomIds.has(roomId)) return;
		if (roomId) this.joinedRoomIds.add(roomId);
		try {
			// Le token reste passé en options pour onAuth de la MatchRoom.
			const token = await this.getAuthToken();
			if (token) reservation.options = { ...reservation.options, token };
			this.matchRoom = await this.client.consumeSeatReservation(reservation);
			this.bindMatchRoom(this.matchRoom);
			this.searching.set(false);
		} catch (err) {
			if (roomId) this.joinedRoomIds.delete(roomId);
			this.msg.add({
				severity: "error",
				summary: "Match perdu",
				detail: String(err),
			});
		}
	}

	// ───────────────────────── Lobby (présence + défi direct) ─────────────────────────

	// Rejoint le salon de présence partagé : expose `onlinePlayers` (les autres
	// joueurs en ligne, soi exclu) et gère les invitations reçues/envoyées.
	// Idempotent : ne rejoint qu'une fois. Réutilise getAuthToken (client.auth.token).
	async joinLobby(mode: MatchMode): Promise<boolean> {
		if (this.lobbyRoom) return true;
		const token = await this.getAuthToken();
		if (!token) return false;
		this.myUserId = this.userSvc.user()?.id ?? null;
		try {
			this.lobbyRoom = await this.client.joinOrCreate("lobby", { mode, token });
			this.bindLobbyRoom(this.lobbyRoom);
			return true;
		} catch (err) {
			this.msg.add({
				severity: "error",
				summary: "Salon indisponible",
				detail: String(err),
			});
			return false;
		}
	}

	async leaveLobby(): Promise<void> {
		// Un défi par lien en attente garde la présence lobby (l'inviteur doit pouvoir
		// recevoir l'adversaire) → on ne quitte pas tant qu'un lien est ouvert.
		if (this.challengeLink()) return;
		if (this.lobbyRoom) {
			await this.lobbyRoom.leave(true);
			this.lobbyRoom = null;
		}
		this.onlinePlayers.set([]);
		this.pendingInvite.set(null);
		this.inviteSent.set(null);
	}

	private bindLobbyRoom(room: Room): void {
		// Même garde que pour la MatchRoom : les callbacks Colyseus peuvent tomber hors zone
		// Angular → on ré-entre dans la zone pour que la présence/les invitations se mettent
		// à jour en temps réel sans rechargement.
		room.onStateChange((state: any) => {
			this.zone.run(() => {
				this.onlinePlayers.set(this.serializeLobbyPlayers(state));
			});
		});

		// On est invité par un autre joueur → on expose pendingInvite (dialog).
		room.onMessage("invited", (payload: RankedPendingInvite) => {
			this.zone.run(() => {
				this.pendingInvite.set(payload);
			});
		});

		// L'invité a refusé → toast à l'inviteur, on efface l'attente.
		room.onMessage(
			"invite-declined",
			(payload: { fromUserId: string; fromDisplayName?: string }) => {
				this.zone.run(() => {
					const name = payload?.fromDisplayName ?? "L'adversaire";
					this.msg.add({
						severity: "warn",
						summary: "Défi refusé",
						detail: `${name} a refusé ton invitation.`,
						life: 6000,
					});
					this.inviteSent.set(null);
				});
			}
		);

		// Le match est créé (côté serveur, mutualisé avec QueueRoom) → on consomme
		// la réservation exactement comme la file aléatoire → MatchRoom.
		room.onMessage("matched", (payload: { reservation: any }) => {
			this.zone.run(() => {
				this.pendingInvite.set(null);
				this.inviteSent.set(null);
				void this.consumeReservation(payload.reservation);
			});
		});

		room.onMessage("invite-expired", () => {
			this.zone.run(() => {
				this.pendingInvite.set(null);
				this.inviteSent.set(null);
			});
		});

		room.onMessage("invite-error", (payload: { reason?: string }) => {
			this.zone.run(() => {
				this.inviteSent.set(null);
				this.pendingInvite.set(null);
				this.msg.add({
					severity: "error",
					summary: "Invitation impossible",
					detail:
						payload?.reason === "offline"
							? "Le joueur n'est plus en ligne."
							: "Erreur lors de la création du match.",
				});
			});
		});

		room.onLeave(() => {
			this.zone.run(() => {
				this.lobbyRoom = null;
				this.onlinePlayers.set([]);
			});
		});
	}

	private serializeLobbyPlayers(state: any): RankedLobbyPlayer[] {
		const out: RankedLobbyPlayer[] = [];
		const map = state?.players;
		if (!map) return out;
		for (const [, p] of map) {
			// Exclut soi-même de la liste affichée.
			if (this.myUserId && p.userId === this.myUserId) continue;
			out.push({
				userId: p.userId,
				displayName: p.displayName,
				avatar: p.avatar,
				elo: p.elo,
				mode: p.mode,
			});
		}
		return out;
	}

	// Envoie un défi direct à un joueur en ligne. Affiche « invitation envoyée ».
	invite(targetUserId: string, mode: MatchMode, ranked = true): void {
		if (!this.lobbyRoom) return;
		const target = this.onlinePlayers().find((p) => p.userId === targetUserId);
		this.lobbyRoom.send("invite", { targetUserId, mode, ranked });
		this.inviteSent.set({
			targetUserId,
			targetDisplayName: target?.displayName ?? "Adversaire",
			mode,
			ranked,
		});
	}

	// Réponse à une invitation reçue (dialog accepter/refuser).
	respondInvite(accept: boolean): void {
		const inv = this.pendingInvite();
		if (!inv || !this.lobbyRoom) {
			this.pendingInvite.set(null);
			return;
		}
		this.lobbyRoom.send("invite-response", {
			accept,
			fromUserId: inv.fromUserId,
			mode: inv.mode,
			ranked: inv.ranked,
		});
		this.pendingInvite.set(null);
	}

	async rejoinByCode(roomCode: string): Promise<boolean> {
		try {
			const token = await this.getAuthToken();
			this.matchRoom = await this.client.joinById(roomCode, { token });
			this.bindMatchRoom(this.matchRoom);
			return true;
		} catch (err) {
			this.msg.add({
				severity: "error",
				summary: "Salle introuvable",
				detail: String(err),
			});
			return false;
		}
	}

	private bindMatchRoom(room: Room): void {
		// Un match démarre → le lien de défi/la revanche en attente n'ont plus lieu d'être.
		this.challengeLink.set(null);
		this.pendingRematch.set(null);
		this.inviteSent.set(null);
		// Mémorise l'id de salle Colyseus → permet de revenir au match après un refresh /
		// une coupure réseau (indispensable pour la fin de match ASYNCHRONE).
		try {
			localStorage.setItem(MATCH_ROOM_KEY, room.roomId);
		} catch {
			// stockage indispo (mode privé) — la reconnexion sera juste indisponible.
		}

		// Toute donnée temps réel du match (chat, statut, scores, players, code de salle…) est
		// poussée via ce seul handler `onStateChange` → on l'exécute dans la zone Angular pour
		// que chaque patch du serveur rafraîchisse réellement la vue (cf. `this.zone`).
		room.onStateChange((state: any) => {
			this.zone.run(() => {
				this.roomCode.set(state.roomCode ?? "");
				this.status.set(state.status ?? "waiting");
				this.ranked.set(state.ranked !== false);
				this.disputeReason.set(state.disputeReason ?? "");
				this.matchLobbyId.set(Number(state.lobbyId ?? 0));
				this.players.set(this.serializePlayers(state));
				this.chat.set(this.serializeChat(state));
				// Snapshot local à chaque changement → réaffichage instantané après refresh.
				this.persistSnapshot();
			});
		});

		room.onMessage("matchEnded", (summary: RankedMatchSummary) => {
			this.zone.run(() => {
				this.summary.set(summary);
				// Match terminé → plus de reconnexion à tenter (un rejoin n'aurait pas le summary).
				this.clearStoredMatch();
			});
		});

		// Partie amicale : les 2 scores ne concordent pas → on invite à ressaisir (toast).
		room.onMessage("scoreMismatch", () => {
			this.zone.run(() => {
				this.scoreMismatch.update((n) => n + 1);
				this.msg.add({
					severity: "warn",
					summary: "Scores différents",
					detail: "Les deux saisies ne concordent pas — ressaisissez le score.",
					life: 6000,
				});
			});
		});

		room.onLeave(() => {
			// reset only ephemeral state — summary peut rester pour l'écran fin.
			this.matchRoom = null;
		});
	}

	private clearStoredMatch(): void {
		try {
			localStorage.removeItem(MATCH_ROOM_KEY);
			localStorage.removeItem(MATCH_STATE_KEY);
		} catch {
			// noop
		}
	}

	// Sérialise l'état courant du match en localStorage (résilience / réaffichage instantané).
	private persistSnapshot(): void {
		try {
			localStorage.setItem(
				MATCH_STATE_KEY,
				JSON.stringify({
					roomCode: this.roomCode(),
					status: this.status(),
					disputeReason: this.disputeReason(),
					lobbyId: this.matchLobbyId(),
					players: this.players(),
					chat: this.chat().slice(-50),
				})
			);
		} catch {
			// noop
		}
	}

	// Réhydrate les signaux depuis le snapshot local (le serveur écrasera dès la reconnexion).
	private hydrateFromCache(): boolean {
		try {
			const raw = localStorage.getItem(MATCH_STATE_KEY);
			if (!raw) return false;
			const s = JSON.parse(raw) as Partial<{
				roomCode: string;
				status: MatchRoomStatus;
				disputeReason: string;
				lobbyId: number;
				players: RankedPlayerView[];
				chat: RankedChatMessage[];
			}>;
			if (s.roomCode) this.roomCode.set(s.roomCode);
			if (s.status) this.status.set(s.status);
			this.disputeReason.set(s.disputeReason ?? "");
			this.matchLobbyId.set(Number(s.lobbyId ?? 0));
			if (Array.isArray(s.players)) this.players.set(s.players);
			if (Array.isArray(s.chat)) this.chat.set(s.chat);
			return true;
		} catch {
			return false;
		}
	}

	/**
	 * Tente de revenir dans un match en cours après un rechargement de page (le service est
	 * recréé, le state Colyseus est perdu). Best-effort : si l'id stocké pointe vers une salle
	 * disposée ou si le joueur n'y est plus attendu, on nettoie et on renvoie false (l'appelant
	 * rebascule alors vers /ranked). La salle conserve scores/saisies côté serveur → le joueur
	 * peut finir de saisir son score.
	 */
	async tryRejoinStoredMatch(): Promise<boolean> {
		if (this.matchRoom) return true;
		let roomId: string | null = null;
		try {
			roomId = localStorage.getItem(MATCH_ROOM_KEY);
		} catch {
			roomId = null;
		}
		if (!roomId) return false;
		// Affichage instantané du dernier état connu pendant que la reconnexion s'établit.
		this.hydrateFromCache();
		const token = await this.getAuthToken();
		if (!token) return false;
		try {
			this.matchRoom = await this.client.joinById(roomId, { token });
			this.bindMatchRoom(this.matchRoom);
			return true;
		} catch {
			// Salle introuvable / joueur non attendu / déjà terminée → on abandonne proprement
			// (on efface le cache pour ne pas réafficher un état périmé).
			this.clearStoredMatch();
			this.players.set([]);
			this.roomCode.set("");
			this.status.set("waiting");
			return false;
		}
	}

	private serializePlayers(state: any): RankedPlayerView[] {
		const out: RankedPlayerView[] = [];
		const map = state.players;
		if (!map) return out;
		// MapSchema est itérable
		for (const [, p] of map) {
			out.push({
				userId: p.userId,
				displayName: p.displayName,
				avatar: p.avatar,
				elo: p.elo,
				team: p.team ?? 0,
				myScore: p.myScore,
				oppScore: p.oppScore,
				startedMatch: p.startedMatch ?? false,
				submitted: p.submitted,
				proofUploaded: p.proofUploaded ?? false,
				confirmedFinish: p.confirmedFinish,
			});
		}
		// Tri stable domicile (team 1) puis extérieur (team 2) — l'ordre du MapSchema
		// n'est pas garanti côté client.
		out.sort((a, b) => (a.team || 99) - (b.team || 99));
		return out;
	}

	private serializeChat(state: any): RankedChatMessage[] {
		const arr = state.chat;
		if (!arr) return [];
		const out: RankedChatMessage[] = [];
		for (const m of arr) {
			out.push({ userId: m.userId, text: m.text, at: m.at });
		}
		return out;
	}

	sendChat(text: string): void {
		if (!this.matchRoom || !text.trim()) return;
		this.matchRoom.send("chat", { text });
	}

	// « Début de match » : confirme que ce joueur est prêt. Quand les 2 ont confirmé,
	// le serveur passe le match en « playing ».
	startMatch(): void {
		if (!this.matchRoom) return;
		this.matchRoom.send("start");
	}

	finishMatch(): void {
		if (!this.matchRoom) return;
		this.matchRoom.send("finish");
	}

	// « Abandonner » — déclare forfait immédiatement (l'adversaire gagne). En classé l'ELO
	// est appliqué (défaite), en non classé c'est sans conséquence.
	surrender(): void {
		if (!this.matchRoom) return;
		this.matchRoom.send("surrender");
	}

	// ───────────────────────── Défi par lien partageable ─────────────────────────

	// Crée un lien de défi (classé/non classé). Le joueur reste sur la page ranked pour
	// recevoir l'adversaire (via la LobbyRoom ou l'auto-join match_found). `toUserId` cible
	// une revanche (notification temps réel au joueur visé).
	async createChallengeLink(
		mode: MatchMode,
		ranked: boolean,
		toUserId?: string
	): Promise<RankedChallengeLink | null> {
		try {
			const r = await fetch("/api/ranked/challenge", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				credentials: "include",
				body: JSON.stringify({ mode, ranked, toUserId }),
			});
			if (!r.ok) throw new Error(String(r.status));
			const link = (await r.json()) as RankedChallengeLink;
			// Lien partageable construit sur l'ORIGINE COURANTE : le serveur le forge depuis
			// WEBSITE_URL (qui peut pointer ailleurs) ; on garantit ici le
			// domaine réellement visité (achillea.rosegriffon.fr) pour le copier/afficher.
			link.url = `${window.location.origin}/ranked/defi/${link.code}`;
			// Rejoindre le salon de présence dans TOUS les cas (lien ouvert ET revanche) : c'est
			// par la LobbyRoom que l'inviteur, resté sur sa page, reçoit la réservation quand
			// l'autre accepte. Indispensable pour la REVANCHE (toUserId) — sinon l'inviteur ne
			// rejoindrait jamais le nouveau match (il ne dépendrait que du push Socket.IO).
			await this.joinLobby(mode);
			// Seul un lien OUVERT (sans cible) affiche l'écran d'attente ; une revanche est poussée.
			if (!toUserId) this.challengeLink.set(link);
			return link;
		} catch {
			this.msg.add({
				severity: "error",
				summary: "Lien impossible",
				detail: "Impossible de créer le lien de défi.",
			});
			return null;
		}
	}

	async cancelChallengeLink(): Promise<void> {
		const link = this.challengeLink();
		this.challengeLink.set(null);
		if (!link) return;
		try {
			// Corps JSON `{}` obligatoire : bun-serve-express s'étrangle sur un corps vide.
			await fetch(`/api/ranked/challenge/${link.code}`, {
				method: "DELETE",
				headers: { "Content-Type": "application/json" },
				credentials: "include",
				body: "{}",
			});
		} catch {
			// noop — le défi expirera de toute façon (TTL serveur).
		}
	}

	// Aperçu d'un défi reçu via un lien (page /ranked/defi/:code).
	async previewChallenge(code: string): Promise<RankedChallengePreview | null> {
		try {
			const r = await fetch(`/api/ranked/challenge/${encodeURIComponent(code)}`, {
				credentials: "include",
			});
			if (!r.ok) return null;
			return (await r.json()) as RankedChallengePreview;
		} catch {
			return null;
		}
	}

	// Accepte un défi (lien ou revanche) : crée le match côté serveur, consomme la réservation
	// renvoyée, et entre dans la MatchRoom. Renvoie true si le match a démarré.
	async acceptChallenge(code: string): Promise<boolean> {
		try {
			// Corps JSON `{}` obligatoire : bun-serve-express s'étrangle sur un POST sans corps.
			const r = await fetch(`/api/ranked/challenge/${encodeURIComponent(code)}/accept`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				credentials: "include",
				body: "{}",
			});
			if (!r.ok) {
				const body = (await r.json().catch(() => ({}))) as { error?: string };
				this.msg.add({
					severity: "error",
					summary: "Défi indisponible",
					detail:
						body?.error === "challenge_not_found"
							? "Ce défi a expiré ou a déjà été accepté."
							: "Impossible de rejoindre ce défi.",
				});
				return false;
			}
			const body = (await r.json()) as { reservation: any };
			this.pendingRematch.set(null);
			await this.consumeReservation(body.reservation);
			return true;
		} catch (err) {
			this.msg.add({ severity: "error", summary: "Défi indisponible", detail: String(err) });
			return false;
		}
	}

	dismissRematch(): void {
		this.pendingRematch.set(null);
	}

	// Reflète dans le state Colyseus qu'on vient d'uploader sa preuve via l'API REST
	// (l'upload binaire ne passe pas par le WebSocket Colyseus).
	markProofUploaded(): void {
		if (!this.matchRoom) {
			// Déconnecté pendant l'upload : la preuve est bien stockée côté serveur (DB), mais
			// le flag temps réel n'est pas reflété. Tracé pour le diagnostic.
			console.error("[ranked] markProofUploaded ignoré : pas de room active (déconnecté ?)");
			return;
		}
		this.matchRoom.send("proofUploaded");
	}

	// Saisie du score COMPLET du point de vue du joueur (mes buts + buts adverse).
	// Les 2 joueurs doivent concorder pour valider, sinon litige + preuve.
	submitScore(myScore: number, oppScore: number): void {
		if (!this.matchRoom) return;
		this.matchRoom.send("submitScore", { myScore, oppScore });
	}

	async leaveMatch(): Promise<void> {
		this.clearStoredMatch();
		if (this.matchRoom) {
			await this.matchRoom.leave(true);
			this.matchRoom = null;
		}
		this.summary.set(null);
		this.players.set([]);
		this.chat.set([]);
		this.roomCode.set("");
		this.status.set("waiting");
		this.ranked.set(true);
		this.matchLobbyId.set(0);
		this.pendingRematch.set(null);
		// Autorise un futur match (le roomId courant ne doit plus bloquer une nouvelle entrée).
		this.joinedRoomIds.clear();
	}
}
