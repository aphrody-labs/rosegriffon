// @ts-nocheck
/**
 * @file item-config.ts
 * @description Parser for item_config files to extract items and link Uniforms
 */

import { join } from "node:path";
import { loadJsonAsync } from "../core/async-loader.ts";
import type { ConfigNode } from "../core/config-parser.ts";
import { findConfigFile, toHex } from "../core/data-loader.ts";
import { EntityExporters, type ExportableEntity } from "../core/exporters.ts";
import { loadTextFileAsync } from "./text-parser.ts";

export type ItemCategory =
	| "consume"
	| "shoes"
	| "misanga"
	| "accessory"
	| "special"
	| "formation"
	| "special_tactics"
	| "super_tactics"
	| "special_skill"
	| "title"
	| "fashion"
	| "costume"
	| "emblem"
	| "unique"
	| "craft_obj"
	| "animal"
	| "kizuna_link"
	| "name_plate"
	| "performance"
	| "important";

export interface ParsedItem extends ExportableEntity {
	itemId: string; // Hex
	internalCode?: string; // Asset ID / Filename base
	category: ItemCategory;
	rarity?: number;
	names?: { en?: string; fr?: string; ja?: string };
	descriptions?: { en?: string; fr?: string; ja?: string };
	imageUrl?: string;
	shops?: { en: string[]; fr: string[] };
	price?: number;
	stats?: { stat1: number; stat2: number };
	// Specific fields
	uniformId?: number; // For fashion items
}

const CATEGORY_MAP: Record<string, ItemCategory> = {
	ITEM_CONSUME_INFO: "consume",
	ITEM_SHOES_INFO: "shoes",
	ITEM_MISANGA_INFO: "misanga",
	ITEM_ACCESSORY_INFO: "accessory",
	ITEM_SPECIAL_INFO: "special",
	ITEM_FORMATION_INFO: "formation",
	ITEM_SPECIAL_TACTICS_INFO: "special_tactics",
	ITEM_SUPER_TACTICS_INFO: "super_tactics",
	ITEM_SPECIAL_SKILL_INFO: "special_skill",
	ITEM_TITLE_INFO: "title",
	ITEM_FASHION_INFO: "fashion",
	ITEM_COSTUME_INFO: "costume",
	ITEM_EMBLEM_INFO: "emblem",
	ITEM_UNIQUE_INFO: "unique",
	ITEM_CRAFT_OBJ_INFO: "craft_obj",
	ITEM_ANIMAL_INFO: "animal",
	ITEM_KIZUNA_LINK_INFO: "kizuna_link",
	ITEM_NAME_PLATE_INFO: "name_plate",
	ITEM_PERFORMANCE_INFO: "performance",
	ITEM_IMPORTANT_INFO: "important",
};

export async function loadFashionItemMappingAsync(dataPath: string): Promise<Map<number, number>> {
	const filename = findConfigFile("item", "item_config_");
	const mapping = new Map<number, number>();

	if (!filename) return mapping;
	const configPath = join(dataPath, "common", "gamedata", "item", filename);

	try {
		const content = await loadJsonAsync<any>(configPath);
		const entries = content.entries as ConfigNode[];

		function traverse(node: ConfigNode) {
			if (node.name.startsWith("ITEM_FASHION_INFO_")) {
				const vars = node.variables;
				if (vars.length > 0) {
					const itemIdStr = vars[0].value;
					const uniformIdStr = vars[vars.length - 1].value;
					if (itemIdStr && uniformIdStr) {
						mapping.set(
							Number.parseInt(itemIdStr, 10) >>> 0,
							Number.parseInt(uniformIdStr, 10) >>> 0
						);
					}
				}
			}
			if (node.children) node.children.forEach(traverse);
		}
		entries.forEach(traverse);
	} catch (e) {
		console.error("[item-config] Failed to parse item config for mapping", e);
	}
	return mapping;
}

