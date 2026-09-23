import { describe, expect, test } from "bun:test";

import { isPublicSubscription, publicEvent } from "./events";

describe("public realtime events", () => {
	test("only published tables in the public schema can be subscribed", () => {
		expect(isPublicSubscription("public", "comments")).toBe(true);
		expect(isPublicSubscription("public", "discord_messages")).toBe(true);
		expect(isPublicSubscription("private", "comments")).toBe(false);
		expect(isPublicSubscription("public", "access_tokens")).toBe(false);
	});

	test("never broadcasts settings values", () => {
		const event = {
			schema: "public",
			table: "settings",
			eventType: "UPDATE" as const,
			new: { key: "service.secret", value: "sensitive" },
			old: { key: "service.secret", value: "previous" },
		};
		expect(publicEvent(event)).toEqual({
			schema: "public",
			table: "settings",
			eventType: "UPDATE",
			truncated: true,
		});
	});

	test("passes public content events through and blocks unknown tables", () => {
		const comment = { schema: "public", table: "comments", eventType: "INSERT" as const, new: { id: 1 } };
		expect(publicEvent(comment)).toBe(comment);
		expect(publicEvent({ ...comment, table: "access_tokens" })).toBeNull();
	});
});
