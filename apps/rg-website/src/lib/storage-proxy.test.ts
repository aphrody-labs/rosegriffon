import { describe, expect, it } from "bun:test";

import { estObjetAbsent, relayerObjet, urlAmontObjet } from "./storage-proxy";

const ORIGINES = { medias: "https://cdn.rosegriffon.fr", supabase: "https://projet.supabase.co" };
// Réponse réelle de cdn.rosegriffon.fr (repli Supabase) pour
// /storage/v1/object/public/assets/campagnes/iergday/affiche-v2.webp, relevée le 2026-11-05.
const NO_SUCH_KEY = '{"statusCode":"404","error":"not_found","message":"Object not found","code":"NoSuchKey"}';

function fauxFetch(reponse: () => Response, vus: string[] = []): typeof fetch {
  return (async (url: string | URL | Request) => {
    vus.push(String(url));
    return reponse();
  }) as typeof fetch;
}

describe("urlAmontObjet", () => {
  it("routes heavy buckets to rg-core and the others to Supabase", () => {
    expect(urlAmontObjet("assets", ["campagnes", "iergday", "affiche-v2.webp"], "", ORIGINES)).toBe(
      "https://cdn.rosegriffon.fr/storage/v1/object/public/assets/campagnes/iergday/affiche-v2.webp",
    );
    expect(urlAmontObjet("menu", ["a b.png"], "?v=2", ORIGINES)).toBe(
      "https://projet.supabase.co/storage/v1/object/public/menu/a%20b.png?v=2",
    );
    expect(urlAmontObjet("menu", ["x.png"], "", { medias: ORIGINES.medias })).toBeNull();
  });
});

describe("estObjetAbsent", () => {
  it("reads Supabase's 400 NoSuchKey as missing, not other 400s", async () => {
    expect(await estObjetAbsent(new Response(NO_SUCH_KEY, { status: 400 }))).toBe(true);
    expect(await estObjetAbsent(new Response("", { status: 404 }))).toBe(true);
    expect(await estObjetAbsent(new Response('{"code":"InvalidRequest"}', { status: 400 }))).toBe(false);
    expect(await estObjetAbsent(new Response("pas du json", { status: 400 }))).toBe(false);
    expect(await estObjetAbsent(new Response("img", { status: 200 }))).toBe(false);
  });
});

describe("relayerObjet", () => {
  const url = "https://rosegriffon.fr/storage/v1/object/public/assets/campagnes/iergday/affiche-v2.webp";

  it("answers 404 for a missing object (was 400 through the rewrite)", async () => {
    const vus: string[] = [];
    const r = await relayerObjet(
      new Request(url),
      "assets",
      ["campagnes", "iergday", "affiche-v2.webp"],
      ORIGINES,
      fauxFetch(() => new Response(NO_SUCH_KEY, { headers: { "content-type": "application/json" }, status: 400 }), vus),
    );
    expect(r.status).toBe(404);
    expect(vus).toEqual(["https://cdn.rosegriffon.fr/storage/v1/object/public/assets/campagnes/iergday/affiche-v2.webp"]);
  });

  it("passes an existing object through with its type, cache and validators", async () => {
    const r = await relayerObjet(
      new Request(url, { headers: { "if-none-match": '"abc"' } }),
      "assets",
      ["x.webp"],
      ORIGINES,
      fauxFetch(
        () =>
          new Response("RIFF", {
            headers: {
              "cache-control": "public, max-age=31536000, immutable",
              "content-type": "image/webp",
              etag: '"abc"',
              "set-cookie": "jamais=1",
            },
            status: 200,
          }),
      ),
    );
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toBe("image/webp");
    expect(r.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
    expect(r.headers.get("etag")).toBe('"abc"');
    expect(r.headers.get("set-cookie")).toBeNull();
    expect(await r.text()).toBe("RIFF");
  });

  it("keeps 304 and sends no body on HEAD", async () => {
    const r304 = await relayerObjet(new Request(url), "assets", ["x.webp"], ORIGINES, fauxFetch(() => new Response(null, { status: 304 })));
    expect(r304.status).toBe(304);
    const head = await relayerObjet(
      new Request(url, { method: "HEAD" }),
      "assets",
      ["x.webp"],
      ORIGINES,
      fauxFetch(() => new Response("RIFF", { headers: { "content-type": "image/webp" }, status: 200 })),
    );
    expect(head.status).toBe(200);
    expect(await head.text()).toBe("");
  });
});
