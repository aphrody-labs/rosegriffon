import { describe, expect, test } from "bun:test";
import { CATALOGUE_TACHES, PLANIFICATIONS } from "@rosegriffon/types/cron";

import { REGISTRE_TACHES } from "./registry";
import { runAchilleaInterclans } from "./tasks/achillea-interclans";

const ENV = { API_ADMIN_TOKEN: "jeton-interne", RG_CORE_PORT: "9100" };

function fetchSimule(reponse: Response, appels: Array<{ url: string; init: RequestInit | undefined }>): typeof fetch {
  return (async (url: string | URL | Request, init?: RequestInit) => {
    appels.push({ url: String(url), init });
    return reponse;
  }) as typeof fetch;
}

describe("achillea:interclans", () => {
  test("au registre et au catalogue, toutes les 15 minutes", () => {
    expect(REGISTRE_TACHES["achillea:interclans"]).toBeDefined();
    expect(CATALOGUE_TACHES.some(t => t.nom === "achillea:interclans")).toBe(true);
    expect((PLANIFICATIONS as Record<string, string>)["achillea:interclans"]).toBe("*/15 * * * *");
  });

  test("appelle la route interne avec le jeton et rend le bilan", async () => {
    const appels: Array<{ url: string; init: RequestInit | undefined }> = [];
    const maintenant = new Date("2026-10-22T12:00:00Z");
    const resultat = await runAchilleaInterclans(
      maintenant,
      ENV,
      fetchSimule(Response.json({ success: true, defisExpires: 2, votesExpires: 1 }), appels),
    );
    expect(resultat).toEqual({ success: true, defisExpires: 2, votesExpires: 1 });
    expect(appels[0]?.url).toBe("http://127.0.0.1:9100/api/interclans/internal/maintenance");
    expect(appels[0]?.init?.method).toBe("POST");
    expect((appels[0]?.init?.headers as Record<string, string>).Authorization).toBe("Bearer jeton-interne");
    expect(JSON.parse(String(appels[0]?.init?.body))).toEqual({ now: "2026-10-22T12:00:00.000Z" });
  });

  test("ACHILLEA_API_INTERNAL_URL l'emporte sur le port de rg-core", async () => {
    const appels: Array<{ url: string; init: RequestInit | undefined }> = [];
    await runAchilleaInterclans(
      new Date(),
      { ...ENV, ACHILLEA_API_INTERNAL_URL: "https://ranked.example/api/" },
      fetchSimule(Response.json({ defisExpires: 0, votesExpires: 0 }), appels),
    );
    expect(appels[0]?.url).toBe("https://ranked.example/api/interclans/internal/maintenance");
  });

  test("refus de l'API : l'échec remonte avec son motif", async () => {
    const promesse = runAchilleaInterclans(
      new Date(),
      ENV,
      fetchSimule(Response.json({ message: "Internal authentication required" }, { status: 401 }), []),
    );
    await expect(promesse).rejects.toThrow("Internal authentication required");
  });

  test("sans API_ADMIN_TOKEN : aucune requête, erreur explicite", async () => {
    const appels: Array<{ url: string; init: RequestInit | undefined }> = [];
    await expect(runAchilleaInterclans(new Date(), {}, fetchSimule(Response.json({}), appels))).rejects.toThrow(/API_ADMIN_TOKEN/);
    expect(appels).toHaveLength(0);
  });
});
