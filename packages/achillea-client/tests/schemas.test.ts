import { describe, expect, test } from "bun:test";

import {
	achilleaGuildDetailSchema,
	achilleaGuildPageSchema,
	achilleaGuildStatsSchema,
} from "../src/v1";
import { clanDtoSchema } from "../src/v1/clans";

const guild = {
	id: "123456789012345678",
	name: null,
	icon: null,
	banner: null,
	owner_id: null,
	member_count: "42",
	presence_count: null,
	features: null,
	premium_tier: null,
	verification_level: null,
	description: null,
	scanned_at: null,
};

describe("v1 guild schemas", () => {
	test("preserves nullable fields and normalizes serialized counters", () => {
		const parsed = achilleaGuildDetailSchema.parse(guild);

		expect(parsed.name).toBeNull();
		expect(parsed.member_count).toBe(42);
		expect(parsed.presence_count).toBeNull();
		expect(parsed.roles).toEqual([]);
		expect(parsed.channels).toEqual([]);
	});

	test("detects a renamed required field as contract drift", () => {
		const { scanned_at: _scannedAt, ...driftedGuild } = guild;
		const result = achilleaGuildDetailSchema.safeParse({
			...driftedGuild,
			last_scan: null,
		});

		expect(result.success).toBe(false);
		if (result.success) return;
		expect(result.error.issues[0]?.path).toEqual(["scanned_at"]);
	});

	test("requires the documented pagination envelope", () => {
		const valid = achilleaGuildPageSchema.safeParse({
			data: [guild],
			meta: { page: 1, limit: 25, total: 1, pageCount: 1 },
		});
		const drifted = achilleaGuildPageSchema.safeParse({
			guilds: [guild],
			meta: { page: 1, limit: 25, total: 1, pageCount: 1 },
		});

		expect(valid.success).toBe(true);
		expect(drifted.success).toBe(false);
	});

	test("parses the direct stats response without a data envelope", () => {
		const parsed = achilleaGuildStatsSchema.parse({
			total_guilds: 3,
			total_members: "1200",
			last_scan: null,
		});

		expect(parsed).toEqual({
			total_guilds: 3,
			total_members: 1200,
			last_scan: null,
			by_premium_tier: [],
			by_channel_type: [],
		});
	});
});

test("normalizes the compact unified clans projection", () => {
	const parsed = clanDtoSchema.parse({
		id: 61,
		name: "PROJECT ZOO",
		shortName: "ZOO",
		avatarUrl: "https://example.test/zoo.png",
		biography: "POUIK",
		fame: 0,
		isRecruiting: false,
		membersLimit: false,
	});

	expect(parsed.shortenedName).toBe("ZOO");
	expect(parsed.normalizedShortName).toBe("zoo");
	expect(parsed.founders).toEqual([]);
});
