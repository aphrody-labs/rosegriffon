import * as path from "node:path";
import { createClient } from "@supabase/supabase-js";
import type { Command } from "commander";
import * as dotenv from "dotenv";
import jwt from "jsonwebtoken";
import pg from "pg";
import {
	CATEGORY_NAMES,
	RARITY_NAMES as CHAR_RARITY_NAMES,
	createInagleService,
	ELEMENT_NAMES,
	PASSIVE_BOOST_NAMES,
	PASSIVE_SCOPE_NAMES,
	PositionNames,
} from "./index.js";
import { buildAuraHashSet } from "./skills/mapper-aura.js";

// === Helpers ===

const getLoc = (obj: any, lang: string) => {
	const l = lang.toLowerCase();
	const U = lang.toUpperCase();
	if (obj.names?.[l]) return obj.names[l];
	if (obj[`name_${U}`]) return obj[`name_${U}`];
	return obj.name || obj.displayName || null;
};

const getDesc = (obj: any, lang: string) => {
	const l = lang.toLowerCase();
	const U = lang.toUpperCase();
	if (obj.descriptions?.[l]) return obj.descriptions[l];
	if (obj[`desc_${U}`]) return obj[`desc_${U}`];
	return obj.description || obj.desc || null;
};

const getPositionFr = (posRaw: number) => {
	return (PositionNames as any)[posRaw]?.fr || "Inconnu";
};

function dedup(records: any[], key = "id") {
	const map = new Map();
	for (const r of records) {
		const k = r[key] || r.id;
		if (k) map.set(k, r);
	}
	return Array.from(map.values());
}

// === Adapters ===

interface DataAdapter {
	upsert(table: string, records: any[], onConflict?: string): Promise<{ error: any }>;
	insert(table: string, records: any[]): Promise<{ error: any }>;
	deleteAllExcept(table: string, column: string, value: any): Promise<{ error: any }>;
	// Lit toutes les lignes (colonnes choisies) — sert à préserver les colonnes
	// curatées hors-pipeline (sheet_data, zukan_order) à travers un delete+reinsert.
	fetchAll(table: string, columns: string): Promise<any[]>;
	close(): Promise<void>;
}

class SupabaseAdapter implements DataAdapter {
	constructor(private client: any) {}
	async upsert(table: string, records: any[], onConflict = "id") {
		if (records.length === 0) return { error: null };
		return this.client.from(table).upsert(records, { onConflict });
	}
	async insert(table: string, records: any[]) {
		if (records.length === 0) return { error: null };
		return this.client.from(table).insert(records);
	}
	async deleteAllExcept(table: string, column: string, value: any) {
		return this.client.from(table).delete().neq(column, value);
	}
	async fetchAll(table: string, columns: string) {
		const out: any[] = [];
		for (let from = 0; ; from += 1000) {
			const { data, error } = await this.client
				.from(table)
				.select(columns)
				.range(from, from + 999);
			if (error || !data || data.length === 0) break;
			out.push(...data);
			if (data.length < 1000) break;
		}
		return out;
	}
	async close() {}
}

class PostgresAdapter implements DataAdapter {
	private pool: pg.Pool;
	constructor(connectionString: string) {
		this.pool = new pg.Pool({ connectionString });
	}

	async upsert(table: string, records: any[], onConflict = "id") {
		if (records.length === 0) return { error: null };

		// Chunking for Postgres max params (65535)
		// Let's safe limit to 100 rows per insert if many columns
		const CHUNK_SIZE = 50;
		for (let i = 0; i < records.length; i += CHUNK_SIZE) {
			const chunk = records.slice(i, i + CHUNK_SIZE);
			const err = await this._upsertBatch(table, chunk, onConflict);
			if (err) return { error: err };
		}
		return { error: null };
	}

	private async _upsertBatch(table: string, records: any[], onConflict: string) {
		const keys = Object.keys(records[0]);
		let paramIndex = 1;
		const values: any[] = [];
		const rows: string[] = [];

		for (const r of records) {
			const rowParams: string[] = [];
			for (const k of keys) {
				rowParams.push(`$${paramIndex++}`);
				let val = r[k];
				if (typeof val === "object" && val !== null) val = JSON.stringify(val);
				values.push(val);
			}
			rows.push(`(${rowParams.join(", ")})`);
		}

		const updateSet = keys.map((k) => `"${k}" = EXCLUDED."${k}"`).join(", ");

		const conflictCols = onConflict
			.split(",")
			.map((c) => `"${c.trim()}"`)
			.join(", ");
		const query = `
            INSERT INTO "${table}" (${keys.map((k) => `"${k}"`).join(", ")})
            VALUES ${rows.join(", ")}
            ON CONFLICT (${conflictCols}) DO UPDATE SET ${updateSet}
        `;

		try {
			await this.pool.query(query, values);
			return null;
		} catch (e: any) {
			console.error(`[PostgresAdapter] Error in upsert: ${e.message}`, e);
			return e;
		}
	}

	async insert(table: string, records: any[]) {
		// Simple insert without conflict handling (or could fail)
		// For treasures, we deleted before, so simple insert is fine.
		return this.upsert(table, records, "id"); // treasures has id
	}

