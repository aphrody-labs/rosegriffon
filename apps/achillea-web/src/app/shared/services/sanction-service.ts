import { Injectable, inject } from "@angular/core";
import { HttpClient, HttpParams } from "@angular/common/http";
import { MessageService } from "primeng/api";
import { firstValueFrom } from "rxjs";

import {
	CreateSanctionPayload,
	Sanction,
	SanctionFilters,
	SanctionListResponse,
} from "../../core/models/Sanction";

@Injectable({ providedIn: "root" })
export class SanctionService {
	private http = inject(HttpClient);
	private msg = inject(MessageService);

	private readonly API = "api/sanctions";

	async list(filters: SanctionFilters = {}): Promise<SanctionListResponse> {
		try {
			let params = new HttpParams();
			if (filters.userId) params = params.set("userId", filters.userId);
			if (filters.guildId) params = params.set("guildId", filters.guildId);
			if (filters.type) params = params.set("type", filters.type);
			if (filters.active !== undefined) params = params.set("active", String(filters.active));
			if (filters.page) params = params.set("page", String(filters.page));
			if (filters.pageSize) params = params.set("pageSize", String(filters.pageSize));

			return await firstValueFrom(
				this.http.get<SanctionListResponse>(this.API, {
					params,
					withCredentials: true,
				})
			);
		} catch (err: unknown) {
			const error = err as { error?: { message?: string }; message?: string };
			this.msg.add({
				severity: "error",
				summary: "Erreur",
				detail: error.error?.message ?? error.message ?? "Erreur de chargement des sanctions",
			});
			return { data: [], total: 0, meta: { page: 1, pageSize: 50, pageCount: 0 } };
		}
	}

	async create(payload: CreateSanctionPayload): Promise<Sanction | null> {
		try {
			const sanction = await firstValueFrom(
				this.http.post<Sanction>(this.API, payload, { withCredentials: true })
			);
			this.msg.add({
				severity: "success",
				summary: "Succès",
				detail: "Sanction créée avec succès",
			});
			return sanction;
		} catch (err: unknown) {
			const error = err as { error?: { message?: string }; message?: string };
			this.msg.add({
				severity: "error",
				summary: "Erreur",
				detail: error.error?.message ?? error.message ?? "Impossible de créer la sanction",
			});
			return null;
		}
	}

	async revoke(id: string, reason?: string): Promise<Sanction | null> {
		try {
			const sanction = await firstValueFrom(
				this.http.post<Sanction>(`${this.API}/${id}/revoke`, { reason }, { withCredentials: true })
			);
			this.msg.add({ severity: "success", summary: "Succès", detail: "Sanction révoquée" });
			return sanction;
		} catch (err: unknown) {
			const error = err as { error?: { message?: string }; message?: string };
			this.msg.add({
				severity: "error",
				summary: "Erreur",
				detail: error.error?.message ?? error.message ?? "Impossible de révoquer la sanction",
			});
			return null;
		}
	}

	async appeal(id: string, message: string): Promise<Sanction | null> {
		try {
			const sanction = await firstValueFrom(
				this.http.post<Sanction>(`${this.API}/${id}/appeal`, { message }, { withCredentials: true })
			);
			this.msg.add({ severity: "success", summary: "Succès", detail: "Appel enregistré" });
			return sanction;
		} catch (err: unknown) {
			const error = err as { error?: { message?: string }; message?: string };
			this.msg.add({
				severity: "error",
				summary: "Erreur",
				detail: error.error?.message ?? error.message ?? "Impossible d'enregistrer l'appel",
			});
			return null;
		}
	}
}
