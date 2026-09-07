import { describe, expect, test } from "bun:test";

import { parseRestoreList, resolveLocalTarget } from "./migrate-local-database";

const restoreList = `;
; Archive created at 2026-09-07
10; 2615 100 SCHEMA - public postgres
11; 2615 101 SCHEMA - auth supabase_admin
12; 2615 102 SCHEMA - storage supabase_storage_admin
20; 3079 200 EXTENSION - pgcrypto postgres
30; 1259 300 TABLE public clan postgres
31; 0 300 TABLE DATA public clan postgres
32; 1259 301 TABLE auth users supabase_auth_admin
33; 1259 302 TABLE storage objects supabase_storage_admin
`;

describe("Achillea local database migration", () => {
	test("inventorie schemas, extensions, tables et owners", () => {
		const inventory = parseRestoreList(restoreList);
		expect(inventory.schemas).toEqual(["auth", "public", "storage"]);
		expect(inventory.extensions).toEqual(["pgcrypto"]);
		expect(inventory.tables).toEqual(["auth.users", "public.clan", "storage.objects"]);
		expect(inventory.owners).toContain("supabase_auth_admin");
	});

	test("cible uniquement la base locale achillea", () => {
		expect(resolveLocalTarget()).toEqual({
			database: "achillea",
			host: "/var/run/postgresql",
			port: "5432",
			user: "postgres",
		});
		for (const database of ["rg", "rose_griffon", "postgres", "template0", "template1"]) {
			expect(() => resolveLocalTarget({ ACHILLEA_LOCAL_PGDATABASE: database })).toThrow(
				"uniquement dans la base dediee achillea"
			);
		}
	});

	test("autorise le role postgres explicite sans elargir la base cible", () => {
		expect(
			resolveLocalTarget({
				ACHILLEA_LOCAL_PGDATABASE: "achillea",
				ACHILLEA_LOCAL_PGHOST: "/var/run/postgresql",
				ACHILLEA_LOCAL_PGUSER: "postgres",
			})
		).toEqual({
			database: "achillea",
			host: "/var/run/postgresql",
			port: "5432",
			user: "postgres",
		});
	});

	test("refuse une cible reseau externe", () => {
		expect(() =>
			resolveLocalTarget({
				ACHILLEA_LOCAL_PGDATABASE: "achillea",
				ACHILLEA_LOCAL_PGHOST: "db.example.com",
			})
		).toThrow("PostgreSQL local");
	});
});
