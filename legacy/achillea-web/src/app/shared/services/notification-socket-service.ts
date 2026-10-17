import { Injectable } from "@angular/core";
import { io, Socket } from "socket.io-client";
import { Observable } from "rxjs";
import { environment } from "../../../environments/environment";

@Injectable({
	providedIn: "root",
})
export class NotificationSocketService {
	private socket?: Socket;
	private connecting = false;

	async connect(): Promise<void> {
		if (this.socket?.connected || this.connecting) return;
		this.connecting = true;
		try {
			const namespace = "/notifications";
			const base = environment.socketUrl ? environment.socketUrl.replace(/\/$/, "") : "";
			const target = `${base}${namespace}`;

			// Cross-domain (achillea.* → ranked.*) : le cookie `token` ne traverse pas le
			// domaine du backend WS. On récupère donc le JWT (même endpoint que le client
			// Colyseus) et on le passe dans le handshake Socket.IO. Sans ça, l'auth du
			// namespace /notifications échoue et AUCUN event temps réel n'arrive
			// (match_found, rematch_offer, notifications) → revanche cassée en prod.
			const token = await this.fetchToken();

			this.socket = io(target, {
				path: environment.socketPath,
				withCredentials: true,
				transports: ["websocket", "polling"],
				auth: token ? { token } : {},
			});

			this.socket.on("connect", () => {
				console.info("Socket connected", this.socket?.id);
			});

			this.socket.on("disconnect", () => {
				console.info("Socket disconnected");
			});
		} finally {
			this.connecting = false;
		}
	}

	// JWT brut (cookie HttpOnly → token) pour authentifier le socket cross-domain.
	private async fetchToken(): Promise<string | null> {
		try {
			const r = await fetch("/api/auth/token", { credentials: "include" });
			if (!r.ok) return null;
			const body = (await r.json()) as { token?: string };
			return body.token ?? null;
		} catch {
			return null;
		}
	}

	disconnect() {
		this.socket?.disconnect();
	}

	/** Listen for "notification" events from the server */
	onNotification(): Observable<any> {
		return new Observable((observer) => {
			// Garder la ref du handler pour ne retirer QUE celui-ci au teardown
			// (off("notification") sans handler supprimait TOUS les listeners).
			const handler = (data: any) => observer.next(data);
			this.socket?.on("notification", handler);
			return () => {
				this.socket?.off("notification", handler);
			};
		});
	}

	/** Listen for "match_found" events emitted by the Colyseus QueueRoom */
	onMatchFound(): Observable<{
		roomId: string;
		mode: number;
		ranked?: boolean;
		opponents: Record<string, { userId: string; displayName: string; avatar: string; elo: number }>;
	}> {
		return new Observable((observer) => {
			const handler = (data: any) => observer.next(data);
			this.socket?.on("match_found", handler);
			return () => {
				this.socket?.off("match_found", handler);
			};
		});
	}

	/** Litige tranché par un admin (validation ou annulation) → notif de la décision. */
	onDisputeResolved(): Observable<{
		lobbyId: number;
		mode: number;
		cancelled: boolean;
		players: Array<{
			userId: string;
			team: number;
			score: number;
			forfeit: boolean;
			eloDelta: number;
			eloAfter: number;
		}>;
	}> {
		return new Observable((observer) => {
			const handler = (data: any) => observer.next(data);
			this.socket?.on("ranked_dispute_resolved", handler);
			return () => {
				this.socket?.off("ranked_dispute_resolved", handler);
			};
		});
	}

	/** Listen for "rematch_offer" events (proposition de revanche ciblée via défi). */
	onRematchOffer(): Observable<{
		code: string;
		fromUserId: string;
		fromDisplayName: string;
		fromAvatar: string;
		fromElo: number;
		mode: number;
		ranked: boolean;
		url: string;
	}> {
		return new Observable((observer) => {
			const handler = (data: any) => observer.next(data);
			this.socket?.on("rematch_offer", handler);
			return () => {
				this.socket?.off("rematch_offer", handler);
			};
		});
	}
}
