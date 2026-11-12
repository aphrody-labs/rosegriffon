// SPDX-License-Identifier: Apache-2.0
import { describe, expect, test } from "bun:test";
import { PostgresQueryBuilder } from "./postgres-client";

type ExecutedQuery = { sql: string; parameters: readonly unknown[] };

function createMockExecutor(mockRows: unknown[] = []): {
  executor: { executeQuery: (q: ExecutedQuery) => Promise<{ rows: unknown[] }> };
  queries: ExecutedQuery[];
} {
  const queries: ExecutedQuery[] = [];
  return {
    queries,
    executor: {
      async executeQuery(query: ExecutedQuery) {
        queries.push(query);
        return { rows: mockRows };
      },
    },
  };
}

describe("PostgresQueryBuilder - Sécurité et SQL Injection Resistance", () => {
  test("bloque les injections SQL sur les noms de colonnes", () => {
    const { executor } = createMockExecutor();
    const qb = new PostgresQueryBuilder(executor, "users");
    expect(() => qb.eq("id; DROP TABLE users; --", "admin")).toThrow(/Invalid SQL identifier/);
    expect(() => qb.order("id UNION SELECT * FROM passwords")).toThrow(/Invalid SQL identifier/);
    expect(() => qb.or("role; DROP TABLE accounts; --.eq.admin")).toThrow(/Invalid SQL identifier/);
  });

  test("bloque les projections non autorisées", () => {
    const { executor } = createMockExecutor();
    const qb = new PostgresQueryBuilder(executor, "users");
    expect(() => qb.select("id; DELETE FROM users;")).toThrow(/Invalid SQL projection/);
    expect(() => qb.select("id, password_hash/* injected */")).toThrow(/Invalid SQL projection/);
  });

  test("autorise les projections légitimes et expressions d'agrégation", async () => {
    const { executor, queries } = createMockExecutor([{ total: 42 }]);
    const qb = new PostgresQueryBuilder(executor, "users");
    await qb.select("id, count(id)::int as total, created_at").eq("active", true);
    expect(queries).toHaveLength(1);
    expect(queries[0]!.sql).toContain('SELECT id, count(id)::int as total, created_at FROM "users" WHERE "active" = $1');
  });

  test("supporte l'extraction JSON path sécurisée column->>field", async () => {
    const { executor, queries } = createMockExecutor([{ id: "u1" }]);
    const qb = new PostgresQueryBuilder(executor, "profiles");
    await qb.select("id").eq("metadata->>discord_id", "123456789");
    expect(queries).toHaveLength(1);
    expect(queries[0]!.sql).toContain('"metadata"->>\'discord_id\' = $1');
    expect(queries[0]!.parameters).toEqual(["123456789"]);
  });
});

describe("PostgresQueryBuilder - Opérateurs et Syntaxe SQL", () => {
  test("opérateurs de comparaison numérique et lexicographique (gt, gte, lt, lte, neq)", async () => {
    const { executor, queries } = createMockExecutor();
    const qb = new PostgresQueryBuilder(executor, "tournaments");
    await qb
      .select("id")
      .gt("min_elo", 1000)
      .gte("max_elo", 2000)
      .lt("registered_count", 32)
      .lte("cost", 50)
      .neq("status", "cancelled");

    expect(queries).toHaveLength(1);
    const sql = queries[0]!.sql;
    expect(sql).toContain('"min_elo" > $1');
    expect(sql).toContain('"max_elo" >= $2');
    expect(sql).toContain('"registered_count" < $3');
    expect(sql).toContain('"cost" <= $4');
    expect(sql).toContain('"status" != $5');
    expect(queries[0]!.parameters).toEqual([1000, 2000, 32, 50, "cancelled"]);
  });

  test("gestion des valeurs NULL et booléennes strictes", async () => {
    const { executor, queries } = createMockExecutor();
    const qb = new PostgresQueryBuilder(executor, "matches");
    await qb
      .select("*")
      .is("deleted_at", "null", null)
      .is("verified", "true", true)
      .is("disputed", "false", false)
      .not("winner_id", "is", null);

    expect(queries).toHaveLength(1);
    const sql = queries[0]!.sql;
    expect(sql).toContain('"deleted_at" IS NULL');
    expect(sql).toContain('"verified" IS TRUE');
    expect(sql).toContain('"disputed" IS FALSE');
    expect(sql).toContain('"winner_id" IS NOT NULL');
  });

  test("opérateur IN avec liste non-vide et liste vide (short-circuit FALSE)", async () => {
    const { executor: ex1, queries: q1 } = createMockExecutor();
    await new PostgresQueryBuilder(ex1, "players").select("id").in("id", ["p1", "p2", "p3"]);
    expect(q1[0]!.sql).toContain('"id" IN ($1, $2, $3)');
    expect(q1[0]!.parameters).toEqual(["p1", "p2", "p3"]);

    const { executor: ex2, queries: q2 } = createMockExecutor();
    await new PostgresQueryBuilder(ex2, "players").select("id").in("id", []);
    expect(q2[0]!.sql).toContain("WHERE FALSE");
    expect(q2[0]!.parameters).toHaveLength(0);
  });

  test("recherche textuelle avec config tsquery sécurisée", async () => {
    const { executor, queries } = createMockExecutor();
    await new PostgresQueryBuilder(executor, "articles").select("title").textSearch("content", "inazuma & victory", {
      config: "french",
    });
    expect(queries[0]!.sql).toContain('"content" @@ to_tsquery($1, $2)');
    expect(queries[0]!.parameters).toEqual(["french", "inazuma & victory"]);

    expect(() =>
      new PostgresQueryBuilder(executor, "articles").textSearch("content", "q", { config: "french; DROP TABLE;" }),
    ).toThrow(/Invalid text search config/);
  });

  test("expressions OR composées avec validation PostgREST", async () => {
    const { executor, queries } = createMockExecutor();
    await new PostgresQueryBuilder(executor, "clan_members")
      .select("*")
      .or("role.eq.admin,role.eq.owner,status.is.null,custom_title.not.is.null");

    expect(queries[0]!.sql).toContain(
      '("role" = $1 OR "role" = $2 OR "status" IS NULL OR "custom_title" IS NOT NULL)',
    );
    expect(queries[0]!.parameters).toEqual(["admin", "owner"]);
  });
});

