/**
 * Relais `/api/*` (Express, port Colyseus) → API unifiée.
 *
 * Le défaut couvert : un upload `multipart/form-data` (`POST /api/proxy/upload`)
 * n'est pas consommé par `express.json` ; le relais le transmettait SANS corps.
 */
import { describe, expect, test } from "bun:test";
import { Readable } from "node:stream";
import type express from "express";

import { CorpsTropLourd, TAILLE_MAX_CORPS_RELAYE, versRequeteUnifiee } from "./main";

/** Requête Express minimale : flux lisible + champs lus par le relais. */
function requete(options: { method: string; url: string; headers?: Record<string, string>; body?: unknown; flux?: Uint8Array[] }) {
  const flux = Readable.from(options.flux ?? []) as Readable & Record<string, unknown>;
  Object.assign(flux, {
    method: options.method,
    originalUrl: options.url,
    headers: options.headers ?? {},
    body: options.body,
  });
  return flux as unknown as express.Request;
}

describe("relais /api vers l'API unifiée", () => {
  test("chemin et requête traduits, auth relayée", async () => {
    const r = await versRequeteUnifiee(
      requete({ method: "GET", url: "/api/clans?page=2", headers: { cookie: "token=abc", host: "ranked.rosegriffon.fr" } }),
    );
    expect(new URL(r.url).pathname).toBe("/v1/achillea/clans");
    expect(new URL(r.url).search).toBe("?page=2");
    expect(r.headers.get("cookie")).toBe("token=abc");
    expect(r.headers.get("host")).not.toBe("ranked.rosegriffon.fr");
  });

  test("JSON déjà analysé par express.json : resérialisé", async () => {
    const r = await versRequeteUnifiee(requete({ method: "POST", url: "/api/clans/create", body: { name: "Zoo" } }));
    expect(await r.json()).toEqual({ name: "Zoo" });
    expect(r.headers.get("content-type")).toBe("application/json");
  });

  test("multipart non analysé : corps brut relayé à l'octet près", async () => {
    const frontiere = "----rg";
    const corps = new TextEncoder().encode(
      `--${frontiere}\r\nContent-Disposition: form-data; name="file"; filename="a.png"\r\nContent-Type: image/png\r\n\r\n\x89PNG\r\n--${frontiere}--\r\n`,
    );
    const r = await versRequeteUnifiee(
      requete({
        method: "POST",
        url: "/api/proxy/upload",
        headers: { "content-type": `multipart/form-data; boundary=${frontiere}` },
        body: {},
        flux: [corps.slice(0, 20), corps.slice(20)],
      }),
    );
    expect(new Uint8Array(await r.arrayBuffer())).toEqual(corps);
    const formulaire = await new Request("http://x", { method: "POST", headers: r.headers, body: corps }).formData();
    expect((formulaire.get("file") as File).name).toBe("a.png");
  });

  test("corps au-delà du plafond : refusé", async () => {
    const gros = new Uint8Array(TAILLE_MAX_CORPS_RELAYE + 1);
    const erreur = await versRequeteUnifiee(
      requete({ method: "POST", url: "/api/proxy/upload", headers: { "content-type": "application/octet-stream" }, flux: [gros] }),
    ).catch(e => e);
    expect(erreur).toBeInstanceOf(CorpsTropLourd);
  });
});