export async function buildItemDatabaseAsync(
	dataPath: string,
	options?: { itemShops?: Map<number, { en: string[]; fr: string[] }> }
) {
	const filename = findConfigFile("item", "item_config_");

	const items: ParsedItem[] = [];
	const byId = new Map<string, ParsedItem>();
	const byCategory = new Map<ItemCategory, ParsedItem[]>();
	const stats = {} as Record<ItemCategory, number>;

	if (!filename) {
		console.warn("[item-config] Config not found");
		return {
			items,
			byId,
			byCategory,
			stats,
			toMarkdown: () => null,
			toReact: () => null,
		};
	}
	const configPath = join(dataPath, "common", "gamedata", "item", filename);

	// Load Texts (Parallel)
	const [textEn, textFr, textJa, descEn, descFr, descJa] = await Promise.all([
		loadTextFileAsync("item", "en"),
		loadTextFileAsync("item", "fr"),
		loadTextFileAsync("item", "ja"),
		loadTextFileAsync("item_explain", "en"),
		loadTextFileAsync("item_explain", "fr"),
		loadTextFileAsync("item_explain", "ja"),
	]);

	try {
		const content = await loadJsonAsync<any>(configPath);

		if (!content?.entries) {
			console.error(
				"[ItemParser] Invalid config structure:",
				content ? Object.keys(content) : "null"
			);
			return { items, byId, byCategory, stats, toMarkdown: () => null, toReact: () => null };
		}

		const entries = content.entries as ConfigNode[];

		function traverse(node: ConfigNode) {
			for (const [prefix, category] of Object.entries(CATEGORY_MAP)) {
				if (node.name.startsWith(prefix) && !node.name.includes("_LIST_BEG_")) {
					const vars = node.variables;
					if (vars.length > 0) {
						const itemIdInt = Number.parseInt(vars[0].value, 10) >>> 0;
						const itemIdHex = toHex(itemIdInt);

						const nameIdInt = vars.length > 2 ? Number.parseInt(vars[2].value, 10) : 0;
						const nameIdHex = toHex(nameIdInt);

						const descIdInt = vars.length > 3 ? Number.parseInt(vars[3].value, 10) : 0;
						const descIdHex = toHex(descIdInt);

						// Names & Desc
						const nameEn = textEn.get(nameIdHex);
						const nameFr = textFr.get(nameIdHex);
						const nameJa = textJa.get(nameIdHex);

						const dEn = descEn.get(descIdHex);
						const dFr = descFr.get(descIdHex);
						const dJa = descJa.get(descIdHex);

						// Asset ID is reliably at index 11
						const internalCode = vars.length > 11 ? vars[11].value : undefined;

						const item: ParsedItem = {
							id: itemIdHex,
							name: nameFr || nameEn || nameJa || `${category}_${itemIdHex}`,
							description: dFr || dEn || dJa,
							itemId: itemIdHex,
							internalCode,
							category,
							names: { en: nameEn, fr: nameFr, ja: nameJa },
							descriptions: { en: dEn, fr: dFr, ja: dJa },
							shops: options?.itemShops?.get(itemIdInt),
							attributes: {
								Catégorie: category,
								ID: itemIdHex,
							},
						};

						// Price extraction (vars[4] is buy price for all item types)
						if (vars.length > 4) {
							const price = Number.parseInt(vars[4].value, 10);
							if (price > 0) {
								item.price = price;
								item.attributes!.Prix = price;
							}
						}

						// Equipment stats extraction
						if (
							category === "shoes" ||
							category === "misanga" ||
							category === "accessory" ||
							category === "special" ||
							category === "fashion"
						) {
							if (vars.length > 6) {
								item.stats = {
									stat1: Number.parseInt(vars[5].value, 10),
									stat2: Number.parseInt(vars[6].value, 10),
								};
								item.attributes!["Stat 1"] = item.stats.stat1;
								item.attributes!["Stat 2"] = item.stats.stat2;
							}
						}

						// Fashion logic
						if (category === "fashion") {
							const uniformIdStr = vars[vars.length - 1].value;
							if (uniformIdStr) {
								item.uniformId = Number.parseInt(uniformIdStr, 10) >>> 0;
								item.attributes!["Uniforme ID"] = item.uniformId;
							}
						}

						items.push(item);
						byId.set(itemIdHex, item);
						if (!byCategory.has(category)) byCategory.set(category, []);
						byCategory.get(category)?.push(item);
						stats[category] = (stats[category] || 0) + 1;
					}
				}
			}

			if (node.children) node.children.forEach(traverse);
		}

		entries.forEach(traverse);
	} catch (e) {
		console.error("[item-config] Build failed", e);
	}

	return {
		items,
		byId,
		byCategory,
		stats,
		toMarkdown: (id: string) => {
			const i = byId.get(id);
			return i ? EntityExporters.toMarkdown(i, "Objet") : null;
		},
		toReact: (id: string) => {
			const i = byId.get(id);
			return i ? EntityExporters.toReact(i) : null;
		},
	};
}

// Deprecate sync
export function buildItemDatabase(_dataPath: string) {
	throw new Error("Synchronous buildItemDatabase is deprecated.");
}
export function loadFashionItemMapping(_dataPath: string) {
	throw new Error("Synchronous loadFashionItemMapping is deprecated.");
}
export function loadItemConfig(_dataPath: string) {
	throw new Error("Synchronous loadItemConfig is deprecated.");
}
