/**
 * Liste noire : règles, routes et client typé, sans Postgres (dépôt en mémoire).
 */
import { describe, expect, test } from "bun:test";
import { BlacklistResource, AchilleaHttp } from "@rosegriffon/achillea-client";

import { jetonSessionDiscord } from "../../../../lib/achillea-api";
import { creerControleurListeNoire } from "./index";
import { ajouterListeNoire, retirerListeNoire, type DepotListeNoire, type EntreeListeNoire } from "./service";

const ADMIN = "100000000000000001";
const JOUEUR = "100000000000000002";
const DEV = "100000000000000003";

function depotMemoire(): DepotListeNoire & { entrees: Map<string, EntreeListeNoire> } {
  const roles = new Map([
    [ADMIN, 2],
    [JOUEUR, 0],
    [DEV, 3],
  ]);
  const entrees = new Map<string, EntreeListeNoire>();
  return {
    entrees,
    roleUtilisateur: async id => roles.get(id) ?? null,
    joueur: async id => (roles.has(id) ? { id, username: `u${id.slice(-1)}`, displayName: `Joueur ${id.slice(-1)}` } : null),
    entree: async id => entrees.get(id) ?? null,
    lister: async () => [...entrees.values()],
    inscrire: async (id, motif) => {
      const entree = { userId: id, username: `u${id.slice(-1)}`, displayName: `Joueur ${id.slice(-1)}`, reason: motif, since: "2026-10-22T00:00:00.000Z" };
      entrees.set(id, entree);
      return entree;
    },
    retirer: async id => entrees.delete(id),
  };
}

describe("règles", () => {
  test("seul un administrateur inscrit, avec un motif, jamais un développeur ni un doublon", async () => {
    const depot = depotMemoire();
    expect(await ajouterListeNoire(depot, JOUEUR, ADMIN, "abus", [])).toMatchObject({ ok: false, statut: 403 });
    expect(await ajouterListeNoire(depot, ADMIN, JOUEUR, "x", [])).toMatchObject({ ok: false, statut: 400 });
    expect(await ajouterListeNoire(depot, ADMIN, DEV, "abus", [DEV])).toMatchObject({ ok: false, statut: 403 });
    expect(await ajouterListeNoire(depot, ADMIN, "100000000000000009", "abus", [])).toMatchObject({ ok: false, statut: 404 });
    expect(await ajouterListeNoire(depot, ADMIN, JOUEUR, "  triche  ", [])).toMatchObject({ ok: true, valeur: { reason: "triche" } });
    expect(await ajouterListeNoire(depot, ADMIN, JOUEUR, "triche", [])).toMatchObject({ ok: false, statut: 409 });
  });

  test("retrait : administrateur, et seulement si inscrit", async () => {
    const depot = depotMemoire();
    expect(await retirerListeNoire(depot, ADMIN, JOUEUR)).toMatchObject({ ok: false, statut: 404 });
    await depot.inscrire(JOUEUR, "triche");
    expect(await retirerListeNoire(depot, JOUEUR, JOUEUR)).toMatchObject({ ok: false, statut: 403 });
    expect(await retirerListeNoire(depot, ADMIN, JOUEUR)).toEqual({ ok: true, valeur: { userId: JOUEUR } });
    expect(depot.entrees.size).toBe(0);
  });
});

describe("routes et client", () => {
  function client(acteur: string | null, depot: DepotListeNoire) {
    const app = creerControleurListeNoire(() => depot, () => [DEV]);
    const http = new AchilleaHttp({
      baseUrl: "http://api.test",
      fetch: (entree, init) => app.handle(new Request(entree as string, init)),
      ...(acteur ? { getAuthToken: () => jetonSessionDiscord({ id: acteur }) } : {}),
    });
    return new BlacklistResource(http);
  }

  test("cycle complet par le client typé", async () => {
    const depot = depotMemoire();
    const admin = client(ADMIN, depot);
    expect(await admin.add(JOUEUR, "triche")).toMatchObject({ ok: true, value: { userId: JOUEUR, reason: "triche" } });
    expect(await admin.list()).toMatchObject({ ok: true, value: { data: [{ userId: JOUEUR }] } });
    expect(await admin.get(JOUEUR)).toMatchObject({ ok: true, value: { entry: { reason: "triche" } } });
    expect(await admin.remove(JOUEUR)).toEqual({ ok: true, value: { success: true, userId: JOUEUR } });
    expect(await admin.get(JOUEUR)).toMatchObject({ ok: true, value: { entry: null } });
  });

  test("anonyme : 401 ; joueur : 403 ; inconnu : 404", async () => {
    const depot = depotMemoire();
    expect(await client(null, depot).add(JOUEUR, "triche")).toMatchObject({ ok: false, status: 401 });
    expect(await client(JOUEUR, depot).add(ADMIN, "triche")).toMatchObject({ ok: false, status: 403 });
    expect(await client(ADMIN, depot).get("100000000000000009")).toMatchObject({ ok: false, status: 404 });
  });
});