	async deleteAllExcept(table: string, column: string, value: any) {
		try {
			await this.pool.query(`DELETE FROM "${table}" WHERE "${column}" != $1`, [value]);
			return { error: null };
		} catch (e: any) {
			return { error: e };
		}
	}

	async fetchAll(table: string, columns: string) {
		try {
			const cols = columns
				.split(",")
				.map((c) => `"${c.trim()}"`)
				.join(", ");
			const res = await this.pool.query(`SELECT ${cols} FROM "${table}"`);
			return res.rows;
		} catch {
			return [];
		}
	}

	async close() {
		await this.pool.end();
	}
}

// === Command ===

export function registerPushCommand(program: Command) {
	program
		.command("push")
		.description("Push Inagle data to Supabase (via API or Direct DB)")
		.option("--env <path>", "Path to .env file", ".env")
		.option("--url <url>", "Supabase URL (for API mode)")
		.option("--jwt-secret <secret>", "Supabase JWT Secret (to generate service token)")
		.option("--key <key>", "Direct Service Role Key")
		.option("--db-url <url>", "Postgres Connection URL (Direct DB mode)")
		.action(async (options) => {
			if (options.env) {
				dotenv.config({ path: path.resolve(process.cwd(), options.env) });
			}

			let adapter: DataAdapter;

			if (options.dbUrl) {
				console.log(`[Push] Using Direct DB connection: ${options.dbUrl}`);
				adapter = new PostgresAdapter(options.dbUrl);
			} else {
				let SUPABASE_URL =
					options.url || process.env.SUPABASE_URL || "https://isbkaeltubqittywibeh.supabase.co";
				let SUPABASE_KEY = options.key || process.env.SUPABASE_SERVICE_ROLE_KEY;
				const JWT_SECRET =
					options.jwtSecret || process.env.JWT_SECRET || process.env.SUPABASE_JWT_SECRET;

				const isValidKey = (val: string | undefined | null) =>
					typeof val === "string" &&
					val.length > 0 &&
					!val.startsWith("eyJ2Ijo") &&
					val !== "undefined" &&
					val !== "null";

				const isValidUrl = (val: string | undefined | null) =>
					typeof val === "string" &&
					val.length > 0 &&
					val.startsWith("http") &&
					!val.startsWith("eyJ2Ijo");

				if (!isValidUrl(SUPABASE_URL)) {
					SUPABASE_URL = "https://isbkaeltubqittywibeh.supabase.co";
				}

				if (!isValidKey(SUPABASE_KEY)) {
					if (isValidKey(JWT_SECRET)) {
						console.log("[Push] Generating Service Role Token from Secret...");
						const payload = {
							role: "service_role",
							iss: "supabase",
							iat: Math.floor(Date.now() / 1000),
							exp: Math.floor(Date.now() / 1000) + 3600,
						};
						SUPABASE_KEY = jwt.sign(payload, JWT_SECRET!);
					} else {
						console.log("[Push] Using local dev Supabase fallback service role key");
						SUPABASE_KEY =
							"***REDACTED-SERVICE-ROLE***";
					}
				}

				console.log(`[Push] Connecting to Supabase API at: ${SUPABASE_URL}`);
				const supabase = createClient(SUPABASE_URL, SUPABASE_KEY!, {
					auth: { persistSession: false },
				});
				adapter = new SupabaseAdapter(supabase);
			}

			try {
				console.log("🚀 Starting Inagle Data Push...");
				const service = await createInagleService();

				await importCharacters(service, adapter);
				await importSkills(service, adapter);
				await importItems(service, adapter);
				await importPassives(service, adapter);
				await importAuras(service, adapter);
				await importTeams(service, adapter);
				await importFormations(service, adapter);
				await importQuests(service, adapter);
				await importDrops(service, adapter);

				// New parser imports
				await importGallery(service, adapter);
				await importCostumes(service, adapter);
				await importOpponentTeams(service, adapter);
				await importCapsules(service, adapter);

				// Static reference tables
				await importExpTable(adapter);
				await importGrowthTables(adapter);

				// Story text static export
				await exportStoryTextDatabase();

				console.log("🎉 Data push completed successfully!");
			} catch (error) {
				console.error("Fatal error during push:", error);
			} finally {
				await adapter.close();
			}
		});
}

// === Importers (Generic) ===

function slugify(name: string): string {
	return name
		.toLowerCase()
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/[^a-z0-9\s-]/g, "")
		.trim()
		.replace(/\s+/g, "-");
}

