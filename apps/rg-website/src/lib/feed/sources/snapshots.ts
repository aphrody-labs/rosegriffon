// SPDX-License-Identifier: Apache-2.0
// Lecture des instantanés écrits par le cron `feed:sync` (bucket `assets`, `feed/snapshots/<réseau>.json`).
// Ordre : disque (`RG_MEDIA_ROOT`, quand le site tourne sur l'hôte des médias) puis HTTP sur l'origine
// publique des médias (`RG_MEDIA_PUBLIC_ORIGIN`, `https://cdn.rosegriffon.fr` par défaut). Variables
// lues côté serveur uniquement ; l'instantané ne contient que des données publiques.
import { join } from "node:path";

import { CHEMIN_SNAPSHOT, lireSnapshot } from "@rosegriffon/types/feed";
import type { Reseau, SnapshotFeed } from "@rosegriffon/types/feed";

import { memo } from "../memo";

const TTL_MS = 30_000;
/** Au-delà, l'instantané est jugé périmé et la source retombe sur la lecture en direct si elle existe. */
export const AGE_MAX_MS = 3 * 3600_000;

async function charger(reseau: Reseau): Promise<SnapshotFeed | null> {
  const chemin = CHEMIN_SNAPSHOT(reseau);
  const racine = process.env.RG_MEDIA_ROOT?.trim();
  try {
    if (racine) {
      const fichier = Bun.file(join(racine, "assets", chemin));
      if (await fichier.exists()) return lireSnapshot(await fichier.json(), reseau);
    }
    const origine = (process.env.RG_MEDIA_PUBLIC_ORIGIN ?? "https://cdn.rosegriffon.fr").replace(/\/+$/, "");
    const reponse = await fetch(`${origine}/storage/v1/object/public/assets/${chemin}`, {
      signal: AbortSignal.timeout(4000),
    });
    return reponse.ok ? lireSnapshot(await reponse.json(), reseau) : null;
  } catch {
    return null;
  }
}

export function lireSnapshotServeur(reseau: Reseau): Promise<SnapshotFeed | null> {
  return memo(`snapshot:${reseau}`, TTL_MS, () => charger(reseau));
}

export const estFrais = (s: SnapshotFeed | null, ageMaxMs = AGE_MAX_MS): s is SnapshotFeed =>
  !!s && Date.now() - Date.parse(s.genereLe) < ageMaxMs;
