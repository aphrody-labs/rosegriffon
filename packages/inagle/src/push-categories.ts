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
import { buildBoostPlayerGroupDatabase } from "./parsers/boost-player-group-config.js";
import { getAllConstellations } from "./parsers/constellation.js";
import { buildEmblemDatabase } from "./parsers/emblems.js";
import { buildMissionDatabase } from "./parsers/mission-config.js";
import { loadShopConfig } from "./parsers/shop-config.js";
import { buildSkillTechnicDatabase } from "./parsers/skill-technic-config.js";
import { buildSpecialTacticsDatabase } from "./parsers/special-tactics-config.js";
import { buildStarSignMap, type StarSignCharaInfo } from "./parsers/star-sign.js";
import { buildSuperTacticsBaseDatabase } from "./parsers/super-tactics-base-config.js";
import { buildTeamBuildDatabase } from "./parsers/team-build-config.js";
import { buildTelopWazaDatabase } from "./parsers/telop-waza.js";
import { loadTextFile } from "./parsers/text-parser.js";
import { buildTrickDatabase } from "./parsers/trick-config.js";
import { buildTrophyDatabase, type ParsedTrophy } from "./parsers/trophy-config.js";
import { buildUniformDatabase, resolveUniformRows } from "./parsers/uniform-config.js";
import { buildVideoWazaDatabase } from "./parsers/video-waza.js";
import { dedup, type DataAdapter } from "./push-adapter.js";

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

// === super_tactics → inagle_super_tactics (ON CONFLICT id = "<kind>:<idx>") ===

export async function importSuperTactics(_service: any, db: DataAdapter) {
	console.log("🔄 Importing Super Tactics...");
	const parsed = await buildSuperTacticsBaseDatabase(DATA_PATH);
	const effects = parsed.effects || [];
	const tactics = parsed.tactics || [];

	if (effects.length === 0 && tactics.length === 0) {
		console.error(
			`❌ Parser super_tactics n'a produit AUCUNE entrée (DATA_PATH=${DATA_PATH}). Source réelle introuvable ou vide — abandon (pas de table fabriquée).`
		);
		return;
	}

	const now = new Date().toISOString();
	const rows: any[] = [];

	effects.forEach((eff, idx) => {
		rows.push({
			id: `effect:${idx}`,
			kind: "effect",
			idx,
			crc_id: eff.effectId,
			conditions: eff.conditions ?? [],
			data: eff,
			updated_at: now,
		});
	});

	tactics.forEach((tac, idx) => {
		rows.push({
			id: `tactic:${idx}`,
			kind: "tactic",
			idx,
			crc_id: tac.id ?? "",
			conditions: null,
			data: tac,
			updated_at: now,
		});
	});

	const deduped = dedup(rows, "id");
	const { error } = await db.upsert("inagle_super_tactics", deduped, "id");
	if (error) console.error("❌ Error super_tactics:", error.message || error);
	else
		console.log(
			`✅ Super Tactics imported (${deduped.length} — ${effects.length} effects + ${tactics.length} tactics).`
		);
}

// === skill_technic → inagle_skill_technic (ON CONFLICT id = hash hex) ===