describe("PostgresQueryBuilder - Mutations, Upserts et Résolution", () => {
  test("génération correcte de l'instruction INSERT avec RETURNING *", async () => {
    const { executor, queries } = createMockExecutor([{ id: "u_new", name: "Endou" }]);
    const res = await new PostgresQueryBuilder(executor, "users").insert({
      id: "u_new",
      name: "Endou",
      active: true,
    });

    expect(res.data).toEqual([{ id: "u_new", name: "Endou" }]);
    expect(queries[0]!.sql).toBe(
      'INSERT INTO "users" ("id", "name", "active") VALUES ($1, $2, $3) RETURNING *',
    );
    expect(queries[0]!.parameters).toEqual(["u_new", "Endou", true]);
  });

  test("génération correcte de l'instruction UPDATE avec WHERE et RETURNING *", async () => {
    const { executor, queries } = createMockExecutor([{ id: "u1", score: 95 }]);
    const res = await new PostgresQueryBuilder(executor, "scores")
      .update({ score: 95, updated_at: "2026-11-11" })
      .eq("user_id", "u1");

    expect(res.data).toEqual([{ id: "u1", score: 95 }]);
    expect(queries[0]!.sql).toBe(
      'UPDATE "scores" SET "score" = $1, "updated_at" = $2 WHERE "user_id" = $3 RETURNING *',
    );
    expect(queries[0]!.parameters).toEqual([95, "2026-11-11", "u1"]);
  });

  test("génération correcte de l'instruction DELETE avec WHERE", async () => {
    const { executor, queries } = createMockExecutor([{ id: "session_old" }]);
    const res = await new PostgresQueryBuilder(executor, "sessions").delete().eq("id", "session_old");

    expect(res.data).toEqual([{ id: "session_old" }]);
    expect(queries[0]!.sql).toBe('DELETE FROM "sessions" WHERE "id" = $1 RETURNING *');
    expect(queries[0]!.parameters).toEqual(["session_old"]);
  });

  test("génération correcte de l'instruction UPSERT (ON CONFLICT DO UPDATE)", async () => {
    const { executor, queries } = createMockExecutor([{ id: "stat_1", wins: 10 }]);
    await new PostgresQueryBuilder(executor, "stats").upsert(
      { id: "stat_1", player_id: "p1", wins: 10 },
      { onConflict: "id" },
    );

    expect(queries[0]!.sql).toBe(
      'INSERT INTO "stats" ("id", "player_id", "wins") VALUES ($1, $2, $3) ON CONFLICT ("id") DO UPDATE SET "player_id" = EXCLUDED."player_id", "wins" = EXCLUDED."wins" RETURNING *',
    );
    expect(queries[0]!.parameters).toEqual(["stat_1", "p1", 10]);
  });

  test("mode single retourne le premier élément ou lève une erreur si vide", async () => {
    const { executor: ex1 } = createMockExecutor([{ id: "one" }]);
    const res1 = await new PostgresQueryBuilder(ex1, "users").select("*").eq("id", "one").single();
    expect(res1.data).toEqual({ id: "one" });
    expect(res1.error).toBeNull();

    const { executor: ex2 } = createMockExecutor([]);
    const res2 = await new PostgresQueryBuilder(ex2, "users").select("*").eq("id", "none").single();
    expect(res2.data).toBeNull();
    expect(res2.error?.message).toContain("Expected exactly one row");
  });

  test("mode maybeSingle retourne null sans lever d'erreur si aucun enregistrement", async () => {
    const { executor } = createMockExecutor([]);
    const res = await new PostgresQueryBuilder(executor, "users").select("*").eq("id", "missing").maybeSingle();
    expect(res.data).toBeNull();
    expect(res.error).toBeNull();
  });
});
