import { afterEach, describe, expect, test } from "bun:test";
import type { SQL } from "bun";
import type { Guild, GuildMember } from "discord.js";

import {
  discordSyncSummary,
  listGuildMembers,
  markDiscordGuildLeft,
  siteTelemetrySummary,
  syncSiteTelemetryAggregates,
  useDiscordMirrorSql,
} from "./index";

interface Call {
  text: string;
  values: unknown[];
}

/** In-memory tagged-template stand-in for Bun.SQL: records each statement, answers with canned rows. */
function fakeSql(rows: unknown[] = []): { sql: SQL; calls: Call[] } {
  const calls: Call[] = [];
  const sql = ((strings: TemplateStringsArray, ...values: unknown[]) => {
    calls.push({ text: strings.join("?"), values });
    return Promise.resolve(rows);
  }) as unknown as SQL;
  return { sql, calls };
}

afterEach(() => useDiscordMirrorSql(null));

describe("site telemetry", () => {
  test("an empty batch touches no connection", async () => {
    const { sql, calls } = fakeSql();
    useDiscordMirrorSql(sql);
    expect(await syncSiteTelemetryAggregates([], true)).toBe(0);
    expect(calls).toHaveLength(0);
  });

  test("a batch is one statement with a snake_case JSON payload", async () => {
    const { sql, calls } = fakeSql();
    useDiscordMirrorSql(sql);
    const count = await syncSiteTelemetryAggregates(
      [
        {
          host: "rosegriffon.fr",
          windowStart: "2026-11-05T10:00:00Z",
          requests: 12,
          bytes: 3400,
          errors4xx: 1,
          errors5xx: 0,
        },
      ],
      false,
    );
    expect(count).toBe(1);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.text).toContain("jsonb_to_recordset");
    const payload = JSON.parse(
      calls[0]!.values.find(
        (v) => typeof v === "string" && v.startsWith("["),
      ) as string,
    );
    expect(payload).toEqual([
      {
        host: "rosegriffon.fr",
        window_start: "2026-11-05T10:00:00Z",
        requests: 12,
        bytes: 3400,
        errors_4xx: 1,
        errors_5xx: 0,
      },
    ]);
    expect(calls[0]!.values).toContain(false);
  });

  test("summary coerces bigint-ish columns and normalises the timestamp", async () => {
    const { sql } = fakeSql([
      {
        hours: 3,
        requests: "42",
        complete: false,
        synced_at: "2026-11-05T10:00:00Z",
      },
    ]);
    useDiscordMirrorSql(sql);
    expect(await siteTelemetrySummary(24)).toEqual({
      hours: 3,
      requests: 42,
      complete: false,
      syncedAt: "2026-11-05T10:00:00.000Z",
    });
  });
});

describe("guild mirror", () => {
  test("missing snapshot report is null", async () => {
    const { sql } = fakeSql([]);
    useDiscordMirrorSql(sql);
    expect(await discordSyncSummary("bot", "guild")).toBeNull();
  });

  test("guild departure is scoped to the observing bot", async () => {
    const { sql, calls } = fakeSql();
    useDiscordMirrorSql(sql);
    await markDiscordGuildLeft(
      { sourceBotId: "bot-a", profile: "achillea" },
      "g1",
    );
    expect(calls[0]!.values).toEqual(["bot-a", "g1", "achillea"]);
  });

  test("member listing paginates by last id until a short page", async () => {
    const pages = [1000, 3];
    const afters: (string | undefined)[] = [];
    const guild = {
      members: {
        list: ({ after }: { after?: string }) => {
          afters.push(after);
          const size = pages.shift() ?? 0;
          const offset = afters.length * 10_000;
          const page = new Map<string, GuildMember>(
            Array.from({ length: size }, (_, i) => [
              String(offset + i),
              {} as GuildMember,
            ]),
          );
          return Promise.resolve(
            Object.assign(page, { lastKey: () => [...page.keys()].at(-1) }),
          );
        },
      },
    } as unknown as Guild;
    const members = await listGuildMembers(guild);
    expect(members.size).toBe(1003);
    expect(afters).toEqual([undefined, "10999"]);
  });
});