async function importCharacters(service: any, db: DataAdapter) {
	console.log("🔄 Importing Characters...");

	// Clean existing characters in database first to remove leftover duplicates/mismatch entries
	// Préserve les colonnes CURATÉES hors-pipeline (alimentées par d'autres
	// process : sheet_data = données communautaires, zukan_order = ordre officiel
	// zukan.inazuma.jp). Le delete+reinsert les écraserait sinon. On les snapshot
	// puis on les réinjecte par id dans les records.
	console.log("  Préservation de sheet_data / zukan_order avant nettoyage...");
	const preserved = new Map<string, { sheet_data: any; zukan_order: any }>();
	for (const r of await db.fetchAll("inagle_characters", "id, sheet_data, zukan_order")) {
		preserved.set(r.id, { sheet_data: r.sheet_data ?? null, zukan_order: r.zukan_order ?? null });
	}
	console.log(`  ${preserved.size} lignes curatées snapshotées.`);

	console.log("  Cleaning existing characters in database...");
	await db.deleteAllExcept("inagle_characters", "id", "DUMMY_NONE");

	let chars = service.characters.all();
	chars = chars.filter((c: any) => c.charaParamId && c.charaParamId !== "null");

	// Group by character name to find the primary (youngest) version and set slugs
	const charsByName = new Map<string, any[]>();
	for (const c of chars) {
		const nameEn = getLoc(c, "en") || c.name || "";
		const key = nameEn.toLowerCase().trim() || c.charaId;
		if (!charsByName.has(key)) {
			charsByName.set(key, []);
		}
		charsByName.get(key)!.push(c);
	}

	// Align images/codes and assign is_primary and slugs
	const processedChars: any[] = [];
	for (const [key, variants] of charsByName.entries()) {
		// Sort variants: normal first, prefer zukanHash, then sorted by charaParamId ASC
		variants.sort((a: any, b: any) => {
			const aHero = a.rarity === "Héros" || a.rarityCode === 10 ? 1 : 0;
			const bHero = b.rarity === "Héros" || b.rarityCode === 10 ? 1 : 0;
			if (aHero !== bHero) return aHero - bHero;

			const aBasara = a.rarity === "BASARA" || a.rarityCode >= 20 ? 1 : 0;
			const bBasara = b.rarity === "BASARA" || b.rarityCode >= 20 ? 1 : 0;
			if (aBasara !== bBasara) return aBasara - bBasara;

			const aHash = a.zukanHash ? 1 : 0;
			const bHash = b.zukanHash ? 1 : 0;
			if (aHash !== bHash) return bHash - aHash;

			return String(a.internalCode || "").localeCompare(String(b.internalCode || ""));
		});

		const primary = variants[0];
		const nameEn = getLoc(primary, "en") || primary.name || "unknown";
		const baseSlug = slugify(nameEn);

		for (let idx = 0; idx < variants.length; idx++) {
			const v = variants[idx];
			v.is_primary = idx === 0;
			v.base_slug = baseSlug;
			v.slug = `${baseSlug}-${v.charaParamId}`;

			// Mismatch correction: Hero and Basara variants get the same image, zukanHash, and zukanOrder as the normal version
			const isH = v.rarity === "Héros" || v.rarityCode === 10;
			const isB = v.rarity === "BASARA" || v.rarityCode >= 20;
			if ((isH || isB) && primary) {
				v.internalCode = primary.internalCode;
				v.zukanHash = primary.zukanHash;
				if (primary.zukanOrder) {
					v.zukanOrder = primary.zukanOrder;
				}
			}
			processedChars.push(v);
		}
	}

	// Build aura hash set to separate auras from skills in chara_param slots
	const auraHashes = buildAuraHashSet();
	console.log(`  Loaded ${auraHashes.size} aura hashes for skill/aura separation`);

	// Postgres safe batch size
	const BATCH_SIZE = 100;
	let successCount = 0;

	for (let i = 0; i < processedChars.length; i += BATCH_SIZE) {
		const batch = processedChars.slice(i, i + BATCH_SIZE);
		let records = batch.map((c: any) => {
			const stats = c.stats?.lv99 || {};

			// Separate skills from auras — chara_param mixes both in the same slots
			const rawSkills: { learnLevel: number; skillId: string }[] = c.skills || [];
			const skills = rawSkills.filter(
				(s) => s.skillId !== "0x00000002" && !auraHashes.has(s.skillId)
			);
			const auras = rawSkills.filter((s) => auraHashes.has(s.skillId));

			return {
				id: c.charaParamId,
				chara_id: c.charaId,
				name_fr: getLoc(c, "fr"),
				name_en: getLoc(c, "en"),
				name_ja: getLoc(c, "ja"),
				description_fr: getDesc(c, "fr"),
				description_en: getDesc(c, "en"),
				description_ja: getDesc(c, "ja"),
				rarity: c.rarityCode || 0,
				rarity_label: c.rarity || CHAR_RARITY_NAMES[c.rarityCode] || null,
				position: getPositionFr(c.positionRaw),
				element: ELEMENT_NAMES[c.elementRaw]?.fr || null,
				gender: c.gender === 1 ? "F" : "M",
				series: c.series || null,
				team_id: c.teamId || c.teams?.[0]?.id || null,
				stat_frappe: stats.kick || 0,
				stat_physique: stats.physical || 0,
				stat_controle: stats.control || 0,
				stat_pression: stats.pressure || 0,
				stat_agilite: stats.agility || 0,
				stat_technique: stats.technique || 0,
				stat_intelligence: stats.intelligence || 0,
				zukan_hash: c.zukanHash || null,
				// zukan_order : conserve l'ordre officiel curaté s'il existe, sinon parser.
				zukan_order: preserved.get(c.charaParamId)?.zukan_order ?? c.zukanOrder ?? null,
				// sheet_data : 100% curaté hors-pipeline → restaure le snapshot (jamais le parser), mais intègre les nouveaux movesets.
				sheet_data: (() => {
					const jsonSd = c.sheetData || {};
					const dbSd = preserved.get(c.charaParamId)?.sheet_data || {};
					const merged = { ...jsonSd, ...dbSd };
					if (!merged.moveset && jsonSd.moveset) {
						merged.moveset = jsonSd.moveset;
					}
					if (!merged.altMoveset && jsonSd.altMoveset) {
						merged.altMoveset = jsonSd.altMoveset;
					}
					return Object.keys(merged).length > 0 ? merged : null;
				})(),
				internal_code: c.internalCode || null,
				constellation: c.constellation?.names?.fr || null,
				constellation_index: c.constellation?.index ?? null,
				is_controllable: c.isControllable || false,
				control_type: c.controlType ?? null,
				stat_lv1_frappe: c.stats?.lv1?.kick || null,
				stat_lv1_controle: c.stats?.lv1?.control || null,
				stat_lv1_technique: c.stats?.lv1?.technique || null,
				stat_lv1_physique: c.stats?.lv1?.physical || null,
				stat_lv1_pression: c.stats?.lv1?.pressure || null,
				stat_lv1_agilite: c.stats?.lv1?.agility || null,
				stat_lv1_intelligence: c.stats?.lv1?.intelligence || null,
				image_url: service.images.faceUrl(c.internalCode || c.charaId),
				skills,
				data: { ...c, skills, auras },
				updated_at: new Date().toISOString(),
				is_primary: c.is_primary ?? false,
				hero_type: (c.sheetData && c.sheetData.heroType) || null,
				slug: c.slug || null,
				base_slug: c.base_slug || null,
			};
		});

		records = dedup(records, "id");
		const { error } = await db.upsert("inagle_characters", records, "id");
		if (error) console.error("❌ Error batch char:", error.message || error);
		else successCount += records.length;
	}
	console.log(`✅ Characters imported (${successCount}/${processedChars.length}).`);
}

