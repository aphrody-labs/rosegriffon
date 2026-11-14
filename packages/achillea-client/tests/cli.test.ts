import { describe, expect, test } from "bun:test";

import { describeAchilleaSurface, parseCliValue, runAchilleaCli } from "../src/cli";

describe("Achillea CLI", () => {
  test("exposes all 19 client resources and their methods", () => {
    const surface = describeAchilleaSurface();
    expect(Object.keys(surface)).toHaveLength(19);
    expect(surface.ranked.length).toBeGreaterThan(0);
    expect(surface.tournaments.length).toBeGreaterThan(0);
    expect(surface.clans.length).toBeGreaterThan(0);
    expect(surface.admin.length).toBeGreaterThan(0);
    expect(surface.auth.length).toBeGreaterThan(0);
  });

  test("parses primitive, numeric, and JSON CLI values cleanly", () => {
    expect(parseCliValue("true")).toBe(true);
    expect(parseCliValue("false")).toBe(false);
    expect(parseCliValue("null")).toBeNull();
    expect(parseCliValue("42")).toBe(42);
    expect(parseCliValue('{"page":2}')).toEqual({ page: 2 });
    expect(parseCliValue("dragon")).toBe("dragon");
  });

  test("dispatches resource action against AchilleaClient HTTP transport", async () => {
    const out: string[] = [];
    const err: string[] = [];
    let requestedUrl = "";
    let authHeader: string | null = null;

    const code = await runAchilleaCli(
      ["--url", "http://achillea.test/v1/achillea", "--token", "tok123", "ranked", "leaderboard"],
      {
        stdout: (t) => out.push(t),
        stderr: (t) => err.push(t),
        fetch: async (input, init) => {
          requestedUrl = String(input);
          authHeader = new Headers(init?.headers).get("Authorization");
          return Response.json({
            entries: [],
            total: 0,
            mode: 2,
          });
        },
      },
    );

    expect(err).toEqual([]);
    expect(code).toBe(0);
    expect(authHeader).toBe("Bearer tok123");
    expect(requestedUrl).toContain("http://achillea.test/v1/achillea/ranked/leaderboard");
    expect(JSON.parse(out.join("\n")).ok).toBe(true);
  });

  test("returns exit code 2 for unknown resource or action", async () => {
    const err: string[] = [];
    const code = await runAchilleaCli(["unknown_res", "list"], {
      stdout: () => {},
      stderr: (t) => err.push(t),
    });
    expect(code).toBe(2);
    expect(err[0]).toContain("Unknown Achillea resource");
  });
});
