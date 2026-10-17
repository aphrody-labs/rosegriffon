import { computed, Injectable, signal, inject } from "@angular/core";
import { firstValueFrom } from "rxjs";
import { HttpClient, HttpParams } from "@angular/common/http";
import { MessageService } from "primeng/api";
import { OrganizationDTO, OrganizationState } from "../../core/models/Organization";

@Injectable({
	providedIn: "root",
})
export class OrganizationService {
	private http = inject(HttpClient);
	private msg = inject(MessageService);

	private API = "api/organizations";

	public async createOrganization(organization: OrganizationDTO) {
		try {
			const res = await firstValueFrom(
				this.http.post<{ success: boolean; error?: any }>(`${this.API}/create`, organization, {
					withCredentials: true,
				})
			);

			// 🔥 HTTP 200 OK → response received
			if (!res.success) {
				this.msg.add({
					severity: "error",
					summary: "Erreur",
					detail: res.error ?? "Impossible de créer l'organisation.",
				});
			} else {
				this.msg.add({
					severity: "success",
					summary: "Succès",
					detail: "Le dossier a été soumis avec succès.",
				});
			}

			return res.success;
		} catch (err: any) {
			// 🔥 Handle Angular HttpErrorResponse
			const serverError =
				err.error?.error ||
				err.error?.message ||
				err.message ||
				"Erreur de communication avec le serveur.";

			this.msg.add({
				severity: "error",
				summary: "Erreur",
				detail: serverError,
			});

			return false;
		}
	}

	private _dashboardPendingOrganizations = signal<OrganizationDTO[]>([]);
	public dashboardPendingOrganizations = computed(() => this._dashboardPendingOrganizations());
	private async getOrganizations(
		page: number = 1,
		pagination: number = 25,
		state: OrganizationState = OrganizationState.Pending
	): Promise<{
		data: OrganizationDTO[];
		meta: { page: number; limit: number; total: number; pageCount: number };
	}> {
		try {
			const params = new HttpParams()
				.set("page", page.toString())
				.set("pagination", pagination.toString())
				.set("state", state);

			return await firstValueFrom(
				this.http.get<{
					data: OrganizationDTO[];
					meta: { page: number; limit: number; total: number; pageCount: number };
				}>(`${this.API}`, {
					params,
					withCredentials: true, // important si cookies d’auth
				})
			);
		} catch (err: any) {
			console.error("Error fetching organizations:", err);
			this.msg.add({
				severity: "error",
				summary: "Erreur",
				detail: err.message,
			});
			return { data: [], meta: { page: 1, limit: 25, total: 0, pageCount: 1 } };
		}
	}

	private _dashboardPendingOrganizationsLoading = signal<boolean>(false);
	public dashboardPendingOrganizationsLoading = computed(() =>
		this._dashboardPendingOrganizationsLoading()
	);

	public async getAndSetDashboardOrganizations() {
		this._dashboardPendingOrganizationsLoading.set(true);
		const organizations = await this.getOrganizations();
		this._dashboardPendingOrganizations.set(organizations.data);
		this._dashboardPendingOrganizationsLoading.set(false);
	}

	public async getOrganization(id: number) {
		try {
			return await firstValueFrom(
				this.http.get<{ success: boolean; data?: OrganizationDTO }>(`${this.API}/${id}`, {
					withCredentials: true, // important si cookies d’auth
				})
			);
		} catch (err: any) {
			console.error("Error fetching organization:", err);
			this.msg.add({
				severity: "error",
				summary: "Erreur",
				detail: err.message,
			});
			return null;
		}
	}

	/** Approuve une organisation en attente (admin). */
	public async approveOrganization(id: number): Promise<boolean> {
		return this.setOrganizationState(id, "approve", "Organisation approuvée.");
	}

	/** Rejette une organisation en attente (admin). */
	public async rejectOrganization(id: number): Promise<boolean> {
		return this.setOrganizationState(id, "reject", "Organisation rejetée.");
	}

	private async setOrganizationState(
		id: number,
		action: "approve" | "reject",
		successDetail: string
	): Promise<boolean> {
		try {
			const res = await firstValueFrom(
				this.http.post<{ success: boolean; error?: any }>(
					`${this.API}/${id}/${action}`,
					{},
					{ withCredentials: true }
				)
			);
			if (!res.success) {
				this.msg.add({
					severity: "error",
					summary: "Erreur",
					detail: res.error ?? "Action impossible.",
				});
				return false;
			}
			this.msg.add({ severity: "success", summary: "Succès", detail: successDetail });
			await this.getAndSetDashboardOrganizations();
			return true;
		} catch (err: any) {
			const serverError =
				err.error?.error || err.error?.message || err.message || "Erreur de communication.";
			this.msg.add({ severity: "error", summary: "Erreur", detail: serverError });
			return false;
		}
	}
}
