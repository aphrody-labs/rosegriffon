import { Injectable, inject } from "@angular/core";
import { HttpClient, HttpParams } from "@angular/common/http";
import { MessageService } from "primeng/api";
import { Observable, catchError, from, map, of } from "rxjs";

import type {
	CastAttribution,
	CastAvailabilityStatus,
	CasterPublic,
	CastEventDetail,
	CastEventFilters,
	CastEventListResponse,
	CastSlotRole,
	CreateCastEventPayload,
} from "../../core/models/Cast";
import { SupabaseService } from "../../core/supabase/supabase.service";

@Injectable({ providedIn: "root" })
export class CastService {
	private http = inject(HttpClient);
	private msg = inject(MessageService);
	private supabase = inject(SupabaseService);

	private readonly API = "api/casts";

	// ---------------------------------------------------------------------------
	// Événements
	// ---------------------------------------------------------------------------

	listEvents(filters: CastEventFilters = {}): Observable<CastEventListResponse> {
		let params = new HttpParams();
		if (filters.status) params = params.set("status", filters.status);
		if (filters.from) params = params.set("from", filters.from);
		if (filters.to) params = params.set("to", filters.to);
		if (filters.page) params = params.set("page", String(filters.page));
		if (filters.pageSize) params = params.set("pageSize", String(filters.pageSize));

		return this.http
			.get<CastEventListResponse>(`${this.API}/events`, { params, withCredentials: true })
			.pipe(
				catchError((err: unknown) => {
					this.handleError(err, "Erreur de chargement des événements");
					return of({ data: [], total: 0, meta: { page: 1, pageSize: 25, pageCount: 0 } });
				})
			);
	}

	getEvent(id: string): Observable<CastEventDetail | null> {
		return this.http
			.get<CastEventDetail>(`${this.API}/events/${id}`, { withCredentials: true })
			.pipe(
				catchError((err: unknown) => {
					this.handleError(err, "Impossible de charger l'événement");
					return of(null);
				})
			);
	}

	createEvent(payload: CreateCastEventPayload): Observable<unknown> {
		return this.http.post(`${this.API}/events`, payload, { withCredentials: true }).pipe(
			catchError((err: unknown) => {
				this.handleError(err, "Impossible de créer l'événement");
				return of(null);
			})
		);
	}

	// ---------------------------------------------------------------------------
	// Sondage
	// ---------------------------------------------------------------------------

	openSurvey(eventId: string, casterPool: string[]): Observable<unknown> {
		return this.http
			.post(`${this.API}/events/${eventId}/survey`, { casterPool }, { withCredentials: true })
			.pipe(
				catchError((err: unknown) => {
					this.handleError(err, "Impossible d'ouvrir le sondage");
					return of(null);
				})
			);
	}

	// ---------------------------------------------------------------------------
	// Disponibilité
	// ---------------------------------------------------------------------------

	recordAvailability(
		eventId: string,
		status: CastAvailabilityStatus,
		preferredRoles?: CastSlotRole[] | null
	): Observable<unknown> {
		return this.http
			.post(
				`${this.API}/events/${eventId}/availability`,
				{ status, preferredRoles: preferredRoles ?? null },
				{ withCredentials: true }
			)
			.pipe(
				catchError((err: unknown) => {
					this.handleError(err, "Impossible d'enregistrer la disponibilité");
					return of(null);
				})
			);
	}

	// ---------------------------------------------------------------------------
	// Auto-assignation
	// ---------------------------------------------------------------------------

	autoAssign(eventId: string, opts?: { maxSlotsPerCaster?: number }): Observable<unknown> {
		return this.http
			.post(`${this.API}/events/${eventId}/auto-assign`, opts ?? {}, { withCredentials: true })
			.pipe(
				catchError((err: unknown) => {
					this.handleError(err, "Impossible de lancer l'auto-assignation");
					return of(null);
				})
			);
	}

	// ---------------------------------------------------------------------------
	// Swap
	// ---------------------------------------------------------------------------

	swap(attributionId: string, newCasterId: string): Observable<CastAttribution | null> {
		return this.http
			.patch<CastAttribution>(
				`${this.API}/attributions/${attributionId}`,
				{ newCasterId },
				{ withCredentials: true }
			)
			.pipe(
				catchError((err: unknown) => {
					this.handleError(err, "Impossible d'effectuer le swap");
					return of(null);
				})
			);
	}

	// ---------------------------------------------------------------------------
	// Confirmation
	// ---------------------------------------------------------------------------

	confirm(attributionId: string): Observable<CastAttribution | null> {
		return this.http
			.post<CastAttribution>(
				`${this.API}/attributions/${attributionId}/confirm`,
				{},
				{ withCredentials: true }
			)
			.pipe(
				catchError((err: unknown) => {
					this.handleError(err, "Impossible de confirmer l'attribution");
					return of(null);
				})
			);
	}

	// ---------------------------------------------------------------------------
	// Vitrine publique
	// ---------------------------------------------------------------------------

	// Lecture Supabase directe (vue caster_view) — réplique GET /api/casts/casters
	// (union dispo + attributions, recentCasts sur 30 jours, tri décroissant).
	listCasters(): Observable<CasterPublic[]> {
		const query = this.supabase
			.from("caster_view")
			.select('id, "displayName", avatar, bio, "twitchUrl", "recentCasts"')
			.order("recentCasts", { ascending: false });
		return from(query).pipe(
			map(({ data, error }) => {
				if (error) throw error;
				return (data ?? []) as unknown as CasterPublic[];
			}),
			catchError((err: unknown) => {
				this.handleError(err, "Impossible de charger la liste des casters");
				return of([]);
			})
		);
	}

	// ---------------------------------------------------------------------------

	private handleError(err: unknown, defaultMsg: string): void {
		const error = err as { error?: { message?: string }; message?: string };
		this.msg.add({
			severity: "error",
			summary: "Erreur",
			detail: error.error?.message ?? error.message ?? defaultMsg,
		});
	}
}