export async function importSkillTechnic(_service: any, db: DataAdapter) {
	console.log("🔄 Importing Skill Technic...");
	const technicDb = await buildSkillTechnicDatabase(process.env.DATA_PATH);
	const technics = technicDb.technics;

	if (technics.length === 0) {
		console.error(
			"❌ 0 technic résolu — vérifier DATA_PATH et skill/skill_technic_config (parse à vide)."
		);
		return;
	}

	const now = new Date().toISOString();
	const records = technics.map((t) => ({
		id: t.id,
		win_sub_motion_name_crc: t.winSubMotionNameCrc,
		lose_sub_motion_name_crc: t.loseSubMotionNameCrc,
		lose_type: t.loseType,
		formation_type: t.formationType,
		formation_chara_len: t.formationCharaLen,
		shoot_curve_mid_rate: t.shootCurveMidRate,
		shoot_curve_height_rate: t.shootCurveHeightRate,
		shoot_curve_angle: t.shootCurveAngle,
		data: t,
		updated_at: now,
	}));

	// Dédup défensif sur la PK (id hex), au cas où un dump dupliquerait une entrée.
	const deduped = dedup(records, "id");

	const BATCH_SIZE = 200;
	let pushed = 0;
	for (let i = 0; i < deduped.length; i += BATCH_SIZE) {
		const batch = deduped.slice(i, i + BATCH_SIZE);
		const { error } = await db.upsert("inagle_skill_technic", batch, "id");
		if (error) console.error("❌ Error batch skill_technic:", error.message || error);
		else pushed += batch.length;
	}
	console.log(`✅ Skill Technic imported (${pushed}/${deduped.length}).`);
}

// === team_build → inagle_team_build (ON CONFLICT id = "<section>:<index>") ===

export async function importTeamBuild(_service: any, db: DataAdapter) {
	console.log("🔄 Importing Team Build...");
	const teamBuildDb = await buildTeamBuildDatabase(DATA_PATH);

	const total =
		teamBuildDb.effectData.length +
		teamBuildDb.effectInfos.length +
		teamBuildDb.upData.length +
		teamBuildDb.downData.length +
		teamBuildDb.buildInfos.length;

	if (total === 0) {
		console.error(
			"❌ 0 entrée team_build — vérifier DATA_PATH et skill/team_build_config_*.cfg.bin.json (parse à vide)."
		);
		return;
	}

	const now = new Date().toISOString();
	const records: Record<string, unknown>[] = [];

	teamBuildDb.effectData.forEach((r, i) => {
		records.push({
			id: `effect_data:${i}`,
			section: "effect_data",
			idx: i,
			effect_id: r.effectId,
			effect_ref_id: null,
			type: null,
			threshold: r.threshold,
			value: r.value,
			multiplier: null,
			build_type: null,
			build_level: null,
			data: r,
			updated_at: now,
		});
	});

	teamBuildDb.effectInfos.forEach((r, i) => {
		records.push({
			id: `effect_info:${i}`,
			section: "effect_info",
			idx: i,
			effect_id: null,
			effect_ref_id: null,
			type: null,
			threshold: null,
			value: null,
			multiplier: null,
			build_type: null,
			build_level: null,
			data: r,
			updated_at: now,
		});
	});

	teamBuildDb.upData.forEach((r, i) => {
		records.push({
			id: `up_data:${i}`,
			section: "up_data",
			idx: i,
			effect_id: null,
			effect_ref_id: r.effectRefId,
			type: r.type,
			threshold: r.threshold,
			value: null,
			multiplier: r.multiplier,
			build_type: null,
			build_level: null,
			data: r,
			updated_at: now,
		});
	});

	teamBuildDb.downData.forEach((r, i) => {
		records.push({
			id: `down_data:${i}`,
			section: "down_data",
			idx: i,
			effect_id: null,
			effect_ref_id: r.effectRefId,
			type: r.type,
			threshold: r.threshold,
			value: null,
			multiplier: r.multiplier,
			build_type: null,
			build_level: null,
			data: r,
			updated_at: now,
		});
	});

	teamBuildDb.buildInfos.forEach((r, i) => {
		records.push({
			id: `build_info:${i}`,
			section: "build_info",
			idx: i,
			effect_id: null,
			effect_ref_id: null,
			type: null,
			threshold: null,
			value: null,
			multiplier: null,
			build_type: r.buildType,
			build_level: r.buildLevel,
			data: r,
			updated_at: now,
		});
	});

	const BATCH_SIZE = 200;
	let pushed = 0;
	for (let i = 0; i < records.length; i += BATCH_SIZE) {
		const batch = records.slice(i, i + BATCH_SIZE);
		const { error } = await db.upsert("inagle_team_build", batch, "id");
		if (error) console.error("❌ Error batch team_build:", error.message || error);
		else pushed += batch.length;
	}
	console.log(`✅ Team Build imported (${pushed}/${records.length}).`);
}

