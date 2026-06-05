import { describe, expect, test } from "bun:test";

import {
	achievementDisplayDescription,
	achievementDisplayName,
	IEVR_ACHIEVEMENTS,
	IEVR_ACHIEVEMENTS_COUNT,
	lookupAchievement,
} from "./achievements";
import {
	achievementApiName,
	achievementNumFromApiName,
	IEVR_TROPHY_COUNT,
	IEVR_VISIBLE_ACHIEVEMENT_COUNT,
} from "./constants";

describe("achievementApiName / achievementNumFromApiName (format ACHIEVEMENT_%04u)", () => {
	test("padde sur 4 chiffres minimum", () => {
		expect(achievementApiName(1)).toBe("ACHIEVEMENT_0001");
		expect(achievementApiName(52)).toBe("ACHIEVEMENT_0052");
		expect(achievementApiName(89)).toBe("ACHIEVEMENT_0089");
	});

	test("ne tronque pas au-delà de 4 chiffres", () => {
		expect(achievementApiName(1051)).toBe("ACHIEVEMENT_1051");
	});

	test("aller-retour num ↔ apiName", () => {
		for (const n of [1, 7, 52, 230, 1051]) {
			expect(achievementNumFromApiName(achievementApiName(n))).toBe(n);
		}
	});

	test("rejette un num invalide", () => {
		expect(() => achievementApiName(-1)).toThrow(RangeError);
		expect(() => achievementApiName(1.5)).toThrow(RangeError);
	});

	test("achievementNumFromApiName rejette une chaîne hors format", () => {
		expect(achievementNumFromApiName("STAT_0001")).toBeNull();
		expect(achievementNumFromApiName("ACHIEVEMENT_abcd")).toBeNull();
		expect(achievementNumFromApiName(null)).toBeNull();
		expect(achievementNumFromApiName(undefined)).toBeNull();
	});
});

describe("manifeste IEVR (ancré sur trophy_config + inagle_trophies)", () => {
	test("couvre les 230 trophées internes", () => {
		expect(IEVR_ACHIEVEMENTS_COUNT).toBe(230);
		expect(IEVR_TROPHY_COUNT).toBe(230);
		expect(Object.keys(IEVR_ACHIEVEMENTS)).toHaveLength(230);
	});

	test("toutes les clés suivent ACHIEVEMENT_%04u et correspondent à leur num", () => {
		for (const [apiName, info] of Object.entries(IEVR_ACHIEVEMENTS)) {
			expect(apiName).toMatch(/^ACHIEVEMENT_\d{4,}$/);
			expect(achievementApiName(info.num)).toBe(apiName);
			expect(achievementNumFromApiName(apiName)).toBe(info.num);
			expect(typeof info.trophyId).toBe("string");
			expect(info.trophyId.length).toBeGreaterThan(0);
		}
	});

	test("nums distincts, dans la plage 1..1051", () => {
		const nums = Object.values(IEVR_ACHIEVEMENTS).map((i) => i.num);
		expect(new Set(nums).size).toBe(nums.length);
		expect(Math.min(...nums)).toBe(1);
		expect(Math.max(...nums)).toBe(1051);
	});

	test("couverture des libellés : 228 fr/en, 230 ja", () => {
		const vals = Object.values(IEVR_ACHIEVEMENTS);
		expect(vals.filter((v) => v.nameFr).length).toBe(228);
		expect(vals.filter((v) => v.nameEn).length).toBe(228);
		expect(vals.filter((v) => v.nameJa).length).toBe(230);
	});

	test("les 2 sans fr/en gardent leur ja (activity_whole_achieve_089/090)", () => {
		const orphans = Object.values(IEVR_ACHIEVEMENTS).filter((v) => !v.nameFr);
		expect(orphans.map((o) => o.trophyId).sort()).toEqual([
			"activity_whole_achieve_089",
			"activity_whole_achieve_090",
		]);
		for (const o of orphans) {
			expect(o.nameJa).toBeTruthy();
		}
	});

	test("entrée témoin ACHIEVEMENT_0001 (premier trophée, story miniquest)", () => {
		const a = IEVR_ACHIEVEMENTS.ACHIEVEMENT_0001;
		expect(a).toBeDefined();
		expect(a?.num).toBe(1);
		expect(a?.trophyId).toBe("activity_story_miniquest_001");
		expect(a?.nameFr).toBe("Vieil homme qui a perdu sa clé");
		expect(a?.nameEn).toBe("Old Man Who Lost His Key");
		expect(a?.nameJa).toBe("鍵をなくしたおじいさん");
	});

	test("référence : 52 succès Steam visibles ≤ 230 internes", () => {
		expect(IEVR_VISIBLE_ACHIEVEMENT_COUNT).toBe(52);
		expect(IEVR_VISIBLE_ACHIEVEMENT_COUNT).toBeLessThanOrEqual(IEVR_TROPHY_COUNT);
	});
});

describe("lookupAchievement", () => {
	test("trouve une entrée par apiName exact", () => {
		expect(lookupAchievement("ACHIEVEMENT_0001")?.num).toBe(1);
	});

	test("tolère un padding différent (même num)", () => {
		expect(lookupAchievement("ACHIEVEMENT_1")?.num).toBe(1);
	});

	test("renvoie null hors manifeste", () => {
		expect(lookupAchievement("ACHIEVEMENT_9999")).toBeNull();
		expect(lookupAchievement("NOPE")).toBeNull();
		expect(lookupAchievement(null)).toBeNull();
	});
});

describe("achievementDisplayName / achievementDisplayDescription (fallbacks)", () => {
	const info = IEVR_ACHIEVEMENTS.ACHIEVEMENT_0001 ?? null;

	test("retourne le libellé dans la langue demandée", () => {
		expect(achievementDisplayName(info, "fr")).toBe("Vieil homme qui a perdu sa clé");
		expect(achievementDisplayName(info, "en")).toBe("Old Man Who Lost His Key");
		expect(achievementDisplayName(info, "ja")).toBe("鍵をなくしたおじいさん");
	});

	test("repli sur en puis ja si la langue manque", () => {
		const orphan = Object.values(IEVR_ACHIEVEMENTS).find((v) => !v.nameFr) ?? null;
		// orphan n'a ni fr ni en → repli sur ja
		expect(achievementDisplayName(orphan, "fr")).toBe(orphan?.nameJa ?? undefined);
	});

	test("repli sur fallback quand info est null", () => {
		expect(achievementDisplayName(null, "fr", "ACHIEVEMENT_0001")).toBe("ACHIEVEMENT_0001");
		expect(achievementDisplayName(null, "fr")).toBeUndefined();
	});

	test("description : undefined si aucune desc et null si info null", () => {
		expect(achievementDisplayDescription(null, "fr")).toBeUndefined();
	});
});
