import type { Database } from "@rosegriffon/db/schema";
import type { Kysely } from "kysely";

type Db = Kysely<Database>;

function json(value: unknown): unknown {
	return value ?? null;
}

export class InagleRepository {
	constructor(private readonly db: Db) {}

	async teams(query?: string, limit = 50) {
		try {
			let request = this.db
				.selectFrom("inagle_teams")
				.selectAll()
				.orderBy("name_fr", "asc")
				.limit(limit);
			if (query) {
				const term = `%${query.toLowerCase()}%`;
				request = request.where((eb) => eb.or([
					eb("name_fr", "ilike", term),
					eb("name_en", "ilike", term),
					eb("name_ja", "ilike", `%${query}%`),
				]));
			}
			const rows = await request.execute();
			return rows.map((row) => ({
				...row,
				name: row.name_fr ?? row.name_en ?? row.name_ja ?? row.id,
				displayName: row.name_fr ?? row.name_en ?? row.name_ja ?? row.id,
				emblems: json(row.emblems),
				kits: json(row.kits),
				members: json(row.members),
			}));
		} catch {
			return null;
		}
	}

	async team(id: string) {
		try {
			const row = await this.db.selectFrom("inagle_teams").selectAll().where("id", "=", id).executeTakeFirst();
			return row ? {
				...row,
				name: row.name_fr ?? row.name_en ?? row.name_ja ?? row.id,
				displayName: row.name_fr ?? row.name_en ?? row.name_ja ?? row.id,
			} : null;
		} catch {
			return null;
		}
	}

	async quests(query?: string, phase?: number, limit = 50) {
		try {
			let request = this.db
				.selectFrom("inagle_quests")
				.selectAll()
				.orderBy("id", "asc")
				.limit(limit);
			if (query) {
				const term = `%${query.toLowerCase()}%`;
				request = request.where((eb) => eb.or([
					eb("display_text", "ilike", term),
					eb("name_fr", "ilike", term),
					eb("name_en", "ilike", term),
					eb("name_ja", "ilike", `%${query}%`),
				]));
			}
			if (phase !== undefined) request = request.where("phase", "=", String(phase));
			const rows = await request.execute();
			return rows.map((row) => ({
				...row,
				id: row.id,
				displayText: row.display_text ?? row.name_fr ?? row.name_en ?? row.name_ja ?? row.id,
				explain_FR: row.name_fr,
				explain_EN: row.name_en,
				explain_JA: row.name_ja,
			}));
		} catch {
			return null;
		}
	}

	async quest(id: string) {
		try {
			const row = await this.db.selectFrom("inagle_quests").selectAll().where("id", "=", id).executeTakeFirst();
			return row ? {
				...row,
				displayText: row.display_text ?? row.name_fr ?? row.name_en ?? row.name_ja ?? row.id,
				explain_FR: row.name_fr,
				explain_EN: row.name_en,
				explain_JA: row.name_ja,
			} : null;
		} catch {
			return null;
		}
	}

	async items(query?: string, category?: string, limit = 50) {
		try {
			let request = this.db
				.selectFrom("inagle_items")
				.selectAll()
				.orderBy("id", "asc")
				.limit(limit);
			if (query) {
				const term = `%${query.toLowerCase()}%`;
				request = request.where((eb) => eb.or([
					eb("name_fr", "ilike", term),
					eb("name_en", "ilike", term),
					eb("name_ja", "ilike", `%${query}%`),
				]));
			}
			if (category) request = request.where("category", "=", category);
			const rows = await request.execute();
			return rows.map((row) => ({
				...row,
				names: { fr: row.name_fr, en: row.name_en, ja: row.name_ja },
			}));
		} catch {
			return null;
		}
	}

	async souls(query?: string, limit = 50) {
		try {
			let request = this.db.selectFrom("inagle_souls").selectAll().orderBy("id", "asc").limit(limit);
			if (query) {
				const term = `%${query.toLowerCase()}%`;
				request = request.where((eb) => eb.or([
					eb("name_fr", "ilike", term),
					eb("name_en", "ilike", term),
					eb("name_ja", "ilike", `%${query}%`),
				]));
			}
			return await request.execute();
		} catch {
			return null;
		}
	}

