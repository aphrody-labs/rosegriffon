import { describe, expect, test } from "bun:test";

import { lots, resynchroniser, urlAvatar, type DependancesResync } from "./resync-avatars";

describe("resync-avatars", () => {
  test("URL d'avatar : animé en gif, statique en png, défaut sinon", () => {
    expect(urlAvatar({ id: "1", username: "a", avatar: "a_abc" })).toBe("https://cdn.discordapp.com/avatars/1/a_abc.gif?size=256");
    expect(urlAvatar({ id: "1", username: "a", avatar: "abc" })).toBe("https://cdn.discordapp.com/avatars/1/abc.png?size=256");
    expect(urlAvatar({ id: "4194304", username: "a", avatar: null })).toBe("https://cdn.discordapp.com/embed/avatars/1.png");
  });

  test("lots de 10", () => {
    expect(lots([1, 2, 3], 2)).toEqual([[1, 2], [3]]);
  });

  test("met à jour les comptes connus de Discord, ignore les autres, pause entre lots", async () => {
    const ecrits: string[] = [];
    const pauses: number[] = [];
    const ids = Array.from({ length: 12 }, (_, i) => String(1000 + i));
    const dep: DependancesResync = {
      identifiants: async () => ids,
      lireDiscord: async id =>
        id === "1003" ? { ok: false, statut: 404, motif: "Unknown User" } : { ok: true, data: { id, username: `u${id}`, global_name: `N${id}`, avatar: null } },
      ecrire: async (id, champs) => void ecrits.push(`${id}:${champs.displayName}`),
      pause: async ms => void pauses.push(ms),
    };
    expect(await resynchroniser(dep)).toEqual({ misAJour: 11, ignores: 1 });
    expect(ecrits).toContain("1000:N1000");
    expect(pauses).toEqual([1500]);
  });
});
