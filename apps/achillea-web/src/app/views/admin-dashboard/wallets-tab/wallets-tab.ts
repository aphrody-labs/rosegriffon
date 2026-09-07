import { Component, OnInit, inject, signal } from "@angular/core";
import { DatePipe, DecimalPipe } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { TableModule } from "primeng/table";
import { Button } from "primeng/button";
import { InputText } from "primeng/inputtext";
import { InputNumber } from "primeng/inputnumber";
import { Dialog } from "primeng/dialog";

import { AdminOpsService } from "../../../shared/services/admin-ops-service";

@Component({
	selector: "app-admin-wallets-tab",
	standalone: true,
	imports: [
		DatePipe,
		DecimalPipe,
		FormsModule,
		TableModule,
		Button,
		InputText,
		InputNumber,
		Dialog,
	],
	templateUrl: "./wallets-tab.html",
})
export class AdminWalletsTabComponent implements OnInit {
	private ops = inject(AdminOpsService);
	readonly top = signal<
		Array<{ userId: string; displayName: string; balance: number; currency: string }>
	>([]);
	readonly recent = signal<
		Array<{
			id: string;
			type: string;
			amount: number;
			reason: string | null;
			fromUserId: string | null;
			toUserId: string | null;
			createdAt: string;
		}>
	>([]);
	readonly loading = signal(false);
	showAdjust = signal(false);
	adjustUserId = "";
	adjustAmount: number | null = null;
	adjustReason = "";

	async ngOnInit() {
		await this.reload();
	}

	async reload() {
		this.loading.set(true);
		try {
			const r = await this.ops.loadWallets(40);
			this.top.set(r.top);
			this.recent.set(r.recent);
		} catch {
			this.top.set([]);
			this.recent.set([]);
		} finally {
			this.loading.set(false);
		}
	}

	openAdjust(userId: string) {
		this.adjustUserId = userId;
		this.adjustAmount = null;
		this.adjustReason = "";
		this.showAdjust.set(true);
	}

	async submitAdjust() {
		if (!this.adjustUserId || this.adjustAmount == null || this.adjustAmount === 0) return;
		const ok = await this.ops.adjustWallet(
			this.adjustUserId,
			this.adjustAmount,
			this.adjustReason || "Ajustement dashboard"
		);
		if (ok) {
			this.showAdjust.set(false);
			await this.reload();
		}
	}
}
