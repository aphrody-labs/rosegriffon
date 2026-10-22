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
