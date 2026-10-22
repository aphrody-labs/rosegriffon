/**
 * Réglages d'un serveur : règles de l'API, sans base ni Discord (dépôt et porte simulés).
 */
import { describe, expect, test } from "bun:test";

import {
  administreServeur,
  delierClanDuServeur,
  lierClanAuServeur,
  modifierReglages,
  verifierAdministration,
  type DepotReglages,
  type PorteDiscord,
} from "./reglages";

const SERVEUR = "1055585286320554055";
const JOUEUR = "123456789012345678";
const SALON = "1320451424689193070";

interface Etat {
  role: number;
  guilde: { broadcastChannel: string | null; rankedEnabled: boolean } | null;
  clanLieId: number | null;
  clanJoueur: { id: number; name: string; shortName: string; state: number; guildId: string | null; role: number } | null;
}

function depot(etat: Etat): DepotReglages & { etat: Etat } {
  return {
    etat,
    roleUtilisateur: async () => etat.role,
    lireGuilde: async () => (etat.guilde ? { ...etat.guilde } : null),
    clanLie: async () => (etat.clanLieId === null ? null : { id: etat.clanLieId, name: "Les Griffons", shortName: "RG" }),
    ecrireGuilde: async (_id, patch) => {
      if (!etat.guilde) return;
      if (patch.broadcastChannel !== undefined) etat.guilde.broadcastChannel = patch.broadcastChannel;
      if (patch.rankedEnabled !== undefined) etat.guilde.rankedEnabled = patch.rankedEnabled;
    },
    clanDuJoueur: async () => etat.clanJoueur,
    lierClan: async (clanId, guildId) => {
      etat.clanLieId = guildId ? clanId : null;
    },
    delierServeur: async () => {
      etat.clanLieId = null;
    },
  };
}

function porte(reponses: Record<string, unknown>): PorteDiscord {
  return {
    rest: async <T>(_m: "GET", chemin: string) => {
      const r = reponses[chemin];
      if (r === undefined) return { ok: false as const, statut: 404, motif: "Unknown" };
      if (r instanceof Error) return { ok: false as const, statut: null, motif: r.message };
      return { ok: true as const, data: r as T };
    },
  };
}

const etatDeBase = (): Etat => ({
  role: 0,
  guilde: { broadcastChannel: SALON, rankedEnabled: false },
  clanLieId: null,
  clanJoueur: { id: 7, name: "Les Griffons", shortName: "RG", state: 2, guildId: null, role: 3 },
});

describe("administreServeur", () => {
  const guilde = {
    owner_id: "999",
    roles: [
      { id: SERVEUR, permissions: "0" },
      { id: "r-admin", permissions: String(0x8) },
      { id: "r-gerer", permissions: String(0x20) },
      { id: "r-rien", permissions: "1024" },
    ],
  };
  test("propriétaire, Administrateur, Gérer le serveur : oui", () => {
    expect(administreServeur(SERVEUR, "999", guilde, { roles: [] })).toBe(true);
    expect(administreServeur(SERVEUR, JOUEUR, guilde, { roles: ["r-admin"] })).toBe(true);
    expect(administreServeur(SERVEUR, JOUEUR, guilde, { roles: ["r-gerer"] })).toBe(true);
  });
  test("simple membre : non ; @everyone compte", () => {
    expect(administreServeur(SERVEUR, JOUEUR, guilde, { roles: ["r-rien"] })).toBe(false);
    const ouvert = { ...guilde, roles: [{ id: SERVEUR, permissions: String(0x20) }] };
    expect(administreServeur(SERVEUR, JOUEUR, ouvert, { roles: [] })).toBe(true);
  });
});

describe("verifierAdministration", () => {
  const guildeDiscord = { owner_id: "999", roles: [{ id: "r-admin", permissions: "8" }] };
  test("administrateur Achilléa : passe sans interroger Discord", async () => {
    const r = await verifierAdministration(depot({ ...etatDeBase(), role: 2 }), porte({}), SERVEUR, JOUEUR);
    expect(r.ok).toBe(true);
  });
  test("membre administrateur du serveur : passe", async () => {
    const r = await verifierAdministration(
      depot(etatDeBase()),
      porte({ [`/guilds/${SERVEUR}`]: guildeDiscord, [`/guilds/${SERVEUR}/members/${JOUEUR}`]: { roles: ["r-admin"] } }),
      SERVEUR,
      JOUEUR,
    );
    expect(r.ok).toBe(true);
  });
  test("membre sans permission : 403", async () => {
    const r = await verifierAdministration(
      depot(etatDeBase()),
      porte({ [`/guilds/${SERVEUR}`]: guildeDiscord, [`/guilds/${SERVEUR}/members/${JOUEUR}`]: { roles: [] } }),
      SERVEUR,
      JOUEUR,
    );
    expect(r).toMatchObject({ ok: false, statut: 403 });
  });
  test("bot absent : 404 ; Discord injoignable : 503, jamais un accès", async () => {
    expect(await verifierAdministration(depot(etatDeBase()), porte({}), SERVEUR, JOUEUR)).toMatchObject({ statut: 404 });
    const panne = porte({ [`/guilds/${SERVEUR}`]: new Error("ECONNRESET"), [`/guilds/${SERVEUR}/members/${JOUEUR}`]: { roles: [] } });
    expect(await verifierAdministration(depot(etatDeBase()), panne, SERVEUR, JOUEUR)).toMatchObject({ statut: 503 });
  });
});

