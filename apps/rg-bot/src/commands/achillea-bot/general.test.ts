import { afterEach, describe, expect, test } from "bun:test";

import { fausseInteraction, installerApi } from "../../../test/achillea-kit";
import { CommandesGenerales, ligneControle, pastille } from "./general";

let restaurer: (() => void) | null = null;
afterEach(() => {
  restaurer?.();
  restaurer = null;
});

const clientDiscord = {
  ws: { ping: 42, status: 0 },
  guilds: { cache: { size: 3 } },
  users: { cache: { size: 120 } },
  user: { tag: "Achilléa#0001", id: "222222222222222222" },
};

describe("pastilles", () => {
  test("selon latence et état", () => {
    expect(pastille({ ok: false, latenceMs: 1 })).toBe("🔴");
    expect(pastille({ ok: true, latenceMs: null })).toBe("⚪");
    expect(pastille({ ok: true, latenceMs: 10 })).toBe("🟢");
    expect(pastille({ ok: true, latenceMs: 120 })).toBe("🟡");
    expect(pastille({ ok: true, latenceMs: 900 })).toBe("🟠");
    expect(ligneControle({ nom: "API", ok: true, valeur: "5 ms", latenceMs: 5, detail: "x" })).toBe("🟢 **API** : `5 ms` — x");
  });
});

describe("/website", () => {
  test("rend le lien du site Achilléa", async () => {
    const interaction = fausseInteraction();
    await new CommandesGenerales().website(interaction as never);
    expect(interaction.texte()).toContain("rosegriffon.fr");
  });
});

describe("/ping", () => {
  test("tout répond : opérationnel, mesures API et ranked", async () => {
    const installation = installerApi({ "GET /bot/maintenance": { maintenance: false }, "GET /health": { ok: true, ts: 1, activeChallenges: 0 } });
    restaurer = installation.restaurer;
    const interaction = fausseInteraction({ client: clientDiscord });
    await new CommandesGenerales().ping(undefined, interaction as never);
    expect(installation.appels.map(a => a.chemin).toSorted()).toEqual(["/bot/maintenance", "/health"]);
    expect(interaction.texte()).toContain("Tous systèmes opérationnels");
    expect(interaction.texte()).toContain("Guilds");
  });

  test("API en échec : dégradé, avec le motif", async () => {
    const installation = installerApi({ "GET /bot/maintenance": [503, { message: "base injoignable" }], "GET /health": { ok: true, ts: 1, activeChallenges: 0 } });
    restaurer = installation.restaurer;
    const interaction = fausseInteraction({ client: clientDiscord });
    await new CommandesGenerales().ping(true, interaction as never);
    expect(interaction.texte()).toContain("Dégradé");
    expect(interaction.texte()).toContain("base injoignable");
  });
});
