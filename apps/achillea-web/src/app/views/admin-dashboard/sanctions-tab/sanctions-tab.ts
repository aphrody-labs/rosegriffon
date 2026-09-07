import { Component, OnInit, signal, inject } from "@angular/core";
import { DatePipe } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { TableModule, TablePageEvent } from "primeng/table";
import { Tag } from "primeng/tag";
import { Button } from "primeng/button";
import { Select } from "primeng/select";
import { InputText } from "primeng/inputtext";
import { Dialog } from "primeng/dialog";
import { Textarea } from "primeng/textarea";

import {
	CreateSanctionPayload,
	Sanction,
	SanctionType,
	sanctionTypeLabel,
	sanctionTypeSeverity,
} from "../../../core/models/Sanction";
import { SanctionService } from "../../../shared/services/sanction-service";
import { SanctionFormDialog } from "../../../shared/components/sanction-form-dialog/sanction-form-dialog";

interface SelectOption {
	label: string;
	value: string | null;
}

@Component({
	selector: "app-sanctions-tab",
	standalone: true,
	imports: [
		TableModule,
		Tag,
		Button,
		Select,
		InputText,
		Dialog,
		Textarea,
		DatePipe,
		FormsModule,
		SanctionFormDialog,
	],
	templateUrl: "./sanctions-tab.html",
	styleUrl: "./sanctions-tab.css",
})
export class SanctionsTabComponent implements OnInit {
	private sanctionSvc = inject(SanctionService);

	sanctions = signal<Sanction[]>([]);
	total = signal<number>(0);
	loading = signal<boolean>(false);

	// Filtres
	filterUserId = "";
	filterType: SanctionType | null = null;
	filterActive: string | null = null;
	currentPage = 1;
	readonly pageSize = 50;

	// Dialogs
	showCreateDialog = signal<boolean>(false);
	showRevokeDialog = signal<boolean>(false);
	showAppealDialog = signal<boolean>(false);
	selectedSanction: Sanction | null = null;
	revokeReason = "";
	appealMessage = "";

	typeFilterOptions: SelectOption[] = [
		{ label: "Tous les types", value: null },
		...Object.values(SanctionType).map((t) => ({
			label: sanctionTypeLabel(t),
			value: t,
		})),
	];

	activeFilterOptions: SelectOption[] = [
		{ label: "Toutes", value: null },
		{ label: "Actives uniquement", value: "true" },
		{ label: "Inactives uniquement", value: "false" },
	];

	async ngOnInit(): Promise<void> {
		await this.loadSanctions();
	}

	async loadSanctions(): Promise<void> {
		this.loading.set(true);
		const result = await this.sanctionSvc.list({
			userId: this.filterUserId || undefined,
			type: this.filterType ?? undefined,
			active: this.filterActive !== null ? this.filterActive === "true" : undefined,
			page: this.currentPage,
			pageSize: this.pageSize,
		});
		this.sanctions.set(result.data);
		this.total.set(result.total);
		this.loading.set(false);
	}

	async onFilter(): Promise<void> {
		this.currentPage = 1;
		await this.loadSanctions();
	}

	async onPageChange(event: TablePageEvent): Promise<void> {
		this.currentPage = event.first / this.pageSize + 1;
		await this.loadSanctions();
	}

	async onCreate(payload: CreateSanctionPayload): Promise<void> {
		const result = await this.sanctionSvc.create(payload);
		if (result) await this.loadSanctions();
	}

	openRevokeDialog(sanction: Sanction): void {
		this.selectedSanction = sanction;
		this.revokeReason = "";
		this.showRevokeDialog.set(true);
	}

	async confirmRevoke(): Promise<void> {
		if (!this.selectedSanction) return;
		const result = await this.sanctionSvc.revoke(
			this.selectedSanction.id,
			this.revokeReason || undefined
		);
		if (result) {
			this.showRevokeDialog.set(false);
			await this.loadSanctions();
		}
	}

	openAppealDialog(sanction: Sanction): void {
		this.selectedSanction = sanction;
		this.appealMessage = "";
		this.showAppealDialog.set(true);
	}

	async confirmAppeal(): Promise<void> {
		if (!this.selectedSanction || !this.appealMessage.trim()) return;
		const result = await this.sanctionSvc.appeal(this.selectedSanction.id, this.appealMessage);
		if (result) {
			this.showAppealDialog.set(false);
			await this.loadSanctions();
		}
	}

	isActive(sanction: Sanction): boolean {
		if (sanction.revokedAt) return false;
		if (!sanction.expiresAt) return true;
		return new Date(sanction.expiresAt) > new Date();
	}

	protected readonly sanctionTypeSeverity = sanctionTypeSeverity;
	protected readonly sanctionTypeLabel = sanctionTypeLabel;
}
