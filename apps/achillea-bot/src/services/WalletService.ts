import { LockMode } from "@mikro-orm/core";
import { singleton } from "tsyringe";

import { Transaction, User, Wallet } from "@/entities";
import { TransactionType } from "@/utils/enums";
import { Database } from "./Database";

export class InsufficientBalanceError extends Error {
	constructor(userId: string, required: number, available: number) {
		super(`Insufficient balance for user ${userId}: required ${required}, available ${available}`);
		this.name = "InsufficientBalanceError";
	}
}

@singleton()
export class WalletService {
	constructor(private db: Database) {}

	async getOrCreate(userId: string): Promise<Wallet> {
		const em = this.db.em.fork();

		let wallet = await em.findOne(Wallet, { user: { id: userId } });

		if (!wallet) {
			const user = await em.findOneOrFail(User, { id: userId });
			wallet = em.create(Wallet, { user, balance: "0.00", currency: "ACH" });
			await em.persist(wallet).flush();
		}

		return wallet;
	}

	async getBalance(userId: string): Promise<number> {
		const wallet = await this.getOrCreate(userId);
		return parseFloat(wallet.balance);
	}

	// Crédit/débit/transfert : transaction + verrou PESSIMISTIC_WRITE sur la ligne
	// wallet (SELECT … FOR UPDATE) pour sérialiser les opérations concurrentes sur
	// le même solde — évite le read-modify-write race (double-dépense, solde négatif,
	// crédit perdu).

	async credit(
		userId: string,
		amount: number,
		reason: string,
		metadata?: Record<string, unknown>
	): Promise<Transaction> {
		return this.db.em.transactional(async (em) => {
			const wallet = await em.findOneOrFail(
				Wallet,
				{ user: { id: userId } },
				{ lockMode: LockMode.PESSIMISTIC_WRITE }
			);

			wallet.balance = (parseFloat(wallet.balance) + amount).toFixed(2);

			const tx = em.create(Transaction, {
				type: TransactionType.Credit,
				amount: amount.toFixed(2),
				reason,
				toUser: em.getReference(User, userId),
				fromUser: null,
				metadata: metadata ?? null,
			});
			em.persist(tx);
			return tx;
		});
	}

	async debit(
		userId: string,
		amount: number,
		reason: string,
		metadata?: Record<string, unknown>
	): Promise<Transaction> {
		return this.db.em.transactional(async (em) => {
			const wallet = await em.findOneOrFail(
				Wallet,
				{ user: { id: userId } },
				{ lockMode: LockMode.PESSIMISTIC_WRITE }
			);

			const current = parseFloat(wallet.balance);
			if (current < amount) {
				throw new InsufficientBalanceError(userId, amount, current);
			}

			wallet.balance = (current - amount).toFixed(2);

			const tx = em.create(Transaction, {
				type: TransactionType.Debit,
				amount: amount.toFixed(2),
				reason,
				fromUser: em.getReference(User, userId),
				toUser: null,
				metadata: metadata ?? null,
			});
			em.persist(tx);
			return tx;
		});
	}

	async transfer(
		fromUserId: string,
		toUserId: string,
		amount: number,
		reason: string
	): Promise<{ from: Transaction; to: Transaction }> {
		return this.db.em.transactional(async (em) => {
			// Verrouille les deux wallets dans un ordre déterministe (tri des userId)
			// pour éviter un deadlock quand A→B et B→A s'exécutent en même temps.
			const wallets = new Map<string, Wallet>();
			for (const id of [fromUserId, toUserId].sort()) {
				if (wallets.has(id)) continue;
				wallets.set(
					id,
					await em.findOneOrFail(Wallet, { user: { id } }, { lockMode: LockMode.PESSIMISTIC_WRITE })
				);
			}

			const fromWallet = wallets.get(fromUserId)!;
			const toWallet = wallets.get(toUserId)!;

			const fromBalance = parseFloat(fromWallet.balance);
			if (fromBalance < amount) {
				throw new InsufficientBalanceError(fromUserId, amount, fromBalance);
			}

			fromWallet.balance = (fromBalance - amount).toFixed(2);
			toWallet.balance = (parseFloat(toWallet.balance) + amount).toFixed(2);

			const base = {
				type: TransactionType.Transfer,
				amount: amount.toFixed(2),
				reason,
				fromUser: em.getReference(User, fromUserId),
				toUser: em.getReference(User, toUserId),
				metadata: null,
			} as const;

			const fromTx = em.create(Transaction, { ...base });
			const toTx = em.create(Transaction, { ...base });
			em.persist([fromTx, toTx]);

			return { from: fromTx, to: toTx };
		});
	}

	async getHistory(userId: string, limit = 20, offset = 0): Promise<Transaction[]> {
		const em = this.db.em.fork();

		return em.find(
			Transaction,
			{ $or: [{ fromUser: { id: userId } }, { toUser: { id: userId } }] },
			{ orderBy: { createdAt: "DESC" }, limit, offset }
		);
	}
}
