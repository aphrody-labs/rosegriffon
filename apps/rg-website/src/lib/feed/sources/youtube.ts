// SPDX-License-Identifier: Apache-2.0
// Source YouTube du Feed. LISIBLE sans clé : le flux Atom public de chaque chaîne (15 dernières
// vidéos : titre, description, date, vignette, vues). Le cron `feed:sync` en fait un instantané
// (vignettes recadrées en 16:9 et ré-hébergées) ; sans instantané frais, lecture directe du flux.
// Chaînes vérifiées : voir `COMPTES_SOURCE_YOUTUBE` (`@rosegriffon/types/feed-comptes`).
import { lireYoutube } from "@rosegriffon/types/feed-lecture";

import { COMPTES_SOURCE_YOUTUBE } from "../comptes";
import { avecDelai, memo } from "../memo";
import type { PageSource, PostFeed, ProfilFeed, SourceFeed } from "../types";

import { estFrais, lireSnapshotServeur } from "./snapshots";

const TTL_DIRECT_MS = 600_000;

export const sourceYoutube: SourceFeed = {
  reseau: "youtube",
  comptes: COMPTES_SOURCE_YOUTUBE,
  async lire({ comptes }): Promise<PageSource> {
    if (comptes.length === 0) return { posts: [], profils: [], statut: { reseau: "youtube", etat: "vide" } };
    const choisis = new Set(comptes.map(c => c.pseudo));
    const snapshot = await lireSnapshotServeur("youtube");
    let posts: PostFeed[];
    let profils: ProfilFeed[];
    if (estFrais(snapshot)) {
      posts = snapshot.posts.filter(p => p.compte && choisis.has(p.compte));
      profils = snapshot.profils.filter(p => choisis.has(p.pseudo));
    } else {
      const lus = await Promise.allSettled(
        comptes.map(c =>
          avecDelai(
            memo(`yt:${c.pseudo}`, TTL_DIRECT_MS, () => lireYoutube(c)),
            15_000,
            `YouTube ${c.nom}`,
          ),
        ),
      );
      const ok = lus.flatMap(l => (l.status === "fulfilled" ? [l.value] : []));
      if (ok.length === 0)
        return {
          posts: [],
          profils: [],
          statut: { reseau: "youtube", etat: "indisponible", message: "YouTube ne répond pas pour le moment." },
        };
      posts = ok.flatMap(r => r.posts);
      profils = ok.flatMap(r => (r.profil ? [r.profil] : []));
    }
    return { posts, profils, statut: { reseau: "youtube", etat: posts.length > 0 ? "ok" : "vide" } };
  },
};
