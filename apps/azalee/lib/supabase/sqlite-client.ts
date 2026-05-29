import type { Database } from "bun:sqlite";
import { readdirSync } from "node:fs";
import path from "node:path";

function getSqlitePath(): string | null {
	if (process.env.SQLITE_DB_PATH) {
		return path.resolve(process.env.SQLITE_DB_PATH);
	}

	// Potential backup directories
	const dirs = [
		path.resolve(process.cwd(), "data/backups"),
		path.resolve(process.cwd(), "apps/azalee/data/backups"),
		"/home/ubuntu/rg/apps/azalee/data/backups",
	];

	for (const dir of dirs) {
		try {
			const files = readdirSync(dir);
			// Filter for supabase-*.sqlite files and sort descending (latest first)
			const sqliteFiles = files
				.filter((f) => f.startsWith("supabase-") && f.endsWith(".sqlite"))
				.sort((a, b) => b.localeCompare(a));

			if (sqliteFiles.length > 0) {
				return path.join(dir, sqliteFiles[0]);
			}
		} catch {
			// ignore directory read errors
		}
	}
	return null;
}

let _sqliteDb: Database | null = null;
function getSqliteDb(): Database {
	if (_sqliteDb) return _sqliteDb;
	const dbPath = getSqlitePath();
	if (!dbPath) {
		throw new Error("No SQLite database backup found");
	}
	if (typeof Bun === "undefined") {
		throw new Error("[SQLite Client] bun:sqlite is only available when running under Bun");
	}
	// eslint-disable-next-line @typescript-eslint/no-require-imports -- dynamic require needed for bun:sqlite lazy load inside Bun guard
	const { Database: DBConstructor } = require("bun:sqlite");
	_sqliteDb = new DBConstructor(dbPath, { readonly: true }) as Database;
	_sqliteDb.exec("PRAGMA journal_mode = WAL");
	_sqliteDb.exec("PRAGMA temp_store = MEMORY");
	return _sqliteDb;
}

export class SqliteQueryBuilder {
	private db: Database;
	private table: string;
	private selects: string = "*";
	private wheres: string[] = [];
	private params: Array<string | number | boolean | null> = [];
	private limitValue: number | null = null;
	private offsetValue: number | null = null;
	private orders: string[] = [];
	private isSingle: boolean = false;
	private isMaybeSingle: boolean = false;
	private countOption: string | null = null;

	private needsGrouping: boolean = false;

	constructor(db: Database, table: string) {
		this.db = db;
		if (table.endsWith("_clean")) {
			this.table = table.replace("_clean", "");
			this.needsGrouping = true;
		} else {
			this.table = table;
		}
	}

	select(fields: string = "*", options?: { count?: string }) {
		this.selects = fields;
		if (options?.count) {
			this.countOption = options.count;
		}
		return this;
	}

	private cleanCol(col: string): string {
		if (col.includes("->>")) {
			const [left, right] = col.split("->>");
			return `json_extract(${left}, '$.${right}')`;
		}
		return `"${col}"`;
	}

	eq(col: string, val: string | number | boolean | null) {
		const column = this.cleanCol(col);
		if (val === null) {
			this.wheres.push(`${column} IS NULL`);
		} else {
			this.wheres.push(`${column} = ?`);
			this.params.push(typeof val === "boolean" ? (val ? 1 : 0) : val);
		}
		return this;
	}

	neq(col: string, val: string | number | boolean | null) {
		const column = this.cleanCol(col);
		if (val === null) {
			this.wheres.push(`${column} IS NOT NULL`);
		} else {
			this.wheres.push(`${column} != ?`);
			this.params.push(typeof val === "boolean" ? (val ? 1 : 0) : val);
		}
		return this;
	}

	not(col: string, op: string, val: string | number | boolean | null) {
		const column = this.cleanCol(col);
		if (op === "is" && val === null) {
			this.wheres.push(`${column} IS NOT NULL`);
		} else if (op === "like" || op === "ilike") {
			this.wheres.push(`${column} NOT LIKE ?`);
			this.params.push(val);
		} else {
			this.wheres.push(`${column} != ?`);
			this.params.push(typeof val === "boolean" ? (val ? 1 : 0) : val);
		}
		return this;
	}

	ilike(col: string, pattern: string) {
		const column = this.cleanCol(col);
		this.wheres.push(`${column} LIKE ?`);
		this.params.push(pattern);
		return this;
	}

	gte(col: string, val: string | number | boolean | null) {
		const column = this.cleanCol(col);
		this.wheres.push(`${column} >= ?`);
		this.params.push(typeof val === "boolean" ? (val ? 1 : 0) : val);
		return this;
	}

	lte(col: string, val: string | number | boolean | null) {
		const column = this.cleanCol(col);
		this.wheres.push(`${column} <= ?`);
		this.params.push(typeof val === "boolean" ? (val ? 1 : 0) : val);
		return this;
	}