	async formations(query?: string, limit = 50) {
		try {
			let request = this.db.selectFrom("inagle_formations").selectAll().orderBy("id", "asc").limit(limit);
			if (query) {
				const term = `%${query.toLowerCase()}%`;
				request = request.where((eb) => eb.or([
					eb("name_fr", "ilike", term),
					eb("name_en", "ilike", term),
					eb("name_ja", "ilike", `%${query}%`),
				]));
			}
			return await request.execute();
		} catch {
			return null;
		}
	}

	async formation(id: string) {
		try {
			return await this.db.selectFrom("inagle_formations").selectAll().where("id", "=", id).executeTakeFirst() ?? null;
		} catch {
			return null;
		}
	}

	async soul(id: string) {
		try {
			return await this.db.selectFrom("inagle_souls").selectAll().where("id", "=", id).executeTakeFirst() ?? null;
		} catch {
			return null;
		}
	}

	async item(id: string) {
		try {
			const row = await this.db.selectFrom("inagle_items").selectAll().where("id", "=", id).executeTakeFirst();
			return row ? { ...row, names: { fr: row.name_fr, en: row.name_en, ja: row.name_ja } } : null;
		} catch {
			return null;
		}
	}

	async dropTable(id: string) {
		try {
			return await this.db.selectFrom("inagle_drops_tables").selectAll().where("table_id", "=", id).executeTakeFirst() ?? null;
		} catch {
			return null;
		}
	}

	async battleDrops(id: number) {
		try {
			const battle = await this.db.selectFrom("inagle_drops_battles").selectAll().where("battle_group_id", "=", id).executeTakeFirst();
			if (!battle?.item_table_id) return [];
			const table = await this.dropTable(String(battle.item_table_id));
			return table ? [{ items: table.entries }] : [];
		} catch {
			return null;
		}
	}

	async dropSources(itemId: string) {
		try {
			const normalized = itemId.toLowerCase();
			const [tables, battles, treasures] = await Promise.all([
				this.db.selectFrom("inagle_drops_tables").selectAll().execute(),
				this.db.selectFrom("inagle_drops_battles").selectAll().execute(),
				this.db.selectFrom("inagle_drops_treasures").selectAll().execute(),
			]);
			const tableIds = new Set(tables.filter((row) => {
				const entries = Array.isArray(row.entries) ? row.entries : [];
				return entries.some((entry) => {
					if (!entry || typeof entry !== "object") return false;
					const value = (entry as { itemId?: unknown; item_id?: unknown }).itemId ?? (entry as { item_id?: unknown }).item_id;
					return String(value).toLowerCase() === normalized || String(value) === itemId;
				});
			}).map((row) => row.table_id));
			const sources: Array<{ type: "battle" | "treasure"; id: string; mapId?: string }> = battles
				.filter((row) => row.item_table_id !== null && tableIds.has(String(row.item_table_id)))
				.map((row) => ({ type: "battle" as const, id: String(row.battle_group_id) }));
			for (const treasure of treasures) {
				const items = Array.isArray(treasure.items) ? treasure.items : [];
				if (items.some((entry) => String(entry).toLowerCase() === normalized)) {
					sources.push({ type: "treasure" as const, id: treasure.id, mapId: treasure.map_id ?? undefined });
				}
			}
			return sources;
		} catch {
			return null;
		}
	}

	async skillCutin(id: string) {
		try {
			return await this.db.selectFrom("inagle_skill_cutins").selectAll().where("skill_id", "=", id).executeTakeFirst() ?? null;
		} catch {
			return null;
		}
	}

	async skillCutinAssets(eventIdName: string) {
		try {
			return await this.db.selectFrom("inagle_skill_cutin_assets").selectAll().where("event_id_name", "=", eventIdName).executeTakeFirst() ?? null;
		} catch {
			return null;
		}
	}
}
