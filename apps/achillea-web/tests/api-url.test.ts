/**
 * Test unitaire de `apiUrl()` (préfixage des chemins API côté front). Pur, sans DOM.
 *
 * Run : bun test tests/api-url.test.ts
 */
import { describe, expect, test } from "bun:test";

import { apiUrl } from "../src/app/core/http/api-url";

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