// === boost_groups → inagle_boost_groups (ON CONFLICT id = "boost_grp_<index>") ===

export async function importBoostGroups(_service: any, db: DataAdapter) {
	console.log("🔄 Importing Boost Groups...");
	const boostDb = await buildBoostPlayerGroupDatabase(DATA_PATH);

	if (boostDb.configs.length === 0) {
		console.error(
			`❌ Aucun groupe de config trouvé dans le dump (${DATA_PATH}). ` +
				"Source réelle absente ou vide — rien à pousser (aucune donnée fabriquée)."
		);
		return;
	}

	// Spirit table partagée (référence stable embarquée dans chaque ligne pour
	// traçabilité : index -> spiritId hash hex).
	const spiritById = boostDb.spiritTable;
	const idToSpirit = new Map(spiritById.map((s) => [s.index, s.spiritId]));

	const now = new Date().toISOString();
	const records = boostDb.configs.map((cfg, configIndex) => {
		const resolvedSpiritIds = cfg.spiritIndices.map((i) => idToSpirit.get(i) ?? null);
		return {
			id: `boost_grp_${configIndex}`,
			config_index: configIndex,
			duration: cfg.duration,
			spirit_indices: cfg.spiritIndices,
			resolved_spirit_ids: resolvedSpiritIds,
			data: {
				configIndex,
				duration: cfg.duration,
				spiritIndices: cfg.spiritIndices,
				resolvedSpiritIds,
				spiritTable: spiritById,
			},
			updated_at: now,
		};
	});

	const deduped = dedup(records, "id");
	const { error } = await db.upsert("inagle_boost_groups", deduped, "id");
	if (error) console.error("❌ Error boost_groups:", error.message || error);
	else
		console.log(
			`✅ Boost Groups imported (${deduped.length} — spiritTable: ${spiritById.length} entrées).`
		);
}

// === constellations → inagle_constellations (ON CONFLICT id = starNameHash hex) ===

export async function importConstellations(_service: any, db: DataAdapter) {
	console.log("🔄 Importing Constellations...");
	const constellations = getAllConstellations();
	const records = constellations.map((c) => ({
		id: c.hashId, // PK stable (starNameHash hex)
		idx: c.index,
		name_fr: c.names.fr ?? null,
		name_en: c.names.en ?? null,
		name_ja: c.names.ja ?? null,
		character_count: c.characterCount,
		character_ids: c.characterIds,
		texture_star: c.textures.star ?? null,
		texture_star_after: c.textures.starAfter ?? null,
		texture_rare_star: c.textures.rareStar ?? null,
		texture_layer: c.textures.layer ?? null,
		data: c, // objet Constellation complet
		updated_at: new Date().toISOString(),
	}));

	const deduped = dedup(records, "id");
	if (deduped.length === 0) {
		console.error(
			"❌ Aucune constellation produite par le parseur " +
				"(source players_universe_config introuvable ou vide). Rien à pousser — table non peuplée à vide."
		);
		return;
	}

	const CHUNK = 500;
	let pushed = 0;
	for (let i = 0; i < deduped.length; i += CHUNK) {
		const chunk = deduped.slice(i, i + CHUNK);
		const { error } = await db.upsert("inagle_constellations", chunk, "id");
		if (error) console.error("❌ Error batch constellations:", error.message || error);
		else pushed += chunk.length;
	}
	console.log(`✅ Constellations imported (${pushed}/${deduped.length}).`);
}

// === star_signs → inagle_star_signs (ON CONFLICT chara_param_id) ===