async function importSkills(service: any, db: DataAdapter) {
	console.log("🔄 Importing Skills...");

	// Clean existing skills in database first to remove leftover passive/stat boost and duplicate entries
	console.log("  Cleaning existing skills in database...");
	await db.deleteAllExcept("inagle_skills", "id", "DUMMY_NONE");

	let skills = service.skills.all();
	skills = skills.filter(
		(s: any) =>
			(s.internalCode || s.skillIDStr || s.skillID || s.id) &&
			s.category !== 6 &&
			s.category !== "Passive" &&
			s.category !== 9 &&
			s.category !== "Stat Boost" &&
			s.category !== "Boost Stats"
	);

	// Charger les vidéos depuis skill-videos.json (db_skills.json absent)
	const skillVideosPath = path.join(
		path.dirname(new URL(import.meta.url).pathname),
		"../data/zukan/skill-videos.json"
	);
	const zukanMap = new Map<string, { videoUrl: string; posterUrl?: string }>();
	if (Bun.file(skillVideosPath).size > 0) {
		const skillVideos: { name: string; videoUrl: string; posterUrl?: string }[] =
			await Bun.file(skillVideosPath).json();
		for (const sv of skillVideos) {
			if (sv.videoUrl) {
				// Convertir .wmv → .webm (CDN CloudFront héberge les deux)
				const videoUrl = sv.videoUrl.endsWith(".wmv")
					? sv.videoUrl.replace(".wmv", ".webm")
					: sv.videoUrl;
				zukanMap.set(sv.name.toLowerCase(), { ...sv, videoUrl });
			}
		}
	}

	// Map to database records
	let records = skills.map((s: any) => {
		const id = s.internalCode || s.skillIDStr || s.skillID || s.id;
		const nameEn = getLoc(s, "en")?.toLowerCase();
		const nameJa = getLoc(s, "ja");
		const zukanEntry =
			(nameEn ? zukanMap.get(nameEn) : undefined) ||
			(nameJa ? zukanMap.get(nameJa.toLowerCase()) : undefined) ||
			null;
		const videoUrl = zukanEntry?.videoUrl || null;
		const posterUrl = zukanEntry?.posterUrl || null;

		return {
			id: String(id),
			name_fr: getLoc(s, "fr"),
			name_en: getLoc(s, "en"),
			name_ja: getLoc(s, "ja"),
			description_fr: getDesc(s, "fr"),
			description_en: getDesc(s, "en"),
			description_ja: getDesc(s, "ja"),
			element: ELEMENT_NAMES[s.element]?.fr || null,
			category: CATEGORY_NAMES[s.category]?.fr || null,
			tp_cost: s.consumeTp || s.tensionCost || 0,
			power_min: s.power_min || s.powerMin || 0,
			power_max: s.power_max || s.powerMax || 0,
			foul_rate: s.foulRate || 0,
			growth_type: s.growthType,
			internal_code: s.internalCode || null,
			hash_id: s.hashId || null,
			video_url: videoUrl,
			poster_url: posterUrl,
			recast_time: s.recastTime || 0,
			is_eldorado: s.eldorado || false,
			partner_count: s.partnerCount || 0,
			evolution_type: s.growthSpeed || null,
			skill_effect_bit_flag: s.skillEffectBitFlag || 0,
			tags: s.tags
				? `{${s.tags.map((t: string) => `"${t.replace(/"/g, '\\"')}"`).join(",")}}`
				: "{}",
			image_url: service.images.skillUrl(id),
			data: s,
			updated_at: new Date().toISOString(),
		};
	});

	// Deduplicate the entire set of records before chunking
	records = dedup(records);

	const BATCH_SIZE = 100;
	let successCount = 0;

	for (let i = 0; i < records.length; i += BATCH_SIZE) {
		const batch = records.slice(i, i + BATCH_SIZE);
		const { error } = await db.upsert("inagle_skills", batch);
		if (error) console.error("❌ Error batch skills:", error.message || error);
		else successCount += batch.length;
	}
	console.log(`✅ Skills imported (${successCount}/${records.length}).`);
}

