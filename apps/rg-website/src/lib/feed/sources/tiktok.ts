// SPDX-License-Identifier: Apache-2.0
// Source TikTok du Feed.
//
// CE QUI EST LISIBLE SANS CLÉ NI COMPTE (vérifié en octobre 2026) :
//  - la page d'embed du créateur `tiktok.com/embed/@pseudo` : les ≈ 10 dernières vidéos (légende,
//    dimensions, vignette, vues, lien MP4). C'est la page que charge l'embed « créateur » de
//    l'oEmbed public ; elle ne demande pas de connexion ;
//  - le profil public `tiktok.com/@pseudo` : bio, avatar, compteurs, lien du site ;
//  - l'oEmbed `tiktok.com/oembed?url=<lien de vidéo>` pour une vidéo isolée (`FEED_TIKTOK_VIDEOS`) ;
//  - l'embed de lecteur `tiktok.com/embed/v2/<id>` (iframe publique, chargée au clic).
// La date de chaque vidéo est exacte (horodatage contenu dans son identifiant).
// CE QUI NE L'EST PAS : au-delà des ≈ 10 dernières vidéos, et l'historique complet. La page du profil
// elle-même est derrière un captcha pour un navigateur anonyme (`Bun.WebView` inclus) : lister tout
// le catalogue exigerait une session (`FEED_TIKTOK_COOKIES`, voir le cron `feed:sync`).
//
// Le cron `feed:sync` écrit un instantané (vignettes ré-hébergées, durée sondée) ; sans instantané
// frais, lecture directe. Variable d'environnement (serveur, optionnelle) :
//   FEED_TIKTOK_VIDEOS  liens https://www.tiktok.com/@pseudo/video/<id> (espaces, virgules, lignes),
//                       résolus par l'oEmbed ; seules les vidéos des comptes de comptes.ts s'affichent.
import { lireTiktok } from "@rosegriffon/types/feed-lecture";

import { COMPTES_SOURCE_TIKTOK } from "../comptes";
import { avecDelai, memo } from "../memo";
import { analyserVideoTiktok, postDepuisOembedTiktok } from "../normalisation";
import type { OembedTiktok } from "../normalisation";
import type { CompteSource, PageSource, PostFeed, ProfilFeed, SourceFeed } from "../types";

import { listeEnv } from "./instagram";
import { estFrais, lireSnapshotServeur } from "./snapshots";

const TTL_DIRECT_MS = 300_000;
const TTL_OEMBED_MS = 3_600_000;
const MAX_VIDEOS = 30;

const MESSAGE_VIDE = "Aucune vidéo TikTok lisible pour le moment.";

function lireOembed(url: string): Promise<OembedTiktok> {
  return memo(`tt-oembed:${url}`, TTL_OEMBED_MS, async () => {
    const reponse = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; RoseGriffonFeed/1.0)" },
      signal: AbortSignal.timeout(8000),
    });
    if (!reponse.ok) throw new Error(`oEmbed TikTok ${reponse.status}`);
    return (await reponse.json()) as OembedTiktok;
  });
}

async function lireVideosListees(comptes: readonly CompteSource[]): Promise<PostFeed[]> {
  const connus = new Map(COMPTES_SOURCE_TIKTOK.map(c => [c.pseudo.toLowerCase(), c]));
  const choisis = new Set(comptes.map(c => c.pseudo.toLowerCase()));
  const videos = listeEnv(process.env.FEED_TIKTOK_VIDEOS)
    .map(l => analyserVideoTiktok(l))
    .filter((v): v is { pseudo: string; id: string } => !!v && choisis.has(v.pseudo.toLowerCase()))
    .slice(0, MAX_VIDEOS);
  const lus = await Promise.all(
    videos.map(v =>
      lireOembed(`https://www.tiktok.com/@${v.pseudo}/video/${v.id}`).then(
        o => postDepuisOembedTiktok(v.pseudo, v.id, o, connus.get(v.pseudo.toLowerCase())),
        () => null,
      ),
    ),
  );
  return lus.filter((p): p is PostFeed => p !== null);
}

export const sourceTiktok: SourceFeed = {
  reseau: "tiktok",
  comptes: COMPTES_SOURCE_TIKTOK,
  async lire({ comptes }): Promise<PageSource> {
    if (comptes.length === 0) return { posts: [], profils: [], statut: { reseau: "tiktok", etat: "vide" } };
    const choisis = new Set(comptes.map(c => c.pseudo));
    const snapshot = await lireSnapshotServeur("tiktok");
    let posts: PostFeed[] = [];
    let profils: ProfilFeed[] = [];
    let panne = false;
    if (estFrais(snapshot)) {
      posts = snapshot.posts.filter(p => p.compte && choisis.has(p.compte));
      profils = snapshot.profils.filter(p => choisis.has(p.pseudo));
    } else {
      const lus = await Promise.allSettled(
        comptes.map(c =>
          avecDelai(
            memo(`tt:${c.pseudo}`, TTL_DIRECT_MS, () => lireTiktok(c)),
            20_000,
            `TikTok @${c.pseudo}`,
          ),
        ),
      );
      const ok = lus.flatMap(l => (l.status === "fulfilled" ? [l.value] : []));
      panne = ok.length === 0;
      posts = ok.flatMap(r => r.posts);
      profils = ok.flatMap(r => {
        const p = r.profilPage ?? r.profil;
        return p ? [p] : [];
      });
    }
    const listees = await avecDelai(lireVideosListees(comptes), 14_000, "TikTok (oEmbed)").catch(() => [] as PostFeed[]);
    const vus = new Set(posts.map(p => p.id));
    posts = [...posts, ...listees.filter(p => !vus.has(p.id))];
    if (panne && posts.length === 0)
      return {
        posts,
        profils,
        statut: { reseau: "tiktok", etat: "indisponible", message: "TikTok ne répond pas pour le moment." },
      };
    return {
      posts,
      profils,
      statut: { reseau: "tiktok", etat: posts.length > 0 ? "ok" : "vide", message: MESSAGE_VIDE },
    };
  },
};
