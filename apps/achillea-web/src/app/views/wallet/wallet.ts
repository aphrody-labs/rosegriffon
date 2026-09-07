import { Component, OnInit, computed, inject, signal } from "@angular/core";
import { CommonModule } from "@angular/common";
import { Router } from "@angular/router";
import { Card } from "primeng/card";
import { Button } from "primeng/button";
import { Tag } from "primeng/tag";
import { TableModule } from "primeng/table";
import { ProgressSpinner } from "primeng/progressspinner";

import { WalletService } from "../../shared/services/wallet-service";
import { UserService } from "../../shared/services/user-service";
import { WalletTransaction } from "../../core/models/Wallet";

@Component({
	selector: "app-wallet",
	standalone: true,
	imports: [CommonModule, Card, Button, Tag, TableModule, ProgressSpinner],
	templateUrl: "./wallet.html",
})
export class Wallet implements OnInit {
	private walletSvc = inject(WalletService);
	private user = inject(UserService);
	private router = inject(Router);

	readonly balance = this.walletSvc.balance;
	readonly currency = this.walletSvc.currency;
	readonly transactions = this.walletSvc.transactions;
	readonly hasMore = this.walletSvc.historyHasMore;
	readonly loading = signal<boolean>(true);
	readonly loadingMore = signal<boolean>(false);
	readonly limit = 20;
	readonly offset = signal<number>(0);

	// Solde formaté à la française (ex. « 1 250 »).
	readonly balanceLabel = computed(() => new Intl.NumberFormat("fr-FR").format(this.balance()));

	async ngOnInit(): Promise<void> {
		await this.user.loadUserIfNeeded();
		if (!this.user.user()) {
			void this.router.navigate(["/auth"]);
			return;
		}
		this.loading.set(true);
		await Promise.all([
			this.walletSvc.loadBalance(),
			this.walletSvc.loadHistory(this.limit, 0, false),
		]);
		this.loading.set(false);
	}

	async loadMore(): Promise<void> {
		const next = this.offset() + this.limit;
		this.loadingMore.set(true);
		try {
			await this.walletSvc.loadHistory(this.limit, next, true);
			this.offset.set(next);
		} finally {
			this.loadingMore.set(false);
		}
	}

	typeLabel(type: string): string {
		switch (type) {
			case "Credit":
				return "Crédit";
			case "Debit":
				return "Débit";
			case "Transfer":
				return "Transfert";
			case "Payout":
				return "Gain";
			case "Fine":
				return "Amende";
			default:
				return type;
		}
	}

	typeSeverity(type: string): "success" | "danger" | "info" | "warn" | "secondary" {
		switch (type) {
			case "Credit":
			case "Payout":
				return "success";
			case "Debit":
			case "Fine":
				return "danger";
			case "Transfer":
				return "info";
			default:
				return "secondary";
		}
	}

	// Montant signé selon le sens (+ entrant, − sortant).
	amountLabel(t: WalletTransaction): string {
		const sign = t.direction === "in" ? "+" : "−";
		const n = new Intl.NumberFormat("fr-FR").format(Math.abs(t.amount));
		return `${sign}${n}`;
	}
}
