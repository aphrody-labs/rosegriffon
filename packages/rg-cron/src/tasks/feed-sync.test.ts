/**
 * Copyright 2026 Rose Griffon
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * `feed:sync` : une source en panne n'emporte plus le passage (succès partiel), une limitation de
 * débit diffère la source avec une attente croissante, une panne durable fait échouer la tâche.
 * Lecteurs factices, médias écrits dans un dossier temporaire (`RG_MEDIA_ROOT`) : aucun réseau.
 */

import { afterAll, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { PostFeed, ProfilFeed, Reseau, SnapshotFeed } from "@rosegriffon/types/feed";
import { ErreurHttp } from "@rosegriffon/types/feed-lecture";

import {
  ATTENTE_LIMITE_MAX_MS,
  ATTENTE_LIMITE_MIN_MS,
  bilanFeedSync,
  conserverComptesEnEchec,
  oublierEtatsSources,
  prochaineReprise,
  SEUIL_ECHECS_DURABLES,
  synchroniserFeed,
  type LecteurReseau,
  type LectureReseau,
} from "./feed-sync";

const racine = mkdtempSync(join(tmpdir(), "feed-sync-"));
const racineAvant = Bun.env.RG_MEDIA_ROOT;
Bun.env.RG_MEDIA_ROOT = racine;

afterAll(() => {
  if (racineAvant === undefined) delete Bun.env.RG_MEDIA_ROOT;
  else Bun.env.RG_MEDIA_ROOT = racineAvant;
  rmSync(racine, { recursive: true, force: true });
});

beforeEach(() => {
  rmSync(join(racine, "assets"), { recursive: true, force: true });
  oublierEtatsSources();
});

const T0 = Date.parse("2026-10-22T12:00:00Z");

function post(reseau: Reseau, id: string, compte: string, date: string): PostFeed {
  return {
    id: `${reseau}:${id}`,
    idOrigine: id,
    reseau,
    auteur: { pseudo: compte, nom: compte, lien: "" },
    texte: id,
    medias: [],
    date,
    lien: `https://exemple.test/${id}`,
    compte,
  } as PostFeed;
}

const lecture = (reseau: Reseau, posts: PostFeed[], extra: Partial<LectureReseau> = {}): LectureReseau => ({
  posts,
  profils: [],
  statut: { reseau, etat: posts.length > 0 ? "ok" : "vide" },
  vignettes: 0,
  ...extra,
});

const reussit = (reseau: Reseau): LecteurReseau => async () => lecture(reseau, [post(reseau, "a", "c", "2026-10-21T00:00:00Z")]);
const echoue = (motif: string): LecteurReseau => async () => {
  throw new Error(motif);
};
const limite = (retryAfterMs?: number): LecteurReseau => async () => {
  throw new ErreurHttp(429, "https://www.tiktok.com/embed/@rose_griffon", retryAfterMs);
};

async function snapshotSurDisque(reseau: Reseau): Promise<SnapshotFeed | null> {
  const f = Bun.file(join(racine, "assets", "feed", "snapshots", `${reseau}.json`));
  return (await f.exists()) ? ((await f.json()) as SnapshotFeed) : null;
}

describe("une source en panne ne fait pas échouer le passage", () => {
  test("Instagram en panne : YouTube et TikTok écrits, succès partiel, motif rapporté", async () => {
    const r = await synchroniserFeed(
      {},
      {
        lecteurs: { youtube: reussit("youtube"), tiktok: reussit("tiktok"), instagram: echoue("WebView.navigate: view is closed") },
        maintenant: () => T0,
      },
    );
    expect(r.success).toBe(true);
    expect(r.partiel).toBe(true);
    expect(r.reseaux.map(x => [x.reseau, x.etat])).toEqual([
      ["youtube", "ok"],
      ["tiktok", "ok"],
      ["instagram", "echec"],
    ]);
    expect(r.error).toBe("instagram : WebView.navigate: view is closed");
    expect((await snapshotSurDisque("youtube"))?.posts).toHaveLength(1);
    expect((await snapshotSurDisque("tiktok"))?.posts).toHaveLength(1);
    expect(await snapshotSurDisque("instagram")).toBeNull();
  });

  test("tout est lu : succès complet, rien à signaler", async () => {
    const r = await synchroniserFeed(
      {},
      { lecteurs: { youtube: reussit("youtube"), tiktok: reussit("tiktok"), instagram: reussit("instagram") }, maintenant: () => T0 },
    );
    expect(r).toMatchObject({ success: true, partiel: false, error: undefined });
  });

  test("toutes les sources en panne : échec", async () => {
    const r = await synchroniserFeed(
      {},
      { lecteurs: { youtube: echoue("a"), tiktok: echoue("b"), instagram: echoue("c") }, maintenant: () => T0 },
    );
    expect(r.success).toBe(false);
    expect(r.error).toBe("youtube : a ; tiktok : b ; instagram : c");
  });

  test("panne durable : la tâche échoue au-delà du seuil de passages d'affilée, puis se rétablit", async () => {
    const lecteurs = { youtube: reussit("youtube"), tiktok: reussit("tiktok"), instagram: echoue("en panne") };
    for (let i = 1; i < SEUIL_ECHECS_DURABLES; i++) {
      expect((await synchroniserFeed({}, { lecteurs, maintenant: () => T0 + i * 1800_000 })).success).toBe(true);
    }
    const durable = await synchroniserFeed({}, { lecteurs, maintenant: () => T0 + SEUIL_ECHECS_DURABLES * 1800_000 });
    expect(durable.success).toBe(false);
    expect(durable.error).toContain(`instagram : en échec ${SEUIL_ECHECS_DURABLES} passages d'affilée`);
    // L'état survit à un redémarrage de rg-core (relu depuis le disque).
    oublierEtatsSources();
    const retabli = await synchroniserFeed(
      {},
      { lecteurs: { ...lecteurs, instagram: reussit("instagram") }, maintenant: () => T0 + 99 * 1800_000 },
    );
    expect(retabli).toMatchObject({ success: true, partiel: false });
  });

  test("comptes en échec d'un réseau lu : succès partiel, comptes rapportés", async () => {
    const r = await synchroniserFeed(
      { reseau: "youtube" },
      {
        lecteurs: { youtube: async () => lecture("youtube", [], { comptesEnEchec: ["LEVEL5ch : HTTP 404"] }) },
        maintenant: () => T0,
      },
    );
    expect(r).toMatchObject({ success: true, partiel: true, error: "youtube : LEVEL5ch : HTTP 404" });
    expect(r.reseaux[0]!.comptesEnEchec).toEqual(["LEVEL5ch : HTTP 404"]);
  });
});

describe("TikTok 429 : différé avec attente croissante", () => {
  test("429 : différé (pas un échec), instantané gardé, plus relu avant l'échéance", async () => {
    let appels = 0;
    const tiktok: LecteurReseau = async p => {
      appels++;
      return limite()(p);
    };
    const premier = await synchroniserFeed({ reseau: "tiktok" }, { lecteurs: { tiktok }, maintenant: () => T0 });
    expect(premier.success).toBe(true);
    expect(premier.partiel).toBe(true);
    expect(premier.reseaux[0]).toMatchObject({
      etat: "differe",
      ok: true,
      erreur: "HTTP 429 : https://www.tiktok.com/embed/@rose_griffon",
      reprendreApres: new Date(T0 + ATTENTE_LIMITE_MIN_MS).toISOString(),
    });
    expect(appels).toBe(1);

    // Passage suivant, avant l'échéance : TikTok n'est pas relu.
    const saute = await synchroniserFeed({ reseau: "tiktok" }, { lecteurs: { tiktok }, maintenant: () => T0 + 60_000 });
    expect(saute.reseaux[0]!.etat).toBe("differe");
    expect(appels).toBe(1);

    // Après l'échéance : relu ; nouveau 429 → attente doublée.
    const t2 = T0 + ATTENTE_LIMITE_MIN_MS + 1;
    const second = await synchroniserFeed({ reseau: "tiktok" }, { lecteurs: { tiktok }, maintenant: () => t2 });
    expect(appels).toBe(2);
    expect(second.reseaux[0]!.reprendreApres).toBe(new Date(t2 + 2 * ATTENTE_LIMITE_MIN_MS).toISOString());

    // Rétabli : l'attente est oubliée.
    const t3 = t2 + 2 * ATTENTE_LIMITE_MIN_MS + 1;
    const ok = await synchroniserFeed({ reseau: "tiktok" }, { lecteurs: { tiktok: reussit("tiktok") }, maintenant: () => t3 });
    expect(ok).toMatchObject({ success: true, partiel: false });
    const apres = await synchroniserFeed({ reseau: "tiktok" }, { lecteurs: { tiktok }, maintenant: () => t3 + 1 });
    expect(apres.reseaux[0]!.reprendreApres).toBe(new Date(t3 + 1 + ATTENTE_LIMITE_MIN_MS).toISOString());
  });

  test("Retry-After plus long que l'attente prévue : respecté", async () => {
    const r = await synchroniserFeed(
      { reseau: "tiktok" },
      { lecteurs: { tiktok: limite(2 * 3600_000) }, maintenant: () => T0 },
    );
    expect(r.reseaux[0]!.reprendreApres).toBe(new Date(T0 + 2 * 3600_000).toISOString());
  });

  test("passage « dry » : l'attente n'est pas retenue pour les passages suivants", async () => {
    let appels = 0;
    const tiktok: LecteurReseau = async p => {
      appels++;
      return limite()(p);
    };
    await synchroniserFeed({ reseau: "tiktok", dry: true }, { lecteurs: { tiktok }, maintenant: () => T0 });
    await synchroniserFeed({ reseau: "tiktok", dry: true }, { lecteurs: { tiktok }, maintenant: () => T0 + 1 });
    expect(appels).toBe(2);
  });

  test("attente : 30 min, doublée, plafonnée à 6 h", () => {
    expect(prochaineReprise(1, 0)).toBe(ATTENTE_LIMITE_MIN_MS);
    expect(prochaineReprise(2, 0)).toBe(2 * ATTENTE_LIMITE_MIN_MS);
    expect(prochaineReprise(4, 0)).toBe(8 * ATTENTE_LIMITE_MIN_MS);
    expect(prochaineReprise(20, 0)).toBe(ATTENTE_LIMITE_MAX_MS);
    expect(prochaineReprise(1, 0, 48 * 3600_000)).toBe(ATTENTE_LIMITE_MAX_MS);
  });
});

describe("comptes en échec : publications précédentes gardées", () => {
  const precedent: SnapshotFeed = {
    version: 1,
    reseau: "youtube",
    genereLe: "2026-10-21T00:00:00Z",
    posts: [
      post("youtube", "ancien-rg", "UCrg", "2026-10-10T00:00:00Z"),
      post("youtube", "ancien-l5", "UCl5", "2026-10-15T00:00:00Z"),
      post("youtube", "ancien-l5-bis", "UCl5", "2026-10-01T00:00:00Z"),
    ],
    profils: [
      { reseau: "youtube", pseudo: "UCrg", nom: "RG" },
      { reseau: "youtube", pseudo: "UCl5", nom: "LEVEL5ch" },
    ] as ProfilFeed[],
    statut: { reseau: "youtube", etat: "ok" },
  };

  test("la chaîne en panne garde ses vidéos et son profil ; les autres sont remplacées", () => {
    const lu = {
      posts: [post("youtube", "nouveau-rg", "UCrg", "2026-10-20T00:00:00Z")],
      profils: [{ reseau: "youtube", pseudo: "UCrg", nom: "RG" }] as ProfilFeed[],
    };
    const r = conserverComptesEnEchec(lu, precedent, ["UCl5"]);
    expect(r.posts.map(p => p.idOrigine)).toEqual(["nouveau-rg", "ancien-l5", "ancien-l5-bis"]);
    expect(r.profils.map(p => p.pseudo)).toEqual(["UCrg", "UCl5"]);
  });

  test("sans comptes en échec ou sans instantané précédent : la lecture telle quelle", () => {
    const lu = { posts: [post("youtube", "x", "UCrg", "2026-10-20T00:00:00Z")], profils: [] };
    expect(conserverComptesEnEchec(lu, precedent, [])).toEqual({ posts: lu.posts, profils: [] });
    expect(conserverComptesEnEchec(lu, null, ["UCl5"])).toEqual({ posts: lu.posts, profils: [] });
  });

  test("bilan : un réseau différé seul reste un succès ; un seuil durable non", () => {
    const differe = { reseau: "tiktok" as const, ok: true, etat: "differe" as const, posts: 0, vignettes: 0, erreur: "HTTP 429" };
    expect(bilanFeedSync([differe])).toMatchObject({ success: true, partiel: true });
    expect(bilanFeedSync([differe], ["tiktok : limité 6 fois d'affilée"]).success).toBe(false);
    expect(bilanFeedSync([]).success).toBe(false);
  });
});
