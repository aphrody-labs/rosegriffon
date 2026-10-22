import { describe, expect, test } from "bun:test";
import { CATALOGUE_TACHES, PLANIFICATIONS } from "@rosegriffon/types/cron";

import { REGISTRE_TACHES } from "./registry";
import { runAchilleaVotes } from "./tasks/achillea-votes";

const ENV = { API_ADMIN_TOKEN: "jeton-interne", RG_CORE_PORT: "9100" };

function fetchSimule(reponse: Response, appels: Array<{ url: string; init: RequestInit | undefined }>): typeof fetch {
  return (async (url: string | URL | Request, init?: RequestInit) => {
    appels.push({ url: String(url), init });
    return reponse;
  }) as typeof fetch;
}

describe("achillea:votes", () => {
  test("au registre et au catalogue, toutes les 10 minutes", () => {
    expect(REGISTRE_TACHES["achillea:votes"]).toBeDefined();
    expect(CATALOGUE_TACHES.some(t => t.nom === "achillea:votes")).toBe(true);
    expect((PLANIFICATIONS as Record<string, string>)["achillea:votes"]).toBe("*/10 * * * *");
  });

  test("appelle la route interne avec le jeton et rend le nombre de votes clos", async () => {
    const appels: Array<{ url: string; init: RequestInit | undefined }> = [];
    const maintenant = new Date("2026-10-22T12:00:00Z");
    const resultat = await runAchilleaVotes(maintenant, ENV, fetchSimule(Response.json({ success: true, closes: 3 }), appels));
    expect(resultat).toEqual({ success: true, closes: 3 });
    expect(appels[0]?.url).toBe("http://127.0.0.1:9100/api/clans/internal/votes/expire");
    expect(appels[0]?.init?.method).toBe("POST");
    expect((appels[0]?.init?.headers as Record<string, string>).Authorization).toBe("Bearer jeton-interne");
    expect(JSON.parse(String(appels[0]?.init?.body))).toEqual({ now: "2026-10-22T12:00:00.000Z" });
  });

  test("refus de l'API : l'échec remonte avec son motif", async () => {
    const promesse = runAchilleaVotes(
      new Date(),
      ENV,
      fetchSimule(Response.json({ message: "Internal authentication required" }, { status: 401 }), []),
    );
    await expect(promesse).rejects.toThrow("Internal authentication required");
  });

  test("sans API_ADMIN_TOKEN : aucune requête, erreur explicite", async () => {
    const appels: Array<{ url: string; init: RequestInit | undefined }> = [];
    await expect(runAchilleaVotes(new Date(), {}, fetchSimule(Response.json({}), appels))).rejects.toThrow(/API_ADMIN_TOKEN/);
    expect(appels).toHaveLength(0);
  });
});
