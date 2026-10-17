import { Injectable, signal, inject } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { firstValueFrom } from "rxjs";
import { MessageService } from "primeng/api";

import { WalletBalance, WalletTransaction } from "../../core/models/Wallet";

@Injectable({ providedIn: "root" })
export class WalletService {
	private http = inject(HttpClient);
	private msg = inject(MessageService);

	private readonly API = "/api/wallet";

	readonly balance = signal<number>(0);
	readonly currency = signal<string>("");
	readonly transactions = signal<WalletTransaction[]>([]);
	// True tant que la dernière page renvoyée était pleine (il reste à charger).
	readonly historyHasMore = signal<boolean>(false);

	// Charge le solde courant du portefeuille.
	async loadBalance(): Promise<WalletBalance | null> {
		try {
			const resp = await firstValueFrom(
				this.http.get<WalletBalance>(`${this.API}/me`, { withCredentials: true })
			);
			this.balance.set(resp.balance);
			this.currency.set(resp.currency);
			return resp;
		} catch {
			this.msg.add({
				severity: "error",
				summary: "Portefeuille indisponible",
				detail: "Impossible de charger ton solde",
			});
			return null;
		}
	}

	// Charge l'historique paginé. `append` concatène (bouton « Charger plus »).
	async loadHistory(limit = 20, offset = 0, append = false): Promise<WalletTransaction[]> {
		try {
			const resp = await firstValueFrom(
				this.http.get<{ transactions: WalletTransaction[] }>(`${this.API}/me/history`, {
					params: { limit: limit.toString(), offset: offset.toString() },
					withCredentials: true,
				})
			);
			const list = resp.transactions ?? [];
			if (append) this.transactions.update((cur) => [...cur, ...list]);
			else this.transactions.set(list);
			this.historyHasMore.set(list.length === limit);
			return list;
		} catch {
			if (!append) this.transactions.set([]);
			this.historyHasMore.set(false);
			this.msg.add({
				severity: "error",
				summary: "Historique indisponible",
				detail: "Impossible de charger tes transactions",
			});
			return [];
		}
	}
}
