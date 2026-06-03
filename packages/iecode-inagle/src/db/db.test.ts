/**
 * Test de conformité : les schémas Valibot des colonnes JSONB doivent valider des lignes RÉELLES
 * extraites de Supabase prod (`fixtures/inagle.sample.json`). C'est la preuve « types alignés sur la
 * vraie donnée » — toute dérive de structure casse ce test.
 */
import { describe, expect, it } from "bun:test";
import * as v from "valibot";

import { CharaData, CharaSheetData, CharaSkillsColumn, SkillData } from "./jsonb.js";
import {
	CharaElement, CharaPosition, CharaRarityLabel, Gender, SkillCategory,
} from "./enums.js";
import { isCrc32Hex, toCrc32Hex } from "./ids.js";
import fixtures from "./fixtures/inagle.sample.json" with { type: "json" };
import edge from "./fixtures/inagle.edge.json" with { type: "json" };

const characters = fixtures.characters as readonly Record<string, unknown>[];
const skills = fixtures.skills as readonly Record<string, unknown>[];

describe("inagle_characters.data — cas-bord réels (lignes creuses)", () => {
	// Régression-guard du finding P1 : schémas trop stricts qui throw sur les lignes prod
	// sans descriptions/teams/zukanHash, names vide {}, stats sans lv1, position Coach.
	it("CharaData accepte toutes les lignes creuses réelles", () => {
		for (const d of edge.charaData) {
			const parsed = v.parse(CharaData, d);
			expect(parsed.charaId).toMatch(/^0x[0-9A-Fa-f]{8}$/u);
		}
		expect(edge.charaData.length).toBeGreaterThanOrEqual(4);
	});
});

describe("inagle_characters — colonnes JSONB réelles", () => {
	it("data valide contre CharaData (toutes les fixtures)", () => {
		for (const row of characters) {
			// throw → message clair si une clé/typage dévie
			const parsed = v.parse(CharaData, row["data"]);
			expect(parsed.charaId).toMatch(/^0x[0-9A-Fa-f]{8}$/u);
			expect(parsed.stats.lv99.kick).toBeGreaterThan(0);
			expect(Array.isArray(parsed.skills)).toBe(true);
		}
	});

	it("sheet_data valide contre CharaSheetData (si non-null)", () => {
		for (const row of characters) {
			if (row["sheet_data"] == null) continue;
			const parsed = v.parse(CharaSheetData, row["sheet_data"]);
			expect(parsed).toBeDefined();
		}
	});

	it("colonne skills valide contre CharaSkillsColumn (si non-null)", () => {
		for (const row of characters) {
			if (row["skills"] == null) continue;
			const parsed = v.parse(CharaSkillsColumn, row["skills"]);
			expect(parsed.every((s) => isCrc32Hex(s.skillId))).toBe(true);
		}
	});

	it("colonnes scalaires dans les enums réels", () => {
		for (const row of characters) {
			if (row["element"] != null) expect(v.is(CharaElement, row["element"])).toBe(true);
			if (row["position"] != null) expect(v.is(CharaPosition, row["position"])).toBe(true);
			if (row["rarity_label"] != null) expect(v.is(CharaRarityLabel, row["rarity_label"])).toBe(true);
			if (row["gender"] != null) expect(v.is(Gender, row["gender"])).toBe(true);
		}
	});
});

describe("inagle_skills — colonnes JSONB réelles", () => {
	it("data valide contre SkillData", () => {
		for (const row of skills) {
			const parsed = v.parse(SkillData, row["data"]);
			expect(parsed.skillID).toMatch(/^0x[0-9A-Fa-f]{8}$/u);
			expect(parsed.power_max).toBeGreaterThanOrEqual(parsed.power_min);
		}
	});

	it("category scalaire dans l'enum réel", () => {
		for (const row of skills) {
			if (row["category"] != null) expect(v.is(SkillCategory, row["category"])).toBe(true);
		}
	});
});

describe("ids brandés", () => {
	it("toCrc32Hex accepte un hash valide, rejette un invalide", () => {
		expect(toCrc32Hex("0x024A9476")).toBe("0x024A9476" as ReturnType<typeof toCrc32Hex>);
		expect(() => toCrc32Hex("rhd10010")).toThrow();
		expect(isCrc32Hex("0xDEADBEEF")).toBe(true);
		expect(isCrc32Hex("nope")).toBe(false);
	});
});
