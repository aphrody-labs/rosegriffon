/**
 * @file push-categories.ts
 * @description Importers réutilisables pour les catégories câblées tardivement
 * (uniforms, shops, tricks, special_tactics, telop_waza, video_waza, emblems).
 *
 * Source de vérité UNIQUE : ces fonctions sont appelées par le flux principal
 * `cli-push.ts` (séquence de push) ET par les scripts standalone
 * `scripts/push-<cat>.ts` (qui ne font que créer l'adaptateur Supabase et lancer
 * l'importer). Vivent sous `src/` pour rester dans le `rootDir` du build TS.
 *
 * 100% dérivé des octets RÉELS du dump (/home/ubuntu/data) via les parseurs
 * `src/parsers/*`. Aucune valeur fabriquée. Tous les upserts sont idempotents
 * (ON CONFLICT sur la clé primaire de chaque table).
 */

import { resolve } from "node:path";
import { toHex } from "./core/data-loader.js";
import { createInagleService } from "./index.js";
import { buildEmblemDatabase } from "./parsers/emblems.js";
import { loadShopConfig } from "./parsers/shop-config.js";
import { buildSpecialTacticsDatabase } from "./parsers/special-tactics-config.js";
import { buildTelopWazaDatabase } from "./parsers/telop-waza.js";
import { loadTextFile } from "./parsers/text-parser.js";
import { buildTrickDatabase } from "./parsers/trick-config.js";
import { buildUniformDatabase, resolveUniformRows } from "./parsers/uniform-config.js";
import { buildVideoWazaDatabase } from "./parsers/video-waza.js";
import type { DataAdapter } from "./push-adapter.js";

const DATA_PATH = process.env.DATA_PATH || "/home/ubuntu/data";

// === uniforms → inagle_uniforms (ON CONFLICT name_id) ===

export async function importUniforms(_service: any, db: DataAdapter) {
	console.log("🔄 Importing Uniforms...");
	const uniformDb = await buildUniformDatabase();
	const rows = resolveUniformRows(uniformDb);

	if (rows.length === 0) {
		console.error(
			"❌ 0 uniforme résolu — vérifier DATA_PATH et character/uniform_config (parse à vide)."
		);
		return;
	}

	const now = new Date().toISOString();
	const records = rows.map((r) => ({
		name_id: r.nameId,
		model_start: r.modelStart,
		model_count: r.modelCount,
		type_id: r.typeId,
		models: r.models,
		data: r,
		updated_at: now,
	}));

	const BATCH_SIZE = 200;
	let pushed = 0;
	for (let i = 0; i < records.length; i += BATCH_SIZE) {
		const batch = records.slice(i, i + BATCH_SIZE);
		const { error } = await db.upsert("inagle_uniforms", batch, "name_id");
		if (error) console.error("❌ Error batch uniforms:", error.message || error);
		else pushed += batch.length;
	}
	console.log(`✅ Uniforms imported (${pushed}/${records.length}).`);
}

// === shops → inagle_shops (ON CONFLICT id = "<shopId>:<itemId>") ===

export async function importShops(service: any, db: DataAdapter) {
	console.log("🔄 Importing Shops...");

	const shops = loadShopConfig(DATA_PATH);
	if (shops.length === 0) {
		console.error(`❌ Aucun shop parsé depuis ${DATA_PATH} — shop_config introuvable ou vide.`);
		return;
	}

	// Noms de shop localisés (shop_text fr/en/ja), indexés par hash hex.
	const shopFr = loadTextFile("shop", "fr");
	const shopEn = loadTextFile("shop", "en");
	const shopJa = loadTextFile("shop", "ja");

	// Items résolus depuis le service inagle (table items réelle), indexés par hex.
	const svc = service ?? (await createInagleService());
	const itemsByHex = new Map<
		string,
		{ id: string; fr: string | null; en: string | null; ja: string | null }
	>();
	for (const it of svc.items.allItems() as any[]) {
		const id = it.itemId || it.id;
		if (!id) continue;
		itemsByHex.set(String(id).toLowerCase(), {
			id: String(id),
			fr: it.names?.fr ?? null,
			en: it.names?.en ?? null,
			ja: it.names?.ja ?? null,
		});
	}

	// Construction des lignes (1 par shop × item).
	const rows: Record<string, unknown>[] = [];
	const updatedAt = new Date().toISOString();
	let resolvedShops = 0;
	let resolvedItems = 0;

	for (const shop of shops) {
		const nameHex = toHex(shop.nameHash);
		const nameFr = shopFr.get(nameHex) ?? null;
		const nameEn = shopEn.get(nameHex) ?? null;
		const nameJa = shopJa.get(nameHex) ?? null;
		if (nameFr || nameEn || nameJa) resolvedShops++;

		let slot = 0;
		for (const itemId of shop.items) {
			const itemHex = toHex(itemId);
			const resolved = itemsByHex.get(itemHex.toLowerCase());
			if (resolved) resolvedItems++;

			rows.push({
				id: `${shop.shopId}:${itemId}`,
				shop_id: shop.shopId,
				name_hash: shop.nameHash,
				name_fr: nameFr,
				name_en: nameEn,
				name_ja: nameJa,
				item_id: itemId,
				item_hex: itemHex,
				item_name_fr: resolved?.fr ?? null,
				item_name_en: resolved?.en ?? null,
				item_name_ja: resolved?.ja ?? null,
				item_db_id: resolved?.id ?? null,
				slot_index: slot,
				data: { shopId: shop.shopId, nameHash: shop.nameHash, itemId, itemHex },
				updated_at: updatedAt,
			});
			slot++;
		}
	}

	console.log(
		`   ↳ ${shops.length} shops, ${rows.length} lignes (shop×item). ` +
			`Shops nommés: ${resolvedShops}/${shops.length}. ` +
			`Items résolus: ${resolvedItems}/${rows.length}.`
	);

	const BATCH_SIZE = 500;
	let pushed = 0;
	for (let i = 0; i < rows.length; i += BATCH_SIZE) {
		const batch = rows.slice(i, i + BATCH_SIZE);
		const { error } = await db.upsert("inagle_shops", batch, "id");
		if (error) console.error("❌ Error batch shops:", error.message || error);
		else pushed += batch.length;
	}

	console.log(`✅ Shops imported (${pushed}/${rows.length}).`);
}

