import { describe, expect, it } from "bun:test";
import { app } from "../src/api/server";

describe("unified Achillea guild routes", () => {
  it("rejects invalid pagination before querying the database", async () => {
    for (const query of ["page=0", "limit=0", "limit=101"]) {
      const response = await app.handle(new Request(`http://localhost/v1/achillea/guilds?${query}`));
      expect(response.status).toBe(422);
    }
  });

  it("rejects non-Discord guild IDs before querying the database", async () => {
    const response = await app.handle(new Request("http://localhost/v1/achillea/guilds/not-a-snowflake"));
    expect(response.status).toBe(422);
  });
});

describe("serveurs quittés par le bot", () => {
  // `achillea:guildes` passe à `deleted = true` les serveurs que le bot a quittés, sans
  // effacer leur dernier état. Les listes et statistiques publiques ne doivent pas les
  // compter : `/guilds/stats` annonçait 66 serveurs alors que le bot n'en avait que 56.
  it("chaque lecture de liste ou de statistiques exclut `deleted`", async () => {
    const source = await Bun.file(new URL("../src/api/modules/achillea/guilds/index.ts", import.meta.url)).text();
    const lectures = source.match(/FROM "guild(?:_channel)?" WHERE [^`]*/g) ?? [];
    const listes = lectures.filter(lecture => !lecture.includes("id = ${id}") && !lecture.includes("guild_id = ${id}"));
    expect(listes.length).toBeGreaterThanOrEqual(5);
    for (const lecture of listes) expect(lecture).toContain("NOT deleted");
  });
});
