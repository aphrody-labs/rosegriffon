import { Component, OnInit, inject, signal } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { HttpClient } from "@angular/common/http";
import { firstValueFrom } from "rxjs";
import { TableModule } from "primeng/table";
import { Button } from "primeng/button";
import { InputNumber } from "primeng/inputnumber";
import { Dialog } from "primeng/dialog";
import { MessageService } from "primeng/api";

import { UserService } from "../../../shared/services/user-service";
import { ClanDTO } from "../../../core/models/Clan";
import { ClanInfoForm } from "../../../shared/components/clan-info-form/clan-info-form";

interface PendingClanRow {
	id: number;
	name: string;
	shortenedName: string;
	clanAvatarUrl: string;
	founders: string[];
	createdAt: string;
}

interface ClanMemberLimits {
	playerLimit: number;
	staffLimit: number;
}

@Component({
	selector: "app-clans-tab",
	standalone: true,
	imports: [CommonModule, FormsModule, TableModule, Button, InputNumber, Dialog, ClanInfoForm],
	templateUrl: "./clans-tab.html",
})
export class ClansTabComponent implements OnInit {
	private http = inject(HttpClient);
	private msg = inject(MessageService);
	protected userService = inject(UserService);

	readonly clans = signal<PendingClanRow[]>([]);
	readonly loading = signal(false);
	readonly limitsLoading = signal(false);
	readonly limitsSaving = signal(false);
	readonly playerLimit = signal(30);
	readonly staffLimit = signal(7);

	// Gestion des clans actifs (page "gestion des clans") : liste + édition complète
	// (mêmes champs que le président de clan) + bascule inactif rapide.
	readonly managedClans = signal<ClanDTO[]>([]);
	readonly managedClansLoading = signal(false);
	readonly togglingClanId = signal<number | null>(null);
	readonly editingClan = signal<ClanDTO | null>(null);

	async ngOnInit(): Promise<void> {
		await Promise.all([this.refresh(), this.refreshManagedClans(), this.loadMemberLimits()]);
	}

	async refresh(): Promise<void> {
		this.loading.set(true);
		try {
			const res = await firstValueFrom(
				this.http.get<{ data: PendingClanRow[] }>("/api/clans", {
					params: { state: "1", page: "1", pagination: "50" },
					withCredentials: true,
				})
			);
			this.clans.set(res?.data ?? []);
		} catch {
			this.clans.set([]);
		}
		this.loading.set(false);
	}

	async refreshManagedClans(): Promise<void> {
		this.managedClansLoading.set(true);
		try {
			const res = await firstValueFrom(
				this.http.get<{ data: ClanDTO[] }>("/api/clans", {
					// state=2 (Approved) : clans actifs, hors revue/dissous.
					params: { state: "2", page: "1", pagination: "50" },
					withCredentials: true,
				})
			);
			this.managedClans.set(res?.data ?? []);
		} catch {
			this.managedClans.set([]);
		}
		this.managedClansLoading.set(false);
	}

	openEdit(clan: ClanDTO): void {
		this.editingClan.set(clan);
	}

	closeEdit(): void {
		this.editingClan.set(null);
	}

	onClanSaved(updated: ClanDTO): void {
		this.managedClans.update((rows) => rows.map((r) => (r.id === updated.id ? updated : r)));
		this.msg.add({ severity: "success", summary: "Clan", detail: `${updated.name} mis à jour.` });
		this.editingClan.set(null);
	}

	async toggleInactive(clan: ClanDTO): Promise<void> {
		if (!this.userService.userIsAdmin()) return;

		const next = !clan.isInactive;
		this.togglingClanId.set(clan.id);
		try {
			const res = await firstValueFrom(
				this.http.patch<{ success: boolean; error?: string }>(
					`/api/clans/${clan.id}`,
					{ isInactive: next },
					{ withCredentials: true }
				)
			);
			if (res.success) {
				this.managedClans.update((rows) =>
					rows.map((r) => (r.id === clan.id ? { ...r, isInactive: next } : r))
				);
				this.msg.add({
					severity: "success",
					summary: "Clan",
					detail: next ? `${clan.name} marqué comme inactif.` : `${clan.name} réactivé.`,
				});
			} else {
				this.msg.add({
					severity: "error",
					summary: "Clan",
					detail: res.error ?? "Impossible de mettre à jour le statut du clan.",
				});
			}
		} catch (err: any) {
			this.msg.add({
				severity: "error",
				summary: "Clan",
				detail: err?.error?.error ?? "Erreur de communication avec le serveur.",
			});
		}
		this.togglingClanId.set(null);
	}

	async loadMemberLimits(): Promise<void> {
		this.limitsLoading.set(true);
		try {
			const limits = await firstValueFrom(
				this.http.get<ClanMemberLimits>("/api/clans/member-limits", { withCredentials: true })
			);
			this.playerLimit.set(limits.playerLimit);
			this.staffLimit.set(limits.staffLimit);
		} catch {
			this.msg.add({
				severity: "error",
				summary: "Limites clan",
				detail: "Impossible de charger les limites d'effectif.",
			});
		}
		this.limitsLoading.set(false);
	}

	async saveMemberLimits(): Promise<void> {
		if (!this.userService.userIsAdmin()) return;

		this.limitsSaving.set(true);
		try {
			const limits = await firstValueFrom(
				this.http.patch<ClanMemberLimits>(
					"/api/clans/member-limits",
					{
						playerLimit: this.playerLimit(),
						staffLimit: this.staffLimit(),
					},
					{ withCredentials: true }
				)
			);
			this.playerLimit.set(limits.playerLimit);
			this.staffLimit.set(limits.staffLimit);
			this.msg.add({
				severity: "success",
				summary: "Limites clan",
				detail: `Effectifs mis à jour : ${limits.playerLimit} joueurs, ${limits.staffLimit} staff.`,
			});
		} catch {
			this.msg.add({
				severity: "error",
				summary: "Limites clan",
				detail: "Échec de la mise à jour des limites d'effectif.",
			});
		}
		this.limitsSaving.set(false);
	}
}
