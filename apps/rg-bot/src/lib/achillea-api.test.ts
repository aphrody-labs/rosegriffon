/**
 * Tests de l'adaptateur Discord / CLI → API Achilléa.
 *
 * Ce qui est vérifié ici décide de la sécurité de tout le profil : le jeton
 * signé doit être accepté par le vérificateur de l'API pour le BON joueur, et
 * expirer vite ; les refus doivent remonter avec le motif de l'API.
 */
import { afterEach, describe, expect, test } from "bun:test";
import { verifyAchilleaSessionToken } from "@rosegriffon/achillea-core/auth";

import {
  baseApiAchillea,
  clientAchilleaPour,
  ClientAchilleaDelegue,
  ConfigurationApiAchillea,
  decrireEchec,
  estRefus,
  jetonSessionDiscord,
  motifDuCorps,
  remplacerFabriqueClientAchillea,
  TTL_JETON_DELEGUE_S,
} from "./achillea-api";
import { BASE_API_TEST, routeurApi, SECRET_TEST, type AppelApi } from "../../test/achillea-kit";

const JOUEUR = { id: "123456789012345678", username: "akira", avatar: "abc" };

describe("baseApiAchillea", () => {
  test("boucle locale de rg-core par défaut, préfixe /api compris", () => {
    expect(baseApiAchillea({})).toBe("http://127.0.0.1:8810/api");
    expect(baseApiAchillea({ RG_CORE_PORT: "9000" })).toBe("http://127.0.0.1:9000/api");
  });

  test("ACHILLEA_API_INTERNAL_URL l'emporte, sans / final", () => {
    expect(baseApiAchillea({ ACHILLEA_API_INTERNAL_URL: "https://ranked.rosegriffon.fr/api/" })).toBe(
      "https://ranked.rosegriffon.fr/api",
    );
  });

  test("un $VAR non substitué ou un port absurde retombent sur le défaut", () => {
    expect(baseApiAchillea({ ACHILLEA_API_INTERNAL_URL: "$ACHILLEA_API" })).toBe("http://127.0.0.1:8810/api");
    expect(baseApiAchillea({ RG_CORE_PORT: "abc" })).toBe("http://127.0.0.1:8810/api");
  });
});

describe("jetonSessionDiscord", () => {
  test("le jeton est accepté par le vérificateur de l'API, pour ce joueur", async () => {
    const maintenant = Math.floor(Date.now() / 1000);
    const jeton = jetonSessionDiscord(JOUEUR, { JWT_SECRET_KEY: SECRET_TEST }, maintenant);
    const claims = await verifyAchilleaSessionToken(jeton, SECRET_TEST, maintenant + 1);
    expect(claims?.id).toBe(JOUEUR.id);
    expect(claims?.username).toBe("akira");
    expect(claims?.expiresAt).toBe(maintenant + TTL_JETON_DELEGUE_S);
  });

  test("il expire après 5 minutes, pas 30 jours", async () => {
    const maintenant = Math.floor(Date.now() / 1000);
    const jeton = jetonSessionDiscord(JOUEUR, { JWT_SECRET_KEY: SECRET_TEST }, maintenant);
    expect(await verifyAchilleaSessionToken(jeton, SECRET_TEST, maintenant + TTL_JETON_DELEGUE_S + 1)).toBeNull();
  });

  test("un autre secret le rend invalide", async () => {
    const jeton = jetonSessionDiscord(JOUEUR, { JWT_SECRET_KEY: SECRET_TEST });
    expect(await verifyAchilleaSessionToken(jeton, "autre-secret")).toBeNull();
  });

  test("sans secret ou avec un identifiant invalide : erreur de configuration", () => {
    expect(() => jetonSessionDiscord(JOUEUR, {})).toThrow(ConfigurationApiAchillea);
    expect(() => jetonSessionDiscord({ id: "pas-un-flocon" }, { JWT_SECRET_KEY: SECRET_TEST })).toThrow(
      /Identifiant Discord invalide/,
    );
  });
});