describe("modifierReglages", () => {
  test("salon du serveur, type texte : accepté", async () => {
    const d = depot({ ...etatDeBase(), guilde: { broadcastChannel: null, rankedEnabled: false } });
    const r = await modifierReglages(d, porte({ [`/channels/${SALON}`]: { guild_id: SERVEUR, type: 0 } }), SERVEUR, {
      broadcastChannel: SALON,
    });
    expect(r).toMatchObject({ ok: true, valeur: { broadcastChannel: SALON } });
  });
  test("salon d'un autre serveur ou vocal : refusé", async () => {
    const d = depot(etatDeBase());
    expect(
      await modifierReglages(d, porte({ [`/channels/${SALON}`]: { guild_id: "1", type: 0 } }), SERVEUR, { broadcastChannel: SALON }),
    ).toMatchObject({ ok: false, statut: 400 });
    expect(
      await modifierReglages(d, porte({ [`/channels/${SALON}`]: { guild_id: SERVEUR, type: 2 } }), SERVEUR, { broadcastChannel: SALON }),
    ).toMatchObject({ ok: false, statut: 400 });
  });
  test("retirer le salon coupe aussi le lien du clan (comportement legacy)", async () => {
    const d = depot({ ...etatDeBase(), clanLieId: 7 });
    const r = await modifierReglages(d, porte({}), SERVEUR, { broadcastChannel: null });
    expect(r).toMatchObject({ ok: true, valeur: { broadcastChannel: null, clan: null } });
  });
  test("bascule ranked ; serveur jamais relevé : 404", async () => {
    const d = depot(etatDeBase());
    expect(await modifierReglages(d, porte({}), SERVEUR, { rankedEnabled: true })).toMatchObject({ valeur: { rankedEnabled: true } });
    expect(await modifierReglages(depot({ ...etatDeBase(), guilde: null }), porte({}), SERVEUR, {})).toMatchObject({ statut: 404 });
  });
});

describe("lier / délier un clan", () => {
  test("président d'un clan approuvé, salon paramétré : lié", async () => {
    const r = await lierClanAuServeur(depot(etatDeBase()), SERVEUR, JOUEUR);
    expect(r).toMatchObject({ ok: true, valeur: { clan: { id: 7 } } });
  });
  test("refus : déjà lié, sans salon, hors clan, clan en attente, simple membre", async () => {
    expect(await lierClanAuServeur(depot({ ...etatDeBase(), clanLieId: 3 }), SERVEUR, JOUEUR)).toMatchObject({ statut: 409 });
    expect(
      await lierClanAuServeur(depot({ ...etatDeBase(), guilde: { broadcastChannel: null, rankedEnabled: false } }), SERVEUR, JOUEUR),
    ).toMatchObject({ statut: 409 });
    expect(await lierClanAuServeur(depot({ ...etatDeBase(), clanJoueur: null }), SERVEUR, JOUEUR)).toMatchObject({ statut: 403 });
    const base = etatDeBase();
    expect(
      await lierClanAuServeur(depot({ ...base, clanJoueur: { ...base.clanJoueur!, state: 1 } }), SERVEUR, JOUEUR),
    ).toMatchObject({ statut: 403 });
    expect(
      await lierClanAuServeur(depot({ ...base, clanJoueur: { ...base.clanJoueur!, role: 1 } }), SERVEUR, JOUEUR),
    ).toMatchObject({ statut: 403 });
  });
  test("délier : sans clan lié, 409 ; sinon, plus de clan", async () => {
    expect(await delierClanDuServeur(depot(etatDeBase()), SERVEUR)).toMatchObject({ statut: 409 });
    expect(await delierClanDuServeur(depot({ ...etatDeBase(), clanLieId: 7 }), SERVEUR)).toMatchObject({ ok: true, valeur: { clan: null } });
  });
});