// === tricks → inagle_tricks (ON CONFLICT id = trickID hex) ===

export async function importTricks(_service: any, db: DataAdapter) {
	console.log("🔄 Importing Tricks...");
	const trickDb = await buildTrickDatabase();

	if (trickDb.tricks.length === 0) {
		console.error(
			"❌ 0 trick parsé — dump introuvable ? (DATA_PATH/DATA_ROOT doit pointer sur /home/ubuntu/data)"
		);
		return;
	}

	const now = new Date().toISOString();
	const records = trickDb.tricks.map((t) => ({
		id: t.trickId,
		trick_id_name: t.trickIdName,
		event_id: t.eventId,
		event_id_name: t.eventIdName,
		fail_event_id: t.failEventId,
		fail_event_id_name: t.failEventIdName,
		name_ja: t.trickNameJa,
		trick_category: t.trickCategory,
		trick_category_name: t.trickCategoryName,
		data: t,
		updated_at: now,
	}));

	// Dédup par clé primaire (sécurité — le config en a 9 distincts).
	const byId = new Map<string, (typeof records)[number]>();
	for (const r of records) byId.set(r.id, r);
	const deduped = [...byId.values()];

	const { error } = await db.upsert("inagle_tricks", deduped, "id");
	if (error) console.error("❌ Error tricks:", error.message || error);
	else console.log(`✅ Tricks imported (${deduped.length}).`);
}

// === special_tactics → inagle_special_tactics (ON CONFLICT id = tacticsId hex) ===

export async function importSpecialTactics(_service: any, db: DataAdapter) {
	console.log("🔄 Importing Special Tactics...");
	const dataPath = process.env.DATA_PATH ? resolve(process.env.DATA_PATH) : "/home/ubuntu/data";

	const tacticsDb = await buildSpecialTacticsDatabase(dataPath);
	if (tacticsDb.tactics.length === 0) {
		console.error(
			"❌ Parseur a renvoyé 0 tactique — config introuvable ou vide. Abandon (anti-fabrication)."
		);
		return;
	}

	const now = new Date().toISOString();
	const records = tacticsDb.tactics.map((t) => ({
		id: t.id, // tacticsId hex (clé primaire stable)
		internal_code: t.internalCode || null,
		name_fr: t.names.fr ?? null,
		name_en: t.names.en ?? null,
		name_ja: t.names.ja ?? null,
		description_fr: t.descriptions.fr ?? null,
		description_en: t.descriptions.en ?? null,
		description_ja: t.descriptions.ja ?? null,
		power: t.power,
		recast_time: t.recastTime,
		element_id: t.element,
		element: t.elementName,
		partner_count: t.partnerIds.length,
		partner_ids: t.partnerIds,
		data: {
			effectRef: t.effectRef ?? null,
			condRef: t.condRef ?? null,
			successCondRef: t.successCondRef ?? null,
		},
		updated_at: now,
	}));

	// Garde-fou unicité (la clé primaire est déjà unique côté DB).
	const byId = new Map<string, (typeof records)[number]>();
	for (const r of records) byId.set(r.id, r);
	const unique = Array.from(byId.values());

	const BATCH_SIZE = 100;
	let pushed = 0;
	for (let i = 0; i < unique.length; i += BATCH_SIZE) {
		const batch = unique.slice(i, i + BATCH_SIZE);
		const { error } = await db.upsert("inagle_special_tactics", batch, "id");
		if (error) console.error("❌ Error batch special_tactics:", error.message || error);
		else pushed += batch.length;
	}

	console.log(
		`✅ Special Tactics imported (${pushed}/${unique.length}, parsées ${tacticsDb.tactics.length}).`
	);
}