async function importItems(service: any, db: DataAdapter) {
	console.log("🔄 Importing Items...");

	// Préserve le sheet_data curaté/riche (shops, price, attributes) AVANT le delete+reinsert,
	// sinon chaque push wipe la donnée enrichie des items (régression connue).
	const preserved = new Map<string, any>();
	for (const r of await db.fetchAll("inagle_items", "id, sheet_data")) {
		if (r.sheet_data) preserved.set(String(r.id), r.sheet_data);
	}
	console.log(`  ${preserved.size} sheet_data items préservés.`);

	// Clean existing items first to remove leftover fake/null entries from previous syncs
	console.log("  Cleaning existing items in database...");
	await db.deleteAllExcept("inagle_items", "id", "0x00000000");

	let items = service.items.allItems();
	items = items.filter((item: any) => {
		const id = item.itemId || item.id;
		if (!id || id === "0x00000000" || id === "0x00000002" || id === "null") return false;

		const name = item.name || "";
		if (
			name.includes("_0x") ||
			name.startsWith("consume_") ||
			name.startsWith("shoes_") ||
			name.startsWith("misanga_") ||
			name.startsWith("accessory_") ||
			name.startsWith("special_") ||
			name.startsWith("fashion_") ||
			name.startsWith("badge_") ||
			name.startsWith("coin_") ||
			name.startsWith("gacha_ticket_")
		) {
			return false;
		}

		// Must have at least one name in FR or EN
		const hasName = getLoc(item, "fr") || getLoc(item, "en");
		if (!hasName) return false;

		return true;
	});

	// Deduplicate items by category + normalized name (preferring records with internalCode / descriptions)
	const uniqueMap = new Map<string, any>();
	for (const item of items) {
		const name = (getLoc(item, "fr") || getLoc(item, "en") || "").toLowerCase().trim();
		const key = `${item.category}_${name}`;
		const existing = uniqueMap.get(key);
		if (!existing) {
			uniqueMap.set(key, item);
		} else {
			const existingHasCode = !!existing.internalCode;
			const itemHasCode = !!item.internalCode;
			const existingHasDesc = !!getDesc(existing, "fr");
			const itemHasDesc = !!getDesc(item, "fr");

			if (
				(!existingHasCode && itemHasCode) ||
				(existingHasCode === itemHasCode && !existingHasDesc && itemHasDesc)
			) {
				uniqueMap.set(key, item);
			}
		}
	}
	items = Array.from(uniqueMap.values());

	const BATCH_SIZE = 100;
	let successCount = 0;

	for (let i = 0; i < items.length; i += BATCH_SIZE) {
		const batch = items.slice(i, i + BATCH_SIZE);
		let records = batch.map((item: any) => {
			const id = item.itemId || item.id;
			return {
				id: String(id),
				name_fr: getLoc(item, "fr"),
				name_en: getLoc(item, "en"),
				name_ja: getLoc(item, "ja"),
				description_fr: getDesc(item, "fr"),
				description_en: getDesc(item, "en"),
				description_ja: getDesc(item, "ja"),
				category: item.category,
				rarity: item.rarity || 0,
				price: item.price || 0,
				sell_price: item.sellPrice || 0,
				internal_code: item.internalCode || null,
				stat_boost_1: item.stats?.stat1 || null,
				stat_boost_2: item.stats?.stat2 || null,
				image_url: item.imageUrl || null,
				data: item,
				// Restaure le sheet_data riche préservé (shops/price/attributes) ou, à défaut,
				// retombe sur l'objet parsé courant — la page lit sheet_data en priorité.
				sheet_data: preserved.get(String(id)) ?? item ?? null,
				updated_at: new Date().toISOString(),
			};
		});

		records = dedup(records);
		const { error } = await db.upsert("inagle_items", records);
		if (error) console.error("❌ Error batch item:", error.message || error);
		else successCount += records.length;
	}
	console.log(`✅ Items imported (${successCount}/${items.length}).`);
}

