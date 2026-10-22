// SPDX-License-Identifier: Apache-2.0
// Lectures réseau du Feed : statut HTTP lisible (429 → limitation de débit), relecture du flux
// YouTube sur ses 404/500 passagers, chaîne d'Achilléa listée. `fetch` est remplacé : aucun réseau.
import { afterEach, describe, expect, spyOn, test } from "bun:test";

import { COMPTES_SOURCE_TIKTOK, COMPTES_SOURCE_YOUTUBE, lienCompte } from "./feed-comptes";
import { delaiRetryAfter, ErreurHttp, estLimiteDebit, lireTiktok, lireYoutube } from "./feed-lecture";

const FLUX = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns:media="http://search.yahoo.com/mrss/" xmlns="http://www.w3.org/2005/Atom">
 <title>Achilléa</title>
 <entry>
  <id>yt:video:abcdefghijk</id>
  <yt:videoId>abcdefghijk</yt:videoId>
  <title>Coupe d'Ilion</title>
  <link rel="alternate" href="https://www.youtube.com/watch?v=abcdefghijk"/>
  <published>2026-10-20T18:00:00+00:00</published>
  <media:group><media:thumbnail url="https://i1.ytimg.com/vi/abcdefghijk/hqdefault.jpg" width="480" height="360"/></media:group>
 </entry>
</feed>`;

const achillea = COMPTES_SOURCE_YOUTUBE.find(c => c.nom === "Achilléa")!;

/** Remplace `fetch` par une suite de réponses ; rend les URL demandées. */
function fetchFactice(reponses: Array<() => Response>) {
  const urls: string[] = [];
  let i = 0;
  const espion = spyOn(globalThis, "fetch").mockImplementation((async (entree: string | URL | Request) => {
    urls.push(String(entree instanceof Request ? entree.url : entree));
    const fabrique = reponses[Math.min(i++, reponses.length - 1)]!;
    return fabrique();
  }) as unknown as typeof fetch);
  return { urls, espion };
}

afterEach(() => {
  (globalThis.fetch as unknown as { mockRestore?: () => void }).mockRestore?.();
});

describe("YouTube : chaîne d'Achilléa", () => {
  test("la chaîne @AchilleaRG est listée par son identifiant (l'ancien @Achillea_IE répond 404)", () => {
    expect(achillea).toBeDefined();
    expect(achillea.pseudo).toBe("UCh2FiAYaOfuvwTaBVs7CpFw");
    expect(achillea.groupe).toBe("Rose Griffon");
    expect(lienCompte(achillea)).toBe("https://www.youtube.com/channel/UCh2FiAYaOfuvwTaBVs7CpFw");
    expect(new Set(COMPTES_SOURCE_YOUTUBE.map(c => c.pseudo)).size).toBe(COMPTES_SOURCE_YOUTUBE.length);
  });
});

describe("YouTube : flux Atom intermittent", () => {
  test("404 puis 500 puis 200 : relu jusqu'au succès quand des essais sont accordés", async () => {
    const { urls } = fetchFactice([
      () => new Response("", { status: 404 }),
      () => new Response("", { status: 500 }),
      () => new Response(FLUX, { status: 200 }),
    ]);
    const lu = await lireYoutube(achillea, { essais: 3, pauseMs: 1 });
    expect(lu.posts.map(p => p.id)).toEqual(["youtube:abcdefghijk"]);
    expect(lu.posts[0]!.compte).toBe("UCh2FiAYaOfuvwTaBVs7CpFw");
    expect(urls).toHaveLength(3);
    expect(urls[0]).toBe("https://www.youtube.com/feeds/videos.xml?channel_id=UCh2FiAYaOfuvwTaBVs7CpFw");
  });

  test("sans essais accordés (site), une seule lecture ; l'erreur porte le statut", async () => {
    const { urls } = fetchFactice([() => new Response("", { status: 404 })]);
    const erreur = await lireYoutube(achillea).catch(e => e);
    expect(erreur).toBeInstanceOf(ErreurHttp);
    expect((erreur as ErreurHttp).statut).toBe(404);
    expect(urls).toHaveLength(1);
  });

  test("un 400 n'est pas passager : pas de relecture", async () => {
    const { urls } = fetchFactice([() => new Response("", { status: 400 })]);
    await expect(lireYoutube(achillea, { essais: 3, pauseMs: 1 })).rejects.toThrow("HTTP 400");
    expect(urls).toHaveLength(1);
  });
});

describe("TikTok : limitation de débit", () => {
  test("429 sur l'embed : ErreurHttp reconnue comme limitation, Retry-After lu, profil non demandé", async () => {
    const { urls } = fetchFactice([() => new Response("", { status: 429, headers: { "Retry-After": "120" } })]);
    const erreur = await lireTiktok(COMPTES_SOURCE_TIKTOK[0]!).catch(e => e);
    expect(estLimiteDebit(erreur)).toBe(true);
    expect((erreur as ErreurHttp).reessayerApresMs).toBe(120_000);
    expect((erreur as Error).message).toBe("HTTP 429 : https://www.tiktok.com/embed/@rose_griffon");
    expect(urls).toEqual(["https://www.tiktok.com/embed/@rose_griffon"]);
  });

  test("une autre erreur n'est pas une limitation", () => {
    expect(estLimiteDebit(new ErreurHttp(500, "https://x.test"))).toBe(false);
    expect(estLimiteDebit(new Error("HTTP 429"))).toBe(false);
  });

  test("Retry-After : secondes, date HTTP, valeur illisible", () => {
    const maintenant = Date.parse("2026-10-22T12:00:00Z");
    expect(delaiRetryAfter("30", maintenant)).toBe(30_000);
    expect(delaiRetryAfter("Thu, 22 Oct 2026 12:05:00 GMT", maintenant)).toBe(300_000);
    expect(delaiRetryAfter("bientôt", maintenant)).toBeUndefined();
    expect(delaiRetryAfter(null, maintenant)).toBeUndefined();
  });
});
