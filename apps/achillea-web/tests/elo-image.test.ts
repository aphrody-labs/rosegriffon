/**
 * Test unitaire de `getEloImagePath()` (mapping palier → slug d'image, FR/EN).
 * Vérifie aussi qu'importer un module qui dépend de `@angular/core` (signal) reste
 * exécutable sous bun:test (pas de bootstrap Angular).
 *
 * Run : bun test tests/elo-image.test.ts
 */
import { describe, expect, test } from "bun:test";

import { getEloImagePath } from "../src/app/core/helpers/misc";

describe("getEloImagePath", () => {
	test("mappe les paliers FR vers leur slug image FR (ASCII, sans accent)", () => {
		expect(getEloImagePath("Fer")).toBe("ranks/fer.webp");
		expect(getEloImagePath("Diamant")).toBe("ranks/diamant.webp");
		expect(getEloImagePath("Émeraude")).toBe("ranks/emeraude.webp");
		expect(getEloImagePath("Rubis")).toBe("ranks/rubis.webp");
		expect(getEloImagePath("Légendaire")).toBe("ranks/legendaire.webp");
	});

	test("fallback Fer sur clé absente ou inconnue", () => {
		expect(getEloImagePath(null)).toBe("ranks/fer.webp");
		expect(getEloImagePath(undefined)).toBe("ranks/fer.webp");
		expect(getEloImagePath("palier-inexistant")).toBe("ranks/fer.webp");
	});
});
