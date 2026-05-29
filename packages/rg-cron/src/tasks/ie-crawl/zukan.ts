/**
 * @license
 * Copyright 2026 Rose Griffon
 * SPDX-License-Identifier: Apache-2.0
 */

import { Browser, Page } from "@aphrody-code/bxc";
import { createSupabaseServiceClient, cache } from "@rose-griffon/db";
import * as cheerio from "cheerio";

const PER_PAGE = 200;
const MAX_PAGES = 30;
const HASH_RE = /cloudfront\.net\/1\/([^."\s]+)/;

export interface ZukanCharacter {
	id: string;
	name: string;
	zukanHash: string | null;
	position: string;
	element: string;
	game: string;
	order: number;
}

async function safeGoto(page: Page, url: string, timeout = 30000): Promise<unknown> {
	return Promise.race([
		page.goto(url),
		new Promise((_, reject) =>
			setTimeout(() => reject(new Error(`Navigation timeout (${timeout}ms) pour ${url}`)), timeout)
		),
	]);
}

export async function crawlZukanOrder(): Promise<{
	success: boolean;
	count: number;
	error?: string;
}> {
	console.log("[Crawl Zukan] Démarrage du crawl de l'ordre officiel des personnages...");

	const client = createSupabaseServiceClient();
	const allCharacters: ZukanCharacter[] = [];
	let globalIndex = 0;

	try {
		const page = (await Browser.newPage({
			profile: (process.env.BXC_PROFILE as "stealth" | "max" | "ghost" | "static" | "fast" | "http") || "stealth",
		})) as Page;

		for (let pageNum = 1; pageNum <= MAX_PAGES; pageNum++) {
			const url = `https://zukan.inazuma.jp/en/chara_param/?page=${pageNum}&per_page=${PER_PAGE}`;
			console.log(`[Crawl Zukan] Navigation vers page ${pageNum} : ${url}`);

			try {
				await safeGoto(page, url);
				await page.waitForSelector("ul.charaListBox", 15000).catch(() => {});
				const html = await page.content();
				const $ = cheerio.load(html);

				const listItems = $("ul.charaListBox > li");
				if (listItems.length === 0) {
					console.log(`[Crawl Zukan] Page ${pageNum} vide. Fin du crawl.`);
					break;
				}

				listItems.each((i, el) => {
					const img = $(el).find("img[src*='cloudfront']").first();
					const source = $(el).find("source[srcset*='cloudfront.net/1/']").first();
					const src = img.attr("src") || source.attr("srcset") || "";
					const hashMatch = src.match(HASH_RE);
					const zukanHash = (hashMatch && hashMatch[1]) || null;

					const name = img.attr("alt")?.trim() || "?";
					const position = $(el).find("dl:has(dt:contains('Position')) dd p").text().trim() || "?";
					const element = $(el).find("dl:has(dt:contains('Element')) dd p").text().trim() || "?";
					const game = $(el).find("dl.appearedWorks dd").text().trim() || "?";

					allCharacters.push({
						id: zukanHash || `chara-${globalIndex}`,
						name,
						zukanHash,
						position,
						element,
						game,
						order: globalIndex,
					});

					globalIndex++;
				});

				console.log(`[Crawl Zukan] Page ${pageNum} : ${listItems.length} personnages trouvés.`);
			} catch (err) {
				console.error(`[Crawl Zukan] Erreur sur la page ${pageNum} :`, err);
				break;
			}
		}

		await page.close();

		if (allCharacters.length === 0) {
			return { success: true, count: 0 };
		}

		console.log(
			`[Crawl Zukan] Fin du crawl. ${allCharacters.length} personnages trouvés. Vérification des changements via Redis...`
		);

		const orderMapObj: Record<string, number> = {};
		for (const char of allCharacters) {
			if (char.zukanHash) {
				orderMapObj[char.zukanHash] = char.order;
			}
		}

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

		// Récupérer les personnages de la DB pour mapper par zukan_hash
		const { data: dbChars, error: selectError } = await client
			.from("inagle_characters")
			.select("id, zukan_hash, name_en");

		if (selectError) {
			throw new Error(`Erreur de lecture DB : ${selectError.message}`);
		}

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