export async function importStarSigns(_service: any, db: DataAdapter) {
	console.log("🔄 Importing Star Signs...");
	const map = buildStarSignMap();
	const entries = [...map.values()];

	if (entries.length === 0) {
		console.error(
			"❌ Aucune entrée star-sign trouvée (source réelle absente). Abandon — pas de table fabriquée."
		);
		return;
	}

	const now = new Date().toISOString();
	const toRow = (e: StarSignCharaInfo) => ({
		chara_param_id: e.charaParamId,
		chara_rarity: e.charaRarity,
		rate_default: e.charaRateDefault,
		rate_boost_a: e.charaRateBoostA,
		rate_boost_b: e.charaRateBoostB,
		rate_boost_c: e.charaRateBoostC,
		rate_boost_d: e.charaRateBoostD,
		is_remarkable: e.isRemarkable,
		enable_cond: e.enableCond ?? "",
		// jsonb data complet = objet réel produit par le parseur (source de vérité)
		data: e,
		updated_at: now,
	});

	const rows = dedup(entries.map(toRow), "chara_param_id");

	const BATCH = 500;
	let pushed = 0;
	for (let i = 0; i < rows.length; i += BATCH) {
		const chunk = rows.slice(i, i + BATCH);
		const { error } = await db.upsert("inagle_star_signs", chunk, "chara_param_id");
		if (error) console.error("❌ Error batch star_signs:", error.message || error);
		else pushed += chunk.length;
	}
	console.log(`✅ Star Signs imported (${pushed}/${rows.length}).`);
}

// === trophies → inagle_trophies (ON CONFLICT trophy_id) ===

export async function importTrophies(_service: any, db: DataAdapter) {
	console.log("🔄 Importing Trophies...");
	const { trophies } = buildTrophyDatabase(DATA_PATH);

	if (trophies.length === 0) {
		console.error(
			`❌ Aucune donnée trophée parsée depuis ${DATA_PATH} — rien à pousser (pas de fabrication).`
		);
		return;
	}

	const now = new Date().toISOString();
	const toRow = (t: ParsedTrophy) => ({
		trophy_id: t.trophyId,
		code: t.code,
		name_en: t.names.en ?? null,
		name_fr: t.names.fr ?? null,
		name_ja: t.names.ja ?? null,
		desc_en: t.descriptions.en ?? null,
		desc_fr: t.descriptions.fr ?? null,
		desc_ja: t.descriptions.ja ?? null,
		data: t,
		updated_at: now,
	});

	const rows = dedup(trophies.map(toRow), "trophy_id");

	const BATCH = 200;
	let pushed = 0;
	for (let i = 0; i < rows.length; i += BATCH) {
		const chunk = rows.slice(i, i + BATCH);
		const { error } = await db.upsert("inagle_trophies", chunk, "trophy_id");
		if (error) console.error("❌ Error batch trophies:", error.message || error);
		else pushed += chunk.length;
	}
	console.log(`✅ Trophies imported (${pushed}/${rows.length}).`);
}

// === missions → inagle_missions (ON CONFLICT mission_id) ===

export async function importMissions(_service: any, db: DataAdapter) {
	console.log("🔄 Importing Missions...");
	const { missions } = buildMissionDatabase(DATA_PATH);

	if (missions.length === 0) {
		console.error(
			`❌ 0 mission parsée depuis ${DATA_PATH} — mission_config introuvable ou vide. Rien poussé.`
		);
		return;
	}

	const now = new Date().toISOString();
	const records = missions.map((m) => ({
		mission_id: m.missionId,
		code: m.code,
		name_id: m.nameId,
		name_en: m.names.en ?? null,
		name_fr: m.names.fr ?? null,
		name_ja: m.names.ja ?? null,
		data: m,
		updated_at: now,
	}));

	const BATCH_SIZE = 200;
	let pushed = 0;
	for (let i = 0; i < records.length; i += BATCH_SIZE) {
		const batch = records.slice(i, i + BATCH_SIZE);
		const { error } = await db.upsert("inagle_missions", batch, "mission_id");
		if (error) console.error("❌ Error batch missions:", error.message || error);
		else pushed += batch.length;
	}
	console.log(`✅ Missions imported (${pushed}/${records.length}).`);
}