async function importPassives(service: any, db: DataAdapter) {
	console.log("🔄 Importing Passives...");
	const passives = service.skills.passiveAll();
	const BATCH_SIZE = 100;
	let successCount = 0;

	for (let i = 0; i < passives.length; i += BATCH_SIZE) {
		const batch = passives.slice(i, i + BATCH_SIZE);
		let records = batch.map((p: any) => ({
			id: p.passiveIdStr || p.passiveId,
			name_fr: getLoc(p, "fr"),
			name_en: getLoc(p, "en"),
			name_ja: getLoc(p, "ja"),
			description_fr: getDesc(p, "fr"),
			description_en: getDesc(p, "en"),
			description_ja: getDesc(p, "ja"),
			category: (PASSIVE_SCOPE_NAMES as any)[p.scope]?.fr || p.scope || "Inconnu",
			boost_type: (PASSIVE_BOOST_NAMES as any)[p.boostType]?.fr || p.boostType || "Inconnu",
			effect_value: p.effectValue || 0,
			data: p,
			updated_at: new Date().toISOString(),
		}));

		records = dedup(records);
		const { error } = await db.upsert("inagle_passives", records);
		if (error) console.error("❌ Error batch passive:", error.message || error);
		else successCount += records.length;
	}
	console.log(`✅ Passives imported (${successCount}/${passives.length}).`);
}

async function importAuras(service: any, db: DataAdapter) {
	console.log("🔄 Importing Auras...");
	const auras = service.skills.auraAll();
	const keshins: any[] = [];
	const souls: any[] = [];
	const awakenings: any[] = [];
	const modeChanges: any[] = [];
	const miximax: any[] = [];
	const aurasList: any[] = [];

	for (const a of auras) {
		const name = getLoc(a, "fr");
		const isInvalid = !name || name.includes("(was") || name.startsWith("Aura ");
		if (isInvalid) continue;

		const baseRecord = {
			id: a.auraIdStr || a.auraId,
			name_fr: name,
			name_en: getLoc(a, "en"),
			name_ja: getLoc(a, "ja"),
			description_fr: getDesc(a, "fr"),
			description_en: getDesc(a, "en"),
			description_ja: getDesc(a, "ja"),
			element_id: a.element ?? null,
			asset_code: a.assetCode || null,
			image_url: a.image || null,
			// Injecte TOUJOURS le lien aura→technique (config.skillId1/skillId2) dans
			// sheet_data — c'est ce que getAura consomme côté azalee. (Le `data` complet
			// porte aussi a.config, mais on garantit la présence dans sheet_data.)
			sheet_data: a.config
				? { ...((a.sheetData as any) ?? {}), config: a.config }
				: (a.sheetData ?? null),
			updated_at: new Date().toISOString(),
		};

		const subType = a.subType || "Aura";
		if (subType === "Keshin") keshins.push({ ...baseRecord, type: "Esprit Guerrier", data: a });
		else if (subType === "Soul") souls.push({ ...baseRecord, type: "Totem", data: a });
		else if (subType === "Awakening") awakenings.push({ ...baseRecord, type: "Éveil", data: a });
		else if (subType === "ModeChange") modeChanges.push({ ...baseRecord, type: "Changement de mode", data: a });
		else if (subType === "Aura") {
			if (name.includes("Miximax")) miximax.push({ ...baseRecord, type: "Miximax", data: a });
			else {
				aurasList.push({ ...baseRecord, sub_type: "Aura" });
			}
		} else miximax.push({ ...baseRecord, type: "Miximax", data: a });
	}

	if (keshins.length > 0) await db.upsert("inagle_keshins", dedup(keshins));
	if (souls.length > 0) await db.upsert("inagle_souls", dedup(souls));
	if (awakenings.length > 0) await db.upsert("inagle_awakenings", dedup(awakenings));
	if (modeChanges.length > 0) await db.upsert("inagle_mode_changes", dedup(modeChanges));
	if (miximax.length > 0) await db.upsert("inagle_miximax", dedup(miximax));
	if (aurasList.length > 0) await db.upsert("inagle_auras", dedup(aurasList));
	console.log(`✅ Auras imported (${auras.length}) — ${aurasList.length} dans inagle_auras.`);
}

async function importTeams(service: any, db: DataAdapter) {
	console.log("🔄 Importing Teams...");
	const teams = service.teams.allTeams();
	const BATCH_SIZE = 50;
	let successCount = 0;

	for (let i = 0; i < teams.length; i += BATCH_SIZE) {
		const batch = teams.slice(i, i + BATCH_SIZE);
		let records = batch.map((t: any) => ({
			id: t.teamId || t.id,
			name_fr: getLoc(t, "fr"),
			name_en: getLoc(t, "en"),
			name_ja: getLoc(t, "ja"),
			description_fr: getDesc(t, "fr"),
			description_en: getDesc(t, "en"),
			description_ja: getDesc(t, "ja"),
			country_code: t.countryCode || null,
			series: t.series?.name || t.series || null,
			emblem_url: service.images.emblemUrl(t.teamId || t.id),
			data: t,
			updated_at: new Date().toISOString(),
		}));
		records = dedup(records);
		const { error } = await db.upsert("inagle_teams", records);
		if (error) console.error("❌ Error batch teams:", error.message || error);
		else successCount += records.length;
	}
	console.log(`✅ Teams imported (${successCount}/${teams.length}).`);
}

