// SPDX-License-Identifier: Apache-2.0
import { describe, expect, test } from "bun:test";
import { app } from "../src/api/server";

describe("Rose Griffon Unified API Infrastructure Suite (Elysia + Bun)", () => {
  test("GET /health renvoie le statut opérationnel et les métriques système", async () => {
    const res = await app.handle(new Request("http://localhost/health"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; service: string; uptime: number; timestamp: number };
    expect(body.status).toBe("ok");
    expect(body.service).toBe("rg-api");
    expect(typeof body.uptime).toBe("number");
    expect(typeof body.timestamp).toBe("number");
  });

  test("CORS - Réflexion stricte des origines de confiance first-party", async () => {
    // 1. Origine légitime
    const reqLegit = new Request("http://localhost/health", {
      headers: { Origin: "https://rosegriffon.fr" },
    });
    const resLegit = await app.handle(reqLegit);
    expect(resLegit.headers.get("access-control-allow-origin")).toBe("https://rosegriffon.fr");
    expect(resLegit.headers.get("access-control-allow-credentials")).toBe("true");

    // 2. Origine hostile / inconnue
    const reqEvil = new Request("http://localhost/health", {
      headers: { Origin: "https://evil-phishing-site.com" },
    });
    const resEvil = await app.handle(reqEvil);
    expect(resEvil.headers.get("access-control-allow-origin")).toBeNull();
  });

  test("CORS - Requête preflight OPTIONS pour négociation HTTP", async () => {
    const preflight = new Request("http://localhost/v1/community/info", {
      method: "OPTIONS",
      headers: {
        Origin: "https://rosegriffon.fr",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "Content-Type, Authorization",
      },
    });
    const res = await app.handle(preflight);
    expect([200, 204]).toContain(res.status);
    expect(res.headers.get("access-control-allow-origin")).toBe("https://rosegriffon.fr");
    const allowedMethods = res.headers.get("access-control-allow-methods") ?? "";
    expect(allowedMethods).toContain("POST");
  });

  test("Documentation Swagger/OpenAPI exposée sur /docs", async () => {
    const res = await app.handle(new Request("http://localhost/docs"));
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text.length).toBeGreaterThan(0);
  });

  test("Gestion uniforme des routes inexistantes (404 Not Found)", async () => {
    const res = await app.handle(new Request("http://localhost/v1/unknown-endpoint-404"));
    expect(res.status).toBe(404);
  });

  test("Protection de la route /v1/auth/me contre les accès anonymes", async () => {
    const res = await app.handle(new Request("http://localhost/v1/auth/me"));
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBeDefined();
  });

  test("Protection de la route /v1/billing/webhooks/stripe sans signature", async () => {
    const res = await app.handle(
      new Request("http://localhost/v1/billing/webhooks/stripe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "payment_intent.succeeded" }),
      }),
    );
    expect(res.status).toBe(400);
  });
});