describe("ClientAchilleaDelegue", () => {
  test("porte le jeton du joueur et vise la base donnée", async () => {
    const appels: AppelApi[] = [];
    const client = new ClientAchilleaDelegue({
      identite: JOUEUR,
      env: { JWT_SECRET_KEY: SECRET_TEST },
      baseUrl: BASE_API_TEST,
      fetch: routeurApi({ "GET /clans/role": { role: 3 } }, appels),
    });
    const resultat = await client.clans.myRole();
    expect(resultat).toEqual({ ok: true, value: { role: 3 } });
    expect(appels).toHaveLength(1);
    expect(appels[0]?.chemin).toBe("/clans/role");
    const jeton = appels[0]?.porteur?.replace(/^Bearer /u, "") ?? "";
    expect((await verifyAchilleaSessionToken(jeton, SECRET_TEST))?.id).toBe(JOUEUR.id);
    expect(client.utilisateurId).toBe(JOUEUR.id);
  });

  test("un jeton fourni est envoyé tel quel", async () => {
    const appels: AppelApi[] = [];
    const client = new ClientAchilleaDelegue({
      jeton: "jeton-brut",
      baseUrl: BASE_API_TEST,
      fetch: routeurApi({ "GET /clans/role": { role: 0 } }, appels),
    });
    await client.clans.myRole();
    expect(appels[0]?.porteur).toBe("Bearer jeton-brut");
    expect(client.utilisateurId).toBeNull();
  });

  test("le motif d'un refus de l'API est retenu et rendu en français", async () => {
    const client = new ClientAchilleaDelegue({
      identite: JOUEUR,
      env: { JWT_SECRET_KEY: SECRET_TEST },
      baseUrl: BASE_API_TEST,
      fetch: routeurApi({ "POST /clans/kick/42": [403, { message: "Seul le président peut exclure" }] }),
    });
    const resultat = await client.clans.kickMember("42", "absence");
    expect(resultat.ok).toBe(false);
    if (resultat.ok) return;
    expect(estRefus(resultat)).toBe(true);
    expect(client.motifApi(resultat)).toBe("Seul le président peut exclure");
    expect(client.motifEchec(resultat)).toBe("Seul le président peut exclure");
  });

  test("API injoignable : jamais d'exception, un motif lisible", async () => {
    const client = new ClientAchilleaDelegue({
      identite: JOUEUR,
      env: { JWT_SECRET_KEY: SECRET_TEST },
      baseUrl: BASE_API_TEST,
      fetch: async () => {
        throw new Error("ECONNREFUSED");
      },
    });
    const resultat = await client.clans.myRole();
    expect(resultat.ok).toBe(false);
    if (resultat.ok) return;
    expect(client.motifEchec(resultat)).toContain("injoignable");
  });
});

describe("decrireEchec", () => {
  const base = { ok: false as const, path: "/x" };
  test("chaque statut a sa tournure, le motif de l'API passe devant", () => {
    expect(decrireEchec({ ...base, kind: "http", status: 403, detail: "" })).toContain("droits");
    expect(decrireEchec({ ...base, kind: "http", status: 404, detail: "" }, "Clan introuvable")).toBe("Clan introuvable");
    expect(decrireEchec({ ...base, kind: "http", status: 400, detail: "" }, "nom trop long")).toBe(
      "Demande invalide : nom trop long",
    );
    expect(decrireEchec({ ...base, kind: "http", status: 500, detail: "" })).toContain("HTTP 500");
    expect(decrireEchec({ ...base, kind: "invalid_response", detail: "id : attendu" })).toContain("inattendue");
  });

  test("motifDuCorps lit message, error, erreur", () => {
    expect(motifDuCorps({ message: "a" })).toBe("a");
    expect(motifDuCorps({ error: "b" })).toBe("b");
    expect(motifDuCorps({ erreur: "c" })).toBe("c");
    expect(motifDuCorps({ autre: 1 })).toBeNull();
    expect(motifDuCorps("  ")).toBeNull();
  });
});

describe("fabrique", () => {
  let restaurer: (() => void) | null = null;
  afterEach(() => restaurer?.());

  test("remplaçable en test, restaurée ensuite", () => {
    const factice = new ClientAchilleaDelegue({ jeton: "x", baseUrl: BASE_API_TEST });
    restaurer = remplacerFabriqueClientAchillea(() => factice);
    expect(clientAchilleaPour(JOUEUR)).toBe(factice);
    restaurer();
    restaurer = null;
    expect(clientAchilleaPour(JOUEUR)).not.toBe(factice);
  });
});