async function importFormations(service: any, db: DataAdapter) {
	console.log("🔄 Importing Formations...");
	const formations = service.teams.allFormations();
	const BATCH_SIZE = 50;
	let successCount = 0;

	for (let i = 0; i < formations.length; i += BATCH_SIZE) {
		const batch = formations.slice(i, i + BATCH_SIZE);
		let records = batch.map((f: any) => ({
			id: f.formationId || f.formId || f.id,
			name_fr: getLoc(f, "fr"),
			name_en: getLoc(f, "en"),
			name_ja: getLoc(f, "ja"),
			description_fr: getDesc(f, "fr"),
			description_en: getDesc(f, "en"),
			description_ja: getDesc(f, "ja"),
			category: f.balance,
			power_offense: f.powerOffense || 0,
			power_defense: f.powerDefense || 0,
			data: f,
			updated_at: new Date().toISOString(),
		}));
		records = dedup(records);
		const { error } = await db.upsert("inagle_formations", records);
		if (error) {
			console.error("❌ Error batch formations:", error);
		} else {
			successCount += records.length;
		}
		await new Promise((resolve) => setTimeout(resolve, 100));
	}
	console.log(`✅ Formations imported (${successCount}/${formations.length}).`);
}

async function importQuests(service: any, db: DataAdapter) {
	console.log("🔄 Importing Quests...");
	const quests = service.quests.all();
	const BATCH_SIZE = 50;
	let successCount = 0;

	for (let i = 0; i < quests.length; i += BATCH_SIZE) {
		const batch = quests.slice(i, i + BATCH_SIZE);
		let records = batch.map((q: any) => ({
			id: q.id,
			display_text: q.displayText,
			phase: q.phase,
			data: q,
			updated_at: new Date().toISOString(),
		}));
		records = dedup(records);
		const { error } = await db.upsert("inagle_quests", records);
		if (error) console.error("❌ Error batch quests:", error.message || error);
		else successCount += records.length;
	}
	console.log(`✅ Quests imported (${successCount}/${quests.length}).`);
}

async function importDrops(service: any, db: DataAdapter) {
	console.log("🔄 Importing Drops...");

	const tables = service.drops.getAllTables();
	const tableEntries = Array.from(tables.entries());
	const BATCH_SIZE = 50;

	for (let i = 0; i < tableEntries.length; i += BATCH_SIZE) {
		const batch = tableEntries.slice(i, i + BATCH_SIZE);
		const records = batch.map((entry: any) => {
			const [id, entries] = entry;
			return {
				table_id: id,
				entries: entries,
				updated_at: new Date().toISOString(),
			};
		});
		await db.upsert("inagle_drops_tables", records, "table_id");
	}

	const battles = service.drops.getAllBattles();
	const battleEntries = Array.from(battles.entries());
	for (let i = 0; i < battleEntries.length; i += BATCH_SIZE) {
		const batch = battleEntries.slice(i, i + BATCH_SIZE);
		const records = batch.map((entry: any) => {
			const [id, info] = entry;
			return {
				battle_group_id: id,
				item_table_id: (info as any).itemTableId,
				data: info,
				updated_at: new Date().toISOString(),
			};
		});
		await db.upsert("inagle_drops_battles", records, "battle_group_id");
	}

	const treasures = service.drops.getAllTreasures();
	await db.deleteAllExcept("inagle_drops_treasures", "map_id", "xx");

	for (let i = 0; i < treasures.length; i += BATCH_SIZE) {
		const batch = treasures.slice(i, i + BATCH_SIZE);
		const records = batch.map((t: any) => ({
			map_id: t.mapId,
			pos: t.pos,
			items: t.items,
			data: t,
			updated_at: new Date().toISOString(),
		}));
		await db.insert("inagle_drops_treasures", records);
	}
	console.log("✅ Drops imported.");
}

// === New Parser Importers ===

async function importGallery(_service: any, db: DataAdapter) {
	console.log("🔄 Importing Gallery...");
	const { buildGalleryDatabase } = await import("./parsers/gallery-config.js");
	const gallery = await buildGalleryDatabase();

	const records = gallery.galleries.map((g: any) => ({
		id: g.galleryId,
		img_path: g.imgPath,
		thumb_path: g.thumbPath,
		need_token_num: g.needTokenNum,
		flg_no: g.flgNo,
		data: g,
		updated_at: new Date().toISOString(),
	}));

	if (records.length > 0) {
		const { error } = await db.upsert("inagle_gallery", dedup(records));
		if (error) console.error("❌ Error gallery:", error.message || error);
	}
	console.log(`✅ Gallery imported (${records.length}).`);
}

async function importCostumes(_service: any, db: DataAdapter) {
	console.log("🔄 Importing Costumes...");
	const { buildCharaCostumeDatabase } = await import("./parsers/chara-costume-config.js");
	const costumes = await buildCharaCostumeDatabase();

	const records = costumes.costumes.map((c: any) => ({
		id: `costume_${c.index}`,
		costume_index: c.index,
		type: c.type,
		model_ref: c.modelRef,
		flag1: c.flag1,
		flag2: c.flag2,
		data: c,
		updated_at: new Date().toISOString(),
	}));

	const BATCH_SIZE = 100;
	let successCount = 0;
	for (let i = 0; i < records.length; i += BATCH_SIZE) {
		const batch = records.slice(i, i + BATCH_SIZE);
		const { error } = await db.upsert("inagle_costumes", batch);
		if (error) console.error("❌ Error costumes:", error.message || error);
		else successCount += batch.length;
	}
	console.log(`✅ Costumes imported (${successCount}).`);
}

