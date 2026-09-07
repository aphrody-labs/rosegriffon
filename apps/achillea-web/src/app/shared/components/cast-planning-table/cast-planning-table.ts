import { Component, EventEmitter, Input, Output, signal } from "@angular/core";
import { DatePipe } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { TableModule } from "primeng/table";
import { Tag } from "primeng/tag";
import { Button } from "primeng/button";
import { Dialog } from "primeng/dialog";
import { InputText } from "primeng/inputtext";

import {
	castSlotRoleLabel,
	type CastAttribution,
	type CastSlot,
	type ChecklistItem,
} from "../../../core/models/Cast";

export interface SwapRequest {
	attributionId: string;
	newCasterId: string;
}

@Component({
	selector: "app-cast-planning-table",
	standalone: true,
	imports: [DatePipe, TableModule, Tag, Button, Dialog, InputText, FormsModule],
	templateUrl: "./cast-planning-table.html",
	styleUrl: "./cast-planning-table.css",
})
export class CastPlanningTable {
	@Input() checklist: ChecklistItem[] = [];
	@Input() loading = false;

	@Output() swapRequested = new EventEmitter<SwapRequest>();
	@Output() confirmRequested = new EventEmitter<string>();

	showSwapDialog = signal(false);
	selectedAttribution: CastAttribution | null = null;
	selectedSlot: CastSlot | null = null;
	newCasterId = "";

	openSwapDialog(item: ChecklistItem): void {
		this.selectedAttribution = item.attribution;
		this.selectedSlot = item.slot;
		this.newCasterId = "";
		this.showSwapDialog.set(true);
	}

	confirmSwap(): void {
		if (!this.selectedAttribution || !this.newCasterId.trim()) return;
		this.swapRequested.emit({
			attributionId: this.selectedAttribution.id,
			newCasterId: this.newCasterId.trim(),
		});
		this.showSwapDialog.set(false);
	}

	onConfirm(attributionId: string): void {
		this.confirmRequested.emit(attributionId);
	}

	protected readonly castSlotRoleLabel = castSlotRoleLabel;
}
