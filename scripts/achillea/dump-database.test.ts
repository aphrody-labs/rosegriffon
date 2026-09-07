import { describe, expect, test } from "bun:test";
import { chmod, mkdtemp, readdir, rm, stat } from "node:fs/promises";
import path from "node:path";

import { createDumpPlan, executeDump, pgPassLine } from "./dump-database";

const ref = "yftdclwvehxxffwqvhmc";
const date = new Date("2026-09-07T12:34:56.000Z");

describe("Achillea database dump", () => {
	test("accepte la base Supabase Achillea directe sans mot de passe dans argv", () => {
		const plan = createDumpPlan(
			{
				ACHILLEA_DATABASE_URL: `postgresql://postgres:p%40ss@db.${ref}.supabase.co:5432/postgres?sslmode=require`,
			},
			date
		);
		expect(plan.finalPath).toEndWith("/achillea-20260907T123456Z.dump");
		expect(plan.pgDumpArguments.join(" ")).not.toContain("p@ss");
		expect(pgPassLine(plan)).toEndWith(":postgres:p@ss");
	});

	test("accepte le pooler seulement si le project ref est porte par le user", () => {
		const plan = createDumpPlan({
			ACHILLEA_DATABASE_URL: `postgresql://postgres.${ref}:secret@aws-0-eu-west-1.pooler.supabase.com:6543/postgres?sslmode=require`,
		});
		expect(plan.host).toBe("aws-0-eu-west-1.pooler.supabase.com");
		expect(plan.projectRef).toBe(ref);
	});

	test("refuse une autre cible Supabase, dont RG", () => {
		expect(() =>
			createDumpPlan({
				ACHILLEA_DATABASE_URL:
					"postgresql://postgres.otherprojectref123:secret@aws-0-eu-west-1.pooler.supabase.com:6543/postgres?sslmode=require",
			})
		).toThrow("project ref Supabase Achillea attendu");
	});

	test("refuse les cibles locales, sans TLS ou sans mot de passe", () => {
		expect(() =>
			createDumpPlan({
				ACHILLEA_DATABASE_URL:
					"postgresql://postgres:secret@127.0.0.1:5432/postgres?sslmode=require",
			})
		).toThrow("locale, privee ou adressee par IP");
		expect(() =>
			createDumpPlan({
				ACHILLEA_DATABASE_URL: `postgresql://postgres:secret@db.${ref}.supabase.co/postgres`,
			})
		).toThrow("doit imposer sslmode");
		expect(() =>
			createDumpPlan({
				ACHILLEA_DATABASE_URL: `postgresql://postgres@db.${ref}.supabase.co/postgres?sslmode=require`,
			})
		).toThrow("utilisateur, mot de passe et base");
	});

	test("refuse toute destination dans le depot", () => {
		expect(() =>
			createDumpPlan({
				ACHILLEA_BACKUP_DIR: "/home/ubuntu/rg/backups",
				ACHILLEA_DATABASE_URL: `postgresql://postgres:secret@db.${ref}.supabase.co/postgres?sslmode=require`,
			})
		).toThrow("hors du depot");
	});

	test("cree atomiquement un dump 0600 sans laisser le passfile", async () => {
		const temporaryRoot = await mkdtemp("/tmp/achillea-dump-test-");
		const fakePgDump = path.join(temporaryRoot, "pg_dump-fake");
		await Bun.write(
			fakePgDump,
			'#!/bin/sh\nset -eu\nout=""\nwhile [ "$#" -gt 0 ]; do\n  if [ "$1" = "--file" ]; then shift; out="$1"; fi\n  shift || true\ndone\ntest -n "$PGPASSFILE"\ntest -f "$PGPASSFILE"\nprintf "fake-custom-dump" > "$out"\n'
		);
		await chmod(fakePgDump, 0o700);

		try {
			const plan = createDumpPlan(
				{
					ACHILLEA_BACKUP_DIR: path.join(temporaryRoot, "backups"),
					ACHILLEA_DATABASE_URL: `postgresql://postgres:secret@db.${ref}.supabase.co/postgres?sslmode=require`,
				},
				date
			);
			await executeDump(plan, fakePgDump);
			const output = await stat(plan.finalPath);
			const directory = await stat(plan.backupDirectory);
			expect(output.mode & 0o777).toBe(0o600);
			expect(directory.mode & 0o777).toBe(0o700);
			expect(await readdir(plan.backupDirectory)).toEqual([path.basename(plan.finalPath)]);
		} finally {
			await rm(temporaryRoot, { force: true, recursive: true });
		}
	});
});
