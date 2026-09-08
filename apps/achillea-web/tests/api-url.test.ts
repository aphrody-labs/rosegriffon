/**
 * Test unitaire de `apiUrl()` (préfixage des chemins API côté front). Pur, sans DOM.
 *
 * Run : bun test tests/api-url.test.ts
 */
import { describe, expect, test } from "bun:test";

import { apiUrl, joinApiUrl } from "../src/app/core/http/api-url";

describe("apiUrl", () => {
	test("préfixe un chemin relatif avec un slash de tête", () => {
		expect(apiUrl("api/clans")).toBe("/api/clans");
	});

	test("conserve un chemin déjà absolu (slash de tête)", () => {
		expect(apiUrl("/api/ranked/tiers")).toBe("/api/ranked/tiers");
	});

	test("laisse intacte une URL absolue http(s)", () => {
		expect(apiUrl("https://ranked.rosegriffon.fr/api/health")).toBe(
			"https://ranked.rosegriffon.fr/api/health"
		);
		expect(apiUrl("http://x/y")).toBe("http://x/y");
	});
});

describe("joinApiUrl", () => {
	test("ne duplique pas /api avec une base absolue qui le contient déjà", () => {
		expect(joinApiUrl("https://achillea.rosegriffon.fr/api", "api/tournaments?page=1")).toBe(
			"https://achillea.rosegriffon.fr/api/tournaments?page=1"
		);
	});

	test("ne duplique pas /api avec une base relative", () => {
		expect(joinApiUrl("/api", "/api/users/me")).toBe("/api/users/me");
	});

	test("ajoute /api quand la base ne le contient pas", () => {
		expect(joinApiUrl("https://api.example.test", "/api/clans")).toBe(
			"https://api.example.test/api/clans"
		);
	});

	test("conserve les URL http(s) déjà absolues", () => {
		expect(joinApiUrl("https://api.example.test/api", "https://ranked.example.test/health")).toBe(
			"https://ranked.example.test/health"
		);
	});
});
