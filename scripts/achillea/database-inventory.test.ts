import { describe, expect, test } from "bun:test";

import { compareInventories, type DatabaseInventory } from "./database-inventory";

const source: DatabaseInventory = {
	formatVersion: 1,
	label: "source-cloud",
	database: "postgres",
	generatedAt: "2026-09-07T00:00:00.000Z",
	tables: [
		{ schema: "auth", table: "users", rowCount: "2", checksum: "a".repeat(32) },
		{ schema: "public", table: "clan", rowCount: "3", checksum: "b".repeat(32) },
	],
};

describe("Achillea database inventories", () => {
	test("accepte des inventaires identiques", () => {
		const target: DatabaseInventory = {
			...source,
			label: "target-local",
			database: "achillea",
		};
		expect(compareInventories(source, target)).toEqual([]);
	});

	test("detecte tables, nombres de lignes et contenu differents", () => {
		const target: DatabaseInventory = {
			formatVersion: 1,
			label: "target-local",
			database: "achillea",
			generatedAt: "2026-09-07T00:10:00.000Z",
			tables: [
				{ schema: "auth", table: "users", rowCount: "1", checksum: "a".repeat(32) },
				{ schema: "public", table: "clan", rowCount: "3", checksum: "c".repeat(32) },
				{ schema: "storage", table: "objects", rowCount: "4", checksum: "d".repeat(32) },
			],
		};
		expect(compareInventories(source, target)).toEqual([
			{ table: "auth.users", kind: "row-count", source: "2", target: "1" },
			{ table: "public.clan", kind: "checksum", source: "b".repeat(32), target: "c".repeat(32) },
			{ table: "storage.objects", kind: "extra-target" },
		]);
	});

	test("refuse une cible qui n'est pas la base locale achillea", () => {
		expect(() =>
			compareInventories(source, {
				...source,
				label: "target-local",
				database: "rg",
			})
		).toThrow("cible Achillea invalide");
	});
});
