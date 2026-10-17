import { HttpClient, HttpParams } from "@angular/common/http";
import { Injectable, inject } from "@angular/core";
import { MessageService } from "primeng/api";
import { firstValueFrom } from "rxjs";

import {
	CreatePlayerNotePayload,
	PlayerNote,
	PlayerNoteCategory,
	PlayerNoteListResponse,
	PlayerNoteSeverity,
} from "../../core/models/PlayerNote";

export interface PlayerNoteQuery {
	targetId?: string;
	tournamentId?: number;
	category?: PlayerNoteCategory | null;
	severity?: PlayerNoteSeverity | null;
	resolved?: boolean | null;
	search?: string;
	page?: number;
	pageSize?: number;
}

/**
 * Accès aux notes du staff sur les joueurs.
 *
 * Toutes les routes exigent une session : le serveur tranche entre staff (accès
 * complet) et organisateur (le périmètre de son tournoi). Les erreurs sont remontées
 * telles quelles à l'utilisateur — un refus d'accès doit se voir, pas se deviner.
 */
@Injectable({ providedIn: "root" })
export class PlayerNotesService {
	private http = inject(HttpClient);
	private msg = inject(MessageService);

	private API = "api/player-notes";

	async list(query: PlayerNoteQuery = {}): Promise<PlayerNoteListResponse | null> {
		let params = new HttpParams()
			.set("page", String(query.page ?? 1))
			.set("pageSize", String(query.pageSize ?? 50));

		if (query.targetId) params = params.set("targetId", query.targetId);
		if (query.tournamentId) params = params.set("tournamentId", String(query.tournamentId));
		if (query.category) params = params.set("category", query.category);
		if (query.severity) params = params.set("severity", query.severity);
		if (query.resolved !== null && query.resolved !== undefined)
			params = params.set("resolved", String(query.resolved));
		if (query.search?.trim()) params = params.set("search", query.search.trim());

		try {
			return await firstValueFrom(
				this.http.get<PlayerNoteListResponse>(this.API, { params, withCredentials: true })
			);
		} catch (err: any) {
			this.report(err, "Impossible de charger les signalements");
			return null;
		}
	}

	async create(payload: CreatePlayerNotePayload): Promise<PlayerNote | null> {
		try {
			const note = await firstValueFrom(
				this.http.post<PlayerNote>(this.API, payload, { withCredentials: true })
			);

			this.msg.add({
				severity: "success",
				summary: "Signalement enregistré",
				detail: note.docsUrl
					? "Consigné en base et dans le registre Drive."
					: "Visible du staff dans le tableau de bord.",
			});

			return note;
		} catch (err: any) {
			this.report(err, "Impossible d'enregistrer le signalement");
			return null;
		}
	}

	async update(
		id: string,
		patch: { content?: string; category?: PlayerNoteCategory; severity?: PlayerNoteSeverity }
	): Promise<PlayerNote | null> {
		try {
			return await firstValueFrom(
				this.http.put<PlayerNote>(`${this.API}/${id}`, patch, { withCredentials: true })
			);
		} catch (err: any) {
			this.report(err, "Modification impossible");
			return null;
		}
	}

	async setResolved(id: string, resolved: boolean): Promise<PlayerNote | null> {
		try {
			const note = await firstValueFrom(
				this.http.post<PlayerNote>(
					`${this.API}/${id}/${resolved ? "resolve" : "reopen"}`,
					{},
					{ withCredentials: true }
				)
			);

			this.msg.add({
				severity: "success",
				summary: resolved ? "Signalement traité" : "Signalement rouvert",
				detail: resolved ? "Il reste consultable en historique." : "",
			});

			return note;
		} catch (err: any) {
			this.report(err, "Changement d'état impossible");
			return null;
		}
	}

	async remove(id: string): Promise<boolean> {
		try {
			await firstValueFrom(
				this.http.delete<{ success: boolean }>(`${this.API}/${id}`, { withCredentials: true })
			);

			this.msg.add({ severity: "success", summary: "Signalement supprimé", detail: "" });

			return true;
		} catch (err: any) {
			this.report(err, "Suppression impossible");
			return false;
		}
	}

	private report(err: any, summary: string) {
		console.error(summary, err);
		this.msg.add({
			severity: "error",
			summary,
			detail: err?.error?.message ?? err?.error?.error ?? err?.message ?? "",
		});
	}
}
