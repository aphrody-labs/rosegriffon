import { Context, Controller, Get, QueryParams, Res, UseBefore } from "@tsed/common";
import { Unauthorized } from "@tsed/exceptions";
import type { Response } from "express";

import { CookieAuthorize } from "@/api/middlewares";
import { WalletService } from "@/services";
import { BaseController } from "@/utils/classes";
import { resolveDependenciesSync } from "@/utils/functions";

/**
 * /wallet — portefeuille virtuel du joueur connecté (lecture seule).
 *
 *   GET /wallet/me            -> { balance: number, currency: string }
 *   GET /wallet/me/history    -> { transactions: WalletTxDTO[] }  (?limit= ?offset=)
 *
 * Crédit / débit / transfert restent pilotés côté système (ranked, tournois, sanctions…),
 * pas exposés au joueur depuis le web.
 */
@Controller("/wallet")
export class WalletController extends BaseController {
	private walletService: WalletService;

	constructor() {
		super();
		[this.walletService] = resolveDependenciesSync([WalletService]);
	}

	/** Solde courant du joueur (crée le wallet à la volée si absent). */
	@Get("/me")
	@UseBefore(CookieAuthorize)
	async me(@Context() ctx: Context, @Res() res: Response) {
		const user = ctx.get("user");
		if (!user) throw new Unauthorized("Non authentifié");

		const wallet = await this.walletService.getOrCreate(user.id);
		return res.status(200).json({
			balance: parseFloat(wallet.balance),
			currency: wallet.currency,
		});
	}

	/** Historique des transactions (du plus récent au plus ancien), avec sens (in/out). */
	@Get("/me/history")
	@UseBefore(CookieAuthorize)
	async history(
		@QueryParams("limit") limit: string,
		@QueryParams("offset") offset: string,
		@Context() ctx: Context,
		@Res() res: Response
	) {
		const user = ctx.get("user");
		if (!user) throw new Unauthorized("Non authentifié");

		const lim = Math.min(100, Math.max(1, Math.floor(Number(limit ?? 20)) || 20));
		const off = Math.max(0, Math.floor(Number(offset ?? 0)) || 0);
		const txs = await this.walletService.getHistory(user.id, lim, off);

		return res.status(200).json({
			transactions: txs.map((t) => ({
				id: t.id,
				type: t.type,
				amount: parseFloat(t.amount),
				reason: t.reason ?? null,
				// Sens relatif au joueur : sortie si lui est l'émetteur, entrée sinon.
				direction: t.fromUser?.id === user.id ? "out" : "in",
				createdAt: t.createdAt,
			})),
		});
	}
}
