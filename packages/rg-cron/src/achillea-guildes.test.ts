/** Aides pures de la tâche `achillea:guildes` (aucun appel réseau, aucune base). */
import { describe, expect, test } from "bun:test";

import { jetonAchillea, runAchilleaGuildes, urlCdn } from "./tasks/achillea-guildes";

describe("tâche achillea:guildes", () => {
  test("URL CDN animée ou fixe, null sans hachage", () => {
    expect(urlCdn("icons", "1", "abc")).toBe("https://cdn.discordapp.com/icons/1/abc.webp?size=512");
    expect(urlCdn("banners", "1", "a_abc")).toBe("https://cdn.discordapp.com/banners/1/a_abc.gif?size=512");
    expect(urlCdn("icons", "1", null)).toBeNull();
  });

  test("sans jeton, échoue sans rien toucher", async () => {
    const avant = Bun.env.ACHILLEA_DISCORD_BOT_TOKEN;
    delete Bun.env.ACHILLEA_DISCORD_BOT_TOKEN;
    const resultat = await runAchilleaGuildes();
    if (avant !== undefined) Bun.env.ACHILLEA_DISCORD_BOT_TOKEN = avant;
    expect(resultat.success).toBe(false);
    expect(resultat.error).toContain("ACHILLEA_DISCORD_BOT_TOKEN");
  });

  test("n'utilise que le jeton Achilléa", () => {
    expect(jetonAchillea({ DISCORD_BOT_TOKEN: "rg" })).toBeNull();
    expect(jetonAchillea({ ACHILLEA_DISCORD_BOT_TOKEN: " a " })).toBe("a");
  });
});

describe("tâche achillea:casts", () => {
  test("déclenche la route interne avec le secret partagé", async () => {
    const { runAchilleaCastReminders } = await import("./tasks/achillea-casts");
    const appels: Array<{ url: string; secret: string | null }> = [];
    const original = globalThis.fetch;
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      appels.push({ url, secret: new Headers(init?.headers).get("x-internal-secret") });
      return Response.json({ j2: { envoyes: 1 }, h2: { envoyes: 0 } });
    }) as typeof fetch;
    try {
      const resultat = await runAchilleaCastReminders({ RANKED_INTERNAL_SECRET: "s", RG_CORE_PORT: "9999" });
      expect(resultat).toEqual({ success: true, j2: { envoyes: 1 }, h2: { envoyes: 0 } });
      expect(appels).toEqual([{ url: "http://127.0.0.1:9999/v1/achillea/casts/reminders/dispatch", secret: "s" }]);
    } finally {
      globalThis.fetch = original;
    }
  });

  test("sans secret, ne fait aucun appel", async () => {
    const { runAchilleaCastReminders } = await import("./tasks/achillea-casts");
    const resultat = await runAchilleaCastReminders({});
    expect(resultat.success).toBe(false);
    expect(resultat.error).toContain("RANKED_INTERNAL_SECRET");
  });
});
