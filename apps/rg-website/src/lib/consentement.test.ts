import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { enregistrerConsentement, lireConsentement, signauxGoogle } from "./consentement";

const memoire = new Map<string, string>();
// Selon l’environnement de test, localStorage existe déjà (DOM simulé, en
// lecture seule) ou pas du tout : on n’en crée un que s’il manque.
if (typeof globalThis.localStorage === "undefined") {
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (k: string) => memoire.get(k) ?? null,
      setItem: (k: string, v: string) => void memoire.set(k, v),
      removeItem: (k: string) => void memoire.delete(k),
      clear: () => memoire.clear(),
    },
  });
}
beforeEach(() => localStorage.clear());
afterEach(() => localStorage.clear());

describe("consentement", () => {
  test("sans choix enregistré : rien n'est accordé", () => {
    expect(lireConsentement()).toBeNull();
    expect(signauxGoogle(null)).toEqual({
      analytics_storage: "denied",
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
    });
  });

  test("un choix est relu, finalité par finalité", () => {
    enregistrerConsentement({ mesure: true, pub: false });
    const c = lireConsentement();
    expect(c).toMatchObject({ mesure: true, pub: false });
    expect(signauxGoogle(c)).toMatchObject({ analytics_storage: "granted", ad_storage: "denied" });
  });

  test("après 6 mois, le choix expire et le bandeau revient", () => {
    const c = enregistrerConsentement({ mesure: true, pub: true });
    expect(lireConsentement(c.le + 183 * 24 * 60 * 60 * 1000)).toBeNull();
  });

  test("une valeur corrompue vaut absence de choix", () => {
    localStorage.setItem("rg-consentement", "{pas du json");
    expect(lireConsentement()).toBeNull();
  });
});