async function importOpponentTeams(_service: any, db: DataAdapter) {
	console.log("🔄 Importing Opponent Teams...");
	const { buildOpponentTeamDatabase } = await import("./parsers/opponent-team-config.js");
	const opponents = await buildOpponentTeamDatabase();

	const records = opponents.opponents.map((o: any) => ({
		id: o.opponentId,
		team_id: o.teamId,
		type: o.type,
		game_id: o.gameId,
		difficulty_type: o.difficultyType,
		bg_texture: o.bgTextureName,
		data: o,
		updated_at: new Date().toISOString(),
	}));

	if (records.length > 0) {
		const { error } = await db.upsert("inagle_opponent_teams", dedup(records));
		if (error) console.error("❌ Error opponent teams:", error.message || error);
	}
	console.log(`✅ Opponent Teams imported (${records.length}).`);
}

async function importExpTable(db: DataAdapter) {
	console.log("🔄 Importing Exp Table...");
	const dataPath = path.join(
		path.dirname(new URL(import.meta.url).pathname),
		"../data/all-gamedata/exp_table.json"
	);
	const rows: { level: number; need_exp: number }[] = await Bun.file(dataPath).json();
	const records = rows.map((r: any) => ({ level: r.level, need_exp: r.needExp ?? r.need_exp }));
	const { error } = await db.upsert("inagle_exp_table", records, "level");
	if (error) console.error("❌ Error exp_table:", error.message || error);
	else console.log(`✅ Exp Table imported (${records.length} levels).`);
}

async function importGrowthTables(db: DataAdapter) {
	console.log("🔄 Importing Growth Tables...");
	const dataPath = path.join(
		path.dirname(new URL(import.meta.url).pathname),
		"../data/all-gamedata/growth_tables.json"
	);
	const raw: Record<string, any[]> = await Bun.file(dataPath).json();

	const records: any[] = [];

	// lv1 : mainPosition, subPosition, playStyle
	for (const row of raw.lv1 ?? []) {
		records.push({
			section: "lv1",
			main_position: row.mainPosition ?? null,
			sub_position: row.subPosition ?? null,
			play_style: row.playStyle ?? null,
			growth_pattern: null,
			chara_rank: null,
			data: row,
		});
	}

	// lv30 : mainPosition, subPosition, growthPattern, charaRank
	for (const row of raw.lv30 ?? []) {
		records.push({
			section: "lv30",
			main_position: row.mainPosition ?? null,
			sub_position: row.subPosition ?? null,
			play_style: null,
			growth_pattern: row.growthPattern ?? null,
			chara_rank: row.charaRank ?? null,
			data: row,
		});
	}

	// main : mainPosition (pas de subPosition)
	for (const row of Object.values(raw.main ?? {})) {
		records.push({
			section: "main",
			main_position: row.mainPosition ?? null,
			sub_position: null,
			play_style: null,
			growth_pattern: row.growthPattern ?? null,
			chara_rank: row.charaRank ?? null,
			data: row,
		});
	}

	// sub : subPosition (pas de mainPosition)
	for (const row of Object.values(raw.sub ?? {})) {
		records.push({
			section: "sub",
			main_position: null,
			sub_position: row.subPosition ?? null,
			play_style: null,
			growth_pattern: row.growthPattern ?? null,
			chara_rank: row.charaRank ?? null,
			data: row,
		});
	}

	const { error } = await db.upsert(
		"inagle_growth_tables",
		records,
		"section,main_position,sub_position,play_style,growth_pattern,chara_rank"
	);
	if (error) console.error("❌ Error growth_tables:", error.message || error);
	else console.log(`✅ Growth Tables imported (${records.length} rows).`);
}

async function importCapsules(_service: any, db: DataAdapter) {
	console.log("🔄 Importing Capsules...");
	const { buildCapsuleDatabase } = await import("./parsers/capsule-config.js");
	const capsule = await buildCapsuleDatabase();

	const records = capsule.prizes.map((p: any) => ({
		id: p.id,
		prize_data: p.vars,
		data: p,
		updated_at: new Date().toISOString(),
	}));

	const BATCH_SIZE = 100;
	let successCount = 0;
	for (let i = 0; i < records.length; i += BATCH_SIZE) {
		const batch = records.slice(i, i + BATCH_SIZE);
		const { error } = await db.upsert("inagle_capsules", batch);
		if (error) console.error("❌ Error capsules:", error.message || error);
		else successCount += batch.length;
	}
	console.log(`✅ Capsules imported (${successCount}).`);
}

async function exportStoryTextDatabase() {
	console.log("🔄 Exporting Story Text Database...");
	const { buildStoryTextDatabase } = await import("./parsers/story-text-parser.js");
	const db = buildStoryTextDatabase();

	const { PATHS } = await import("./core/paths.js");
	const { writeFileSync } = await import("node:fs");

	const storyTextPath = path.join(PATHS.allGamedata, "story_text_database.json");
	writeFileSync(storyTextPath, JSON.stringify(db, null, 2), "utf-8");
	console.log(`✅ Story Text Database written to ${storyTextPath}`);
}
