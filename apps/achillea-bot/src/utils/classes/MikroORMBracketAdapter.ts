import type { CrudInterface, DataTypes, OmitId, Table } from "brackets-manager";
import type { Id } from "brackets-model";

import type { Database } from "@/services";

/**
 * Adaptateur MikroORM pour brackets-manager.
 *
 * MikroORM v7 a remplacé Knex par Kysely ; pour éviter de dépendre d'un query-builder
 * externe dont le schéma des tables brackets-manager varie dynamiquement, on passe
 * directement par `em.execute()` (SQL brut PostgreSQL).
 */
export class MikroORMBracketAdapter implements CrudInterface {
	constructor(
		private readonly db: Database,
		private readonly tablePrefix: string = "bm_"
	) {}

	private getTableName(table: Table) {
		return this.tablePrefix + table;
	}

	async insert<T extends Table>(
		table: T,
		value: OmitId<DataTypes[T]> | OmitId<DataTypes[T]>[]
	): Promise<any> {
		const em = this.db.em;
		const tableName = this.getTableName(table);

		const rows = Array.isArray(value) ? value : [value];

		if (rows.length === 0) return true;

		// Construit la liste des colonnes à partir du premier objet
		const cols = Object.keys(rows[0] as object);
		const colList = cols.map((c) => `"${c}"`).join(", ");

		// Construit les placeholders : chaque ligne = (?, ?, ...)
		// MikroORM v7 (Kysely) attend des placeholders "?" (formatQuery inline via quoteValue),
		// PAS la syntaxe positionnelle "$1" de PostgreSQL.
		const placeholders = rows.map(() => `(${cols.map(() => "?").join(", ")})`).join(", ");

		const params = rows.flatMap((row) => cols.map((c) => (row as Record<string, unknown>)[c]));

		if (Array.isArray(value)) {
			await em.execute(`INSERT INTO "${tableName}" (${colList}) VALUES ${placeholders}`, params);

			return true;
		}

		// Mode unitaire : retourner l'id généré
		const result = await em.execute<{ id: number }[]>(
			`INSERT INTO "${tableName}" (${colList}) VALUES ${placeholders} RETURNING "id"`,
			params,
			"all"
		);

		return result[0]?.id ?? null;
	}

	// --- SELECT ---
	async select<T extends Table>(table: T, filter?: Id | Partial<DataTypes[T]>): Promise<any> {
		const em = this.db.em;
		const tableName = this.getTableName(table);

		// Cas 1 : Tout récupérer -> Doit renvoyer un tableau (vide ou non)
		// ORDER BY id : brackets-manager (getLosers, stageData, seeding...) suppose que les
		// lignes reviennent dans l'ordre de création (round 1, round 2, ...). Sans tri
		// explicite, Postgres ne garantit AUCUN ordre — ça a corrompu des standings
		// (rounds mal regroupés) dès qu'on interroge plusieurs stages dans la même requête.
		if (filter === undefined) {
			return em.execute<DataTypes[T][]>(
				`SELECT * FROM "${tableName}" ORDER BY "id" ASC`,
				[],
				"all"
			);
		}

		// Cas 2 : Récupérer par ID unique -> Doit renvoyer un objet ou null
		if (typeof filter === "number" || typeof filter === "string") {
			const rows = await em.execute<DataTypes[T][]>(
				`SELECT * FROM "${tableName}" WHERE "id" = ?`,
				[filter],
				"all"
			);

			return rows[0] ?? null;
		}

		// Cas 3 : Récupérer avec un objet de filtre -> Doit TOUJOURS renvoyer un tableau
		try {
			const entries = Object.entries(filter as object).filter(([, v]) => v !== undefined);

			if (entries.length === 0) {
				return em.execute<DataTypes[T][]>(
					`SELECT * FROM "${tableName}" ORDER BY "id" ASC`,
					[],
					"all"
				);
			}

			const where = entries.map(([col]) => `"${col}" = ?`).join(" AND ");
			const params = entries.map(([, v]) => v);

			return em.execute<DataTypes[T][]>(
				`SELECT * FROM "${tableName}" WHERE ${where} ORDER BY "id" ASC`,
				params,
				"all"
			);
		} catch (error) {
			console.error(`Erreur SQL lors du select sur ${table} avec le filtre:`, filter, error);

			return null;
		}
	}

	// --- UPDATE ---
	async update<T extends Table>(
		table: T,
		filter: Id | Partial<DataTypes[T]>,
		value?: Partial<DataTypes[T]>
	): Promise<boolean> {
		const em = this.db.em;
		const tableName = this.getTableName(table);

		if (!value) return false;

		const setEntries = Object.entries(value as object).filter(([, v]) => v !== undefined);
		if (setEntries.length === 0) return false;

		const setClause = setEntries.map(([col]) => `"${col}" = ?`).join(", ");
		const setParams = setEntries.map(([, v]) => v);

		if (typeof filter === "number" || typeof filter === "string") {
			// Surcharge update(table, id, value)
			const result = await em.execute<{ affectedRows?: number }>(
				`UPDATE "${tableName}" SET ${setClause} WHERE "id" = ?`,
				[...setParams, filter],
				"run"
			);

			return (result.affectedRows ?? 0) !== 0;
		} else {
			// Surcharge update(table, filter, value)
			const filterEntries = Object.entries(filter as object).filter(([, v]) => v !== undefined);
			const whereClause = filterEntries.map(([col]) => `"${col}" = ?`).join(" AND ");
			const whereParams = filterEntries.map(([, v]) => v);

			const result = await em.execute<{ affectedRows?: number }>(
				`UPDATE "${tableName}" SET ${setClause}${filterEntries.length ? ` WHERE ${whereClause}` : ""}`,
				[...setParams, ...whereParams],
				"run"
			);

			return (result.affectedRows ?? 0) !== 0;
		}
	}

	// --- DELETE ---
	async delete<T extends Table>(table: T, filter?: Partial<DataTypes[T]>): Promise<boolean> {
		const em = this.db.em;
		const tableName = this.getTableName(table);

		try {
			if (!filter) {
				await em.execute(`DELETE FROM "${tableName}"`, [], "run");
			} else {
				const entries = Object.entries(filter as object).filter(([, v]) => v !== undefined);

				if (entries.length === 0) {
					await em.execute(`DELETE FROM "${tableName}"`, [], "run");
				} else {
					const where = entries.map(([col]) => `"${col}" = ?`).join(" AND ");
					const params = entries.map(([, v]) => v);

					await em.execute(`DELETE FROM "${tableName}" WHERE ${where}`, params, "run");
				}
			}

			// On retourne TOUJOURS true si la requête a été exécutée sans erreur.
			return true;
		} catch (error) {
			console.error(`Erreur lors du delete dans la table ${tableName}:`, error);

			return false;
		}
	}
}
