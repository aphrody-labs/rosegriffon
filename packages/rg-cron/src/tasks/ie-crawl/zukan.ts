/**
 * @license
 * Copyright 2026 Rose Griffon
 * SPDX-License-Identifier: Apache-2.0
 */

import { createSupabaseServiceClient, cache } from "@rosegriffon/db";
import { buildOrderMap, crawlZukanOrderPages } from "@rosegriffon/inagle/zukan/order";
import { sql } from "../../lib/db.js";

// Le scraper d'ordre (navigation bxc + parsing cheerio des pages chara_param) est
// désormais unifié dans `@rosegriffon/inagle/zukan/order` (leaf, hors barrel car
// il tire @aphrody-code/bxc). Ce fichier ne garde que l'orchestration prod :
// diff Redis + écriture `zukan_order` sur Supabase. Comportement identique.

/** @deprecated Réexport de compatibilité — type unifié dans le module order. */
export type { ZukanOrderCharacter as ZukanCharacter } from "@rosegriffon/inagle/zukan/order";

export async function crawlZukanOrder(): Promise<{
	success: boolean;
	count: number;
	error?: string;
}> {
	console.log("[Crawl Zukan] Démarrage du crawl de l'ordre officiel des personnages...");

	const client = createSupabaseServiceClient();

	try {
		const allCharacters = await crawlZukanOrderPages();

		if (allCharacters.length === 0) {
			return { success: true, count: 0 };
		}

		console.log(
			`[Crawl Zukan] Fin du crawl. ${allCharacters.length} personnages trouvés. Vérification des changements via Redis...`
		);

		const orderMapObj = buildOrderMap(allCharacters);

		const cacheKey = "crawl:zukan:orders";
		const cachedOrders = await cache.get<Record<string, number>>(cacheKey);

		const hasChanged =
			!cachedOrders || JSON.stringify(cachedOrders) !== JSON.stringify(orderMapObj);

		if (!hasChanged) {
			console.log(
				"[Crawl Zukan] L'ordre des personnages n'a pas changé par rapport au dernier crawl. Synchronisation sautée."
			);
			return { success: true, count: allCharacters.length };
		}

		console.log(
			"[Crawl Zukan] Des changements d'ordre ont été détectés. Mise à jour de Supabase..."
		);

		// Mise à jour de la table inagle_characters dans Supabase
		let updatedCount = 0;

		// Récupérer les personnages de la DB pour mapper par zukan_hash (lecture Postgres directe)
		const dbChars = await sql<
			{ id: string; zukan_hash: string | null; name_en: string | null }[]
		>`SELECT id, zukan_hash, name_en FROM inagle_characters`;

		if (dbChars && dbChars.length > 0) {
			// Créer une map hash -> order
			const hashToOrder = new Map<string, number>();
			for (const key of Object.keys(orderMapObj)) {
				const val = orderMapObj[key];
				if (val !== undefined) {
					hashToOrder.set(key, val);
				}
			}

			for (const char of dbChars) {
				if (char.zukan_hash) {
					const order = hashToOrder.get(char.zukan_hash);
					if (order !== undefined) {
						const { error: updateError } = await client
							.from("inagle_characters")
							.update({ zukan_order: order })
							.eq("id", char.id);

						if (updateError) {
							console.error(
								`[Crawl Zukan] Erreur de mise à jour pour ${char.name_en} :`,
								updateError.message
							);
						} else {
							updatedCount++;
						}
					}
				}
			}
		}

		// Sauvegarder les nouveaux ordres dans Redis
		await cache.set(cacheKey, orderMapObj, 86400 * 7); // Expiration de 7 jours

		console.log(
			`[Crawl Zukan] Base de données mise à jour. ${updatedCount} personnages synchronisés.`
		);
		return { success: true, count: allCharacters.length };
	} catch (err: any) {
		console.error("[Crawl Zukan] Erreur critique lors du crawl Zukan :", err);
		return { success: false, count: 0, error: err.message || String(err) };
	}
}
