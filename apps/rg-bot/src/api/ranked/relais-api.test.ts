/**
 * Ancien préfixe `/api/*` (port Colyseus de `rg-core`) → API unifiée.
 *
 * Deux voies : le relais `/api` du routeur ranked pour les corps texte ou JSON, et le
 * routage direct de `rg-core` pour les corps binaires, relayés tels quels.
 */
import { describe, expect, test } from "bun:test";

import type { RequeteRanked } from "./http";
import { versApiUnifieeDirecte, versRequeteUnifiee } from "./main";

/** Requête minimale du routeur ranked : les champs lus par le relais. */
function requeteRanked(options: { method: string; url: string; headers?: Record<string, string>; body?: unknown }) {
  return {
    method: options.method,
    originalUrl: options.url,
    headers: options.headers ?? {},
    params: {},
    query: {},
    body: options.body,
  } satisfies RequeteRanked;
}

describe("relais /api (texte et JSON)", () => {
  test("chemin et requête traduits, auth relayée, hôte retiré", () => {
    const r = versRequeteUnifiee(
      requeteRanked({ method: "GET", url: "/api/clans?page=2", headers: { cookie: "token=abc", host: "ranked.rosegriffon.fr" } }),
    );
    expect(new URL(r.url).pathname).toBe("/v1/achillea/clans");
    expect(new URL(r.url).search).toBe("?page=2");
    expect(r.headers.get("cookie")).toBe("token=abc");
    expect(r.headers.get("host")).not.toBe("ranked.rosegriffon.fr");
  });

  test("JSON analysé par le routeur : resérialisé", async () => {
    const r = versRequeteUnifiee(requeteRanked({ method: "POST", url: "/api/clans/create", body: { name: "Zoo" } }));
    expect(await r.json()).toEqual({ name: "Zoo" });
    expect(r.headers.get("content-type")).toBe("application/json");
  });

  test("POST sans corps (objet vide) : relayé sans corps, sans lire de flux", async () => {
    const r = versRequeteUnifiee(requeteRanked({ method: "POST", url: "/api/auth/logout", body: {} }));
    expect(new URL(r.url).pathname).toBe("/v1/auth/logout");
    expect(await r.text()).toBe("");
  });
});

describe("routage direct des corps binaires", () => {
  const frontiere = "----rg";
  const corps = new Uint8Array([
    ...new TextEncoder().encode(
      `--${frontiere}\r\nContent-Disposition: form-data; name="file"; filename="a.png"\r\nContent-Type: image/png\r\n\r\n`,
    ),
    0x89, 0x50, 0x4e, 0x47, 0xff, 0x00, 0xfe,
    ...new TextEncoder().encode(`\r\n--${frontiere}--\r\n`),
  ]);

  test("multipart : vers /v1/achillea, corps intact à l'octet près (non-UTF-8 compris)", async () => {
    const directe = versApiUnifieeDirecte(
      new Request("http://127.0.0.1:8810/api/proxy/upload?x=1", {
        method: "POST",
        headers: { "content-type": `multipart/form-data; boundary=${frontiere}`, cookie: "token=abc" },
        body: corps,
      }),
    );
    expect(directe).not.toBeNull();
    expect(new URL(directe!.url).pathname).toBe("/v1/achillea/proxy/upload");
    expect(new URL(directe!.url).search).toBe("?x=1");
    expect(directe!.headers.get("cookie")).toBe("token=abc");
    expect(new Uint8Array(await directe!.arrayBuffer())).toEqual(corps);
  });

  test("JSON, texte et routes hors /api : laissés au relais /api / à Colyseus", () => {
    const json = new Request("http://x/api/clans/create", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    const texte = new Request("http://x/api/ranked/1/dispute", { method: "POST", headers: { "content-type": "text/plain" }, body: "aGk=" });
    const autre = new Request("http://x/matchmake/joinOrCreate/queue", { method: "POST", headers: { "content-type": "image/png" } });
    expect(versApiUnifieeDirecte(json)).toBeNull();
    expect(versApiUnifieeDirecte(texte)).toBeNull();
    expect(versApiUnifieeDirecte(autre)).toBeNull();
  });
});

describe("POST sans corps pour Colyseus", () => {
  test("reçoit un corps vide lisible ; GET et corps existants inchangés", async () => {
    const { avecCorpsLisible } = await import("./main");
    const vide = avecCorpsLisible(new Request("http://x/api/auth/logout", { method: "POST" }));
    expect(vide.body).not.toBeNull();
    expect(await Bun.readableStreamToText(vide.body!)).toBe("");
    const get = new Request("http://x/api/clans");
    expect(avecCorpsLisible(get)).toBe(get);
    const plein = new Request("http://x/api/clans/create", { method: "POST", body: "{}" });
    expect(avecCorpsLisible(plein)).toBe(plein);
  });
});