	in(col: string, arr: Array<string | number | boolean | null>) {
		if (!arr || arr.length === 0) {
			this.wheres.push("1 = 0");
			return this;
		}
		const column = this.cleanCol(col);
		const placeholders = arr.map(() => "?").join(", ");
		this.wheres.push(`${column} IN (${placeholders})`);
		this.params.push(...arr.map((val) => (typeof val === "boolean" ? (val ? 1 : 0) : val)));
		return this;
	}

	or(orString: string) {
		const parts = orString.split(",");
		const conditions: string[] = [];
		const orParams: Array<string | number | boolean | null> = [];

		for (const part of parts) {
			const match = part.match(/(.+?)\.(ilike|eq)\.(.+)/);
			if (match) {
				const [, col, op, val] = match;
				const column = this.cleanCol(col);

				if (op === "ilike") {
					let cleanVal = val;
					if (cleanVal.startsWith("%")) cleanVal = cleanVal.slice(1);
					if (cleanVal.endsWith("%")) cleanVal = cleanVal.slice(0, -1);
					conditions.push(`${column} LIKE ?`);
					orParams.push(`%${cleanVal}%`);
				} else if (op === "eq") {
					conditions.push(`${column} = ?`);
					orParams.push(val === "true" ? 1 : val === "false" ? 0 : val);
				}
			}
		}

		if (conditions.length > 0) {
			this.wheres.push(`(${conditions.join(" OR ")})`);
			this.params.push(...orParams);
		}

		return this;
	}

	limit(n: number) {
		this.limitValue = n;
		return this;
	}

	order(col: string, options?: { ascending?: boolean }) {
		const column = this.cleanCol(col);
		const dir = options?.ascending === false ? "DESC" : "ASC";
		this.orders.push(`${column} ${dir}`);
		return this;
	}

	range(from: number, to: number) {
		this.limitValue = to - from + 1;
		this.offsetValue = from;
		return this;
	}

	single() {
		this.isSingle = true;
		return this;
	}

	maybeSingle() {
		this.isMaybeSingle = true;
		return this;
	}

	// Make the class then-able (Promise-like)
	async then<TResult1 = unknown>(
		onfulfilled?:
			| ((value: {
					data: Record<string, unknown> | Array<Record<string, unknown>> | null;
					error: Error | null;
					count: number | null;
			  }) => TResult1 | PromiseLike<TResult1>)
			| undefined
			| null
	) {
		try {
			const data = await this.execute();
			const count = this.countOption ? await this.executeCount() : null;

			const response = {
				data,
				error: null as Error | null,
				count,
			};

			if (onfulfilled) {
				return onfulfilled(response);
			}
			return response;
		} catch (err) {
			const response = {
				data: null,
				error: err instanceof Error ? err : new Error(String(err)),
				count: null,
			};
			if (onfulfilled) {
				return onfulfilled(response);
			}
			return response;
		}
	}

	private compileSelect(): string {
		let sql = `SELECT ${this.selects} FROM "${this.table}"`;
		if (this.wheres.length > 0) {
			sql += ` WHERE ${this.wheres.join(" AND ")}`;
		}
		if (this.needsGrouping) {
			sql += ' GROUP BY "name_fr"';
		}
		if (this.orders.length > 0) {
			sql += ` ORDER BY ${this.orders.join(", ")}`;
		}
		if (this.limitValue !== null) {
			sql += ` LIMIT ${this.limitValue}`;
		}
		if (this.offsetValue !== null) {
			sql += ` OFFSET ${this.offsetValue}`;
		}
		return sql;
	}

	private async execute(): Promise<
		Record<string, unknown> | Array<Record<string, unknown>> | null
	> {
		const sql = this.compileSelect();
		const stmt = this.db.prepare(sql);
		const rawRows = stmt.all(...this.params) as Array<Record<string, unknown>>;

		const parsedRows = rawRows.map((r) => this.parseRow(r));

		if (this.isSingle) {
			if (parsedRows.length === 0) {
				throw new Error("No rows found");
			}
			return parsedRows[0];
		}

		if (this.isMaybeSingle) {
			return parsedRows.length > 0 ? parsedRows[0] : null;
		}

		return parsedRows;
	}

	private async executeCount(): Promise<number> {
		let sql = this.needsGrouping
			? `SELECT COUNT(DISTINCT "name_fr") as count FROM "${this.table}"`
			: `SELECT COUNT(*) as count FROM "${this.table}"`;
		if (this.wheres.length > 0) {
			sql += ` WHERE ${this.wheres.join(" AND ")}`;
		}
		const stmt = this.db.prepare(sql);
		const result = stmt.get(...this.params) as { count: number };
		return result?.count ?? 0;
	}

	private parseRow(row: Record<string, unknown>): Record<string, unknown> {
		const parsed: Record<string, unknown> = {};
		for (const [key, val] of Object.entries(row)) {
			if (typeof val === "string" && (val.startsWith("{") || val.startsWith("["))) {
				try {
					parsed[key] = JSON.parse(val);
				} catch {
					parsed[key] = val;
				}
			} else {
				parsed[key] = val;
			}
		}
		return parsed;
	}
}

export function createSqliteClient() {
	return {
		from(table: string) {
			const db = getSqliteDb();
			return new SqliteQueryBuilder(db, table);
		},
	};
}
