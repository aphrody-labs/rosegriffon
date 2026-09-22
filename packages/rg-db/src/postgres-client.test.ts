import { describe, expect, test } from "bun:test";
import { PostgresQueryBuilder } from "./postgres-client";

function capture() {
	const queries: Array<{ sql: string; parameters: readonly unknown[] }> = [];
	return {
		queries,
		executor: { executeQuery: async (query: { sql: string; parameters: readonly unknown[] }) => { queries.push(query); return { rows: [{ id: "1" }] }; } },
	};
}

describe("PostgresQueryBuilder", () => {
	test("keeps UPDATE placeholders aligned with parameters", async () => {
		const { executor, queries } = capture();
		const result = await new PostgresQueryBuilder(executor, "profiles")
			.update({ role: "admin", updated_at: "now" })
			.eq("id", "user-1")
			.eq("role", "staff");

		expect(result.error).toBeNull();
		expect(queries[0]?.sql).toContain('SET "role" = $1, "updated_at" = $2');
		expect(queries[0]?.sql).toContain('WHERE "id" = $3 AND "role" = $4');
		expect(queries[0]?.parameters).toEqual(["admin", "now", "user-1", "staff"]);
	});

	test("parameterizes upserts and excludes the conflict key", async () => {
		const { executor, queries } = capture();
		await new PostgresQueryBuilder(executor, "tweets").upsert(
			{ id: "tweet-1", text: "a; DROP TABLE tweets;" },
			{ onConflict: "id" },
		);

		expect(queries[0]?.sql).not.toContain("DROP TABLE");
		expect(queries[0]?.parameters).toEqual(["tweet-1", "a; DROP TABLE tweets;"]);
		expect(queries[0]?.sql).toContain('ON CONFLICT ("id") DO UPDATE SET "text" = EXCLUDED."text"');
	});
});
