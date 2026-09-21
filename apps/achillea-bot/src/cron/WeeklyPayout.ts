import { Injectable } from "@/decorators";
import { User } from "@/entities";
import { UserRole } from "@/utils/enums";
import { resolveDependency } from "@/utils/functions";

import { Database } from "../services/Database";
import { WalletService } from "../services/WalletService";

const STAFF_PAYOUT_AMOUNT = 100;
const STAFF_PAYOUT_REASON = "Paiement hebdomadaire staff actif";
const STAFF_ACTIVE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class WeeklyPayout {
	/**
	 * Runs every Monday at midnight UTC.
	 * Credits 100 ACH to each staff member who interacted in the last 7 days.
	 */
	/**
	 * Point de compatibilité pour les appels manuels historiques. Le déclenchement
	 * autonome vit dans `@rosegriffon/cron` (`achillea:weekly-payout`) : le
	 * versement ne dépend donc plus de la disponibilité du bot Discord.
	 */
	async runWeeklyPayout() {
		const db = await resolveDependency(Database);
		const walletService = await resolveDependency(WalletService);
		const em = db.em.fork();

		const since = new Date(Date.now() - STAFF_ACTIVE_WINDOW_MS);

		const activeStaff = await em.find(User, {
			role: { $in: [UserRole.Moderator, UserRole.Administrator, UserRole.SuperAdministrator] },
			lastInteract: { $gte: since },
		});

		let paid = 0;
		let errors = 0;

		for (const staffMember of activeStaff) {
			try {
				await walletService.getOrCreate(staffMember.id);
				await walletService.credit(staffMember.id, STAFF_PAYOUT_AMOUNT, STAFF_PAYOUT_REASON, {
					source: "weekly-payout",
					week: new Date().toISOString().slice(0, 10),
				});
				paid++;
			} catch (err: unknown) {
				const msg = err instanceof Error ? err.message : String(err);
				console.warn(`[WeeklyPayout] failed for user ${staffMember.id}: ${msg}`);
				errors++;
			}
		}

		console.info(`[WeeklyPayout] done: ${paid} paid, ${errors} errors`);
	}
}