// === telop_waza → inagle_telop_waza (ON CONFLICT skill_id) ===

export async function importTelopWaza(_service: any, db: DataAdapter) {
	console.log("🔄 Importing Telop Waza...");
	const telopDb = await buildTelopWazaDatabase();
	console.log(`   ↳ Config parsé: ${telopDb.telops.length} télops de skill.`);

	if (telopDb.telops.length === 0) {
		console.error(
			"❌ Aucun télop parsé — vérifier DATA_PATH / skill_telop_info_config. Abandon (rien poussé)."
		);
		return;
	}

	const now = new Date().toISOString();
	const records = telopDb.telops.map((t) => ({
		skill_id: t.skillId,
		blank_left_index: t.blankLeftIndex,
		blank_right_index: t.blankRightIndex,
		eldorado_id: t.eldoradoId,
		left_blanks: t.left,
		right_blanks: t.right,
		data: t,
		updated_at: now,
	}));

	const BATCH_SIZE = 100;
	let pushed = 0;
	for (let i = 0; i < records.length; i += BATCH_SIZE) {
		const batch = records.slice(i, i + BATCH_SIZE);
		const { error } = await db.upsert("inagle_telop_waza", batch, "skill_id");
		if (error) console.error("❌ Error batch telop_waza:", error.message || error);
		else pushed += batch.length;
	}

	console.log(`✅ Telop Waza imported (${pushed}/${records.length}).`);
}

// === video_waza → inagle_video_waza (ON CONFLICT id = eventId hex) ===

export async function importVideoWaza(_service: any, db: DataAdapter) {
	console.log("🔄 Importing Video Waza...");
	const videoDb = await buildVideoWazaDatabase();
	console.log(
		`   ↳ Config parsé: ${videoDb.videos.length} vidéos, ${videoDb.subtitles.length} sous-titres, ${videoDb.captions.length} légendes.`
	);

	if (videoDb.videos.length === 0) {
		console.error(
			"❌ Aucune vidéo parsée — vérifier DATA_PATH / event_movie_config. Abandon (rien poussé)."
		);
		return;
	}

	const now = new Date().toISOString();
	const records = videoDb.videos.map((v) => ({
		id: v.id,
		event_id: v.eventId,
		menu_id: v.menuId,
		caption_id: v.captionId,
		movie_path: v.moviePath,
		bgm_name: v.bgmName,
		fede_in_time: v.fedeInTime,
		fede_out_time: v.fedeOutTime,
		staffroll_data_name: v.staffrollDataName,
		caption_name: v.caption?.captionName ?? null,
		caption_start_frame: v.caption?.startFrame ?? null,
		caption_end_frame: v.caption?.endFrame ?? null,
		data: v,
		updated_at: now,
	}));

	const BATCH_SIZE = 100;
	let pushed = 0;
	for (let i = 0; i < records.length; i += BATCH_SIZE) {
		const batch = records.slice(i, i + BATCH_SIZE);
		const { error } = await db.upsert("inagle_video_waza", batch, "id");
		if (error) console.error("❌ Error batch video_waza:", error.message || error);
		else pushed += batch.length;
	}

	console.log(`✅ Video Waza imported (${pushed}/${records.length}).`);
}

// === emblems → inagle_emblems (ON CONFLICT emblem_id) ===

export async function importEmblems(_service: any, db: DataAdapter) {
	console.log("🔄 Importing Emblems...");
	const emblemDb = await buildEmblemDatabase();

	if (emblemDb.emblems.length === 0) {
		console.error("❌ Aucun emblème parsé — config introuvable ou vide. Abandon.");
		return;
	}

	const now = new Date().toISOString();
	const records = emblemDb.emblems.map((e) => ({
		emblem_id: e.emblemId,
		emblem_name: e.emblemName,
		small_file_path: e.smallFilePath || null,
		small_tex_name: e.smallTexName || null,
		large_file_path: e.largeFilePath || null,
		large_tex_name: e.largeTexName || null,
		base_path: e.basePath || null,
		is_template: e.isTemplate,
		data: e,
		updated_at: now,
	}));

	console.log(
		`   ↳ ${records.length} emblèmes prêts (dont ${records.filter((r) => r.is_template).length} gabarit).`
	);

	const { error } = await db.upsert("inagle_emblems", records, "emblem_id");
	if (error) console.error("❌ Error emblems:", error.message || error);
	else console.log(`✅ Emblems imported (${records.length}).`);
}
