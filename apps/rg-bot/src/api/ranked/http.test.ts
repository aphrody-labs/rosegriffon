/**
 * Routeur REST du ranked : sémantique Express conservée (chemins, corps, erreurs).
 */
import { describe, expect, test } from "bun:test";

import { PASSER, RouteurRanked } from "./http";

function routeur() {
  const erreurs: unknown[] = [];
  const app = new RouteurRanked({
    preparer: (_req, res) => {
      res.setHeader("Access-Control-Allow-Origin", "*");
    },
    surErreur: (e) => erreurs.push(e),
  });
  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });
  app.get("/api/ranked/challenge/:code", (req, res) => {
    res.json({ code: req.params.code, q: req.query.x ?? null });
  });
  app.post("/api/ranked/challenge", (req, res) => {
    res.json({ body: req.body ?? null });
  });
  app.post(
    "/api/ranked/:lobbyId/dispute",
    { texte: { limite: 16 } },
    (req, res) => {
      res.json({ lobbyId: req.params.lobbyId, body: req.body ?? null });
    },
  );
  app.get("/storage/:fichier", () => PASSER);
  app.post("/api/boom", () => {
    throw new Error("boom");
  });
  app.use("/api", (req, res) => {
    res.status(202).json({ relais: req.originalUrl, method: req.method });
  });
  return { app, erreurs };
}

const u = (chemin: string) => `http://ranked.test${chemin}`;

describe("routage", () => {
  test("casse, barre finale, paramètre décodé, requête", async () => {
    const { app } = routeur();
    const r = await app.servir(
      new Request(u("/API/Ranked/Challenge/ab%20c/?x=1")),
    );
    expect(r?.status).toBe(200);
    expect(await r?.json()).toEqual({ code: "ab c", q: "1" });
    expect(r?.headers.get("content-type")).toBe(
      "application/json; charset=utf-8",
    );
    expect(r?.headers.get("access-control-allow-origin")).toBe("*");
  });

  test("HEAD servi par la route GET, sans corps", async () => {
    const { app } = routeur();
    const r = await app.servir(
      new Request(u("/api/health"), { method: "HEAD" }),
    );
    expect(r?.status).toBe(200);
    expect(await r?.text()).toBe("");
  });

  test("hors routes : laissé à Colyseus ; PASSER continue vers les suivantes", async () => {
    const { app } = routeur();
    expect(
      await app.servir(
        new Request(u("/matchmake/joinOrCreate/queue"), { method: "POST" }),
      ),
    ).toBeUndefined();
    expect(await app.servir(new Request(u("/storage/a.png")))).toBeUndefined();
  });

  test("préfixe /api : toute méthode, après les routes spécifiques", async () => {
    const { app } = routeur();
    const r = await app.servir(
      new Request(u("/api/clans/1?p=2"), { method: "DELETE" }),
    );
    expect(r?.status).toBe(202);
    expect(await r?.json()).toEqual({
      relais: "/api/clans/1?p=2",
      method: "DELETE",
    });
    const racine = await app.servir(new Request(u("/api")));
    expect(racine?.status).toBe(202);
  });
});

describe("corps", () => {
  const post = (chemin: string, body: string, type: string) =>
    new Request(u(chemin), {
      method: "POST",
      headers: { "content-type": type },
      body,
    });

  test("JSON analysé ; corps vide → {} ; autre type → undefined", async () => {
    const { app } = routeur();
    expect(
      await (
        await app.servir(
          post(
            "/api/ranked/challenge",
            '{"mode":2}',
            "application/json; charset=utf-8",
          ),
        )
      )?.json(),
    ).toEqual({
      body: { mode: 2 },
    });
    expect(
      await (
        await app.servir(post("/api/ranked/challenge", "", "application/json"))
      )?.json(),
    ).toEqual({ body: {} });
    expect(
      await (
        await app.servir(
          post(
            "/api/ranked/challenge",
            "a=1",
            "application/x-www-form-urlencoded",
          ),
        )
      )?.json(),
    ).toEqual({
      body: null,
    });
  });

  test("JSON invalide ou scalaire → 400 bad_request ; > 100 ko → 413 too_large", async () => {
    const { app, erreurs } = routeur();
    const invalide = await app.servir(
      post("/api/ranked/challenge", "{", "application/json"),
    );
    expect(invalide?.status).toBe(400);
    expect(await invalide?.json()).toEqual({ error: "bad_request" });
    expect(
      (
        await app.servir(
          post("/api/ranked/challenge", '"x"', "application/json"),
        )
      )?.status,
    ).toBe(400);
    const gros = await app.servir(
      post(
        "/api/ranked/challenge",
        `{"a":"${"x".repeat(101 * 1024)}"}`,
        "application/json",
      ),
    );
    expect(gros?.status).toBe(413);
    expect(await gros?.json()).toEqual({ error: "too_large" });
    expect(erreurs).toHaveLength(3);
  });

  test("route texte : tout type lu en texte, plafonné", async () => {
    const { app } = routeur();
    const ok = await app.servir(
      post("/api/ranked/7/dispute", "aGk=", "text/plain"),
    );
    expect(await ok?.json()).toEqual({ lobbyId: "7", body: "aGk=" });
    const binaire = await app.servir(
      post("/api/ranked/7/dispute", "aGk=", "application/octet-stream"),
    );
    expect(await binaire?.json()).toEqual({ lobbyId: "7", body: "aGk=" });
    const trop = await app.servir(
      post("/api/ranked/7/dispute", "x".repeat(17), "text/plain"),
    );
    expect(trop?.status).toBe(413);
  });

  test("exception d'une route → 500 bad_request", async () => {
    const { app } = routeur();
    const r = await app.servir(new Request(u("/api/boom"), { method: "POST" }));
    expect(r?.status).toBe(500);
    expect(await r?.json()).toEqual({ error: "bad_request" });
  });
});
