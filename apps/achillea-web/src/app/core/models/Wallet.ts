// Modèles pour la feature Portefeuille (wallet).
// Côté serveur : entity Wallet + WalletTransaction (achillea-bot) — un solde par
// utilisateur dans une devise virtuelle (ex. ACH) + un journal de mouvements.

// Solde courant du portefeuille (GET /api/wallet/me).
export interface WalletBalance {
	balance: number;
	currency: string;
}

// Type de mouvement (doit matcher l'enum côté bot).
export type WalletTransactionType = "Credit" | "Debit" | "Transfer" | "Payout" | "Fine";

// Sens du mouvement vis-à-vis du solde du titulaire.
export type WalletTransactionDirection = "in" | "out";

// Une ligne du journal des transactions (GET /api/wallet/me/history).
export interface WalletTransaction {
	id: number;
	type: WalletTransactionType;
	amount: number;
	reason: string | null;
	direction: WalletTransactionDirection;
	createdAt: string;
}
