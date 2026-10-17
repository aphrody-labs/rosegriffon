// SPDX-License-Identifier: Apache-2.0
// Source TikTok du Feed.
//
// CE QUI EST LISIBLE SANS CLÉ NI COMPTE (mesuré en octobre 2026) :
//  - le profil public `tiktok.com/@pseudo` : bio, avatar, compteurs, lien du profil (JSON de
//    réhydratation embarqué dans la page, voir `profilDepuisHtmlTiktok`) ;
//  - l'oEmbed `tiktok.com/oembed?url=<lien de vidéo>` : titre, auteur, vignette d'UNE vidéo ;
//    la date est exacte (horodatage contenu dans l'identifiant de la vidéo) ;
//  - l'embed `tiktok.com/embed/v2/<id>` (iframe publique, chargée au clic).
// CE QUI NE L'EST PAS : la liste des vidéos d'un compte. Le JSON du profil porte `itemList: []` ;
// la vraie liste passe par une API signée, et un navigateur automatisé tombe sur un captcha.
// Aucun flux RSS n'existe. Cette source ne simule donc rien : sans vidéo partagée, elle rend un
// état vide explicite, avec le profil et ses compteurs.
//
// Variable d'environnement (serveur, optionnelle) :
//   FEED_TIKTOK_VIDEOS  liens https://www.tiktok.com/@pseudo/video/<id>, séparés par espaces,
//                       virgules ou retours à la ligne ; chacun est résolu par l'oEmbed public.
//                       Seules les vidéos de comptes listés dans lib/feed/comptes.ts s'affichent.
import { COMPTES_SOURCE_TIKTOK } from "../comptes";
import { avecDelai, memo } from "../memo";
import { analyserVideoTiktok, postDepuisOembedTiktok, profilDepuisHtmlTiktok } from "../normalisation";
import type { OembedTiktok } from "../normalisation";
import type { CompteSource, PageSource, PostFeed, ProfilFeed, SourceFeed } from "../types";

import { listeEnv } from "./instagram";

const TTL_PROFIL_MS = 300_000;
const TTL_OEMBED_MS = 3_600_000;
const MAX_VIDEOS = 30;
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

const MESSAGE_VIDE =
  "TikTok ne permet pas de lire la liste des vidéos d'un compte sans connexion. Les vidéos apparaissent ici lorsqu'elles sont partagées par l'équipe.";

function lireProfilTiktok(pseudo: string): Promise<ProfilFeed | null> {
  return memo(`tt-profil:${pseudo}`, TTL_PROFIL_MS, async () => {
    const reponse = await fetch(`https://www.tiktok.com/@${pseudo}`, {
      headers: { "User-Agent": UA, "Accept-Language": "fr-FR,fr;q=0.9" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!reponse.ok) throw new Error(`profil TikTok ${reponse.status}`);
    return profilDepuisHtmlTiktok(await reponse.text(), pseudo);
  });
}

function lireOembed(url: string): Promise<OembedTiktok> {
  return memo(`tt-oembed:${url}`, TTL_OEMBED_MS, async () => {
    const reponse = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`, {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(8000),
    });
    if (!reponse.ok) throw new Error(`oEmbed TikTok ${reponse.status}`);
    return (await reponse.json()) as OembedTiktok;
  });
}

async function lireVideos(comptes: readonly CompteSource[]): Promise<PostFeed[]> {
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
    const [profils, videos] = await Promise.all([
      Promise.all(
        comptes.map(c => avecDelai(lireProfilTiktok(c.pseudo), 12_000, `TikTok @${c.pseudo}`).catch(() => null)),
      ),
      avecDelai(lireVideos(comptes), 14_000, "TikTok (oEmbed)").catch(() => [] as PostFeed[]),
    ]);
    return {
      posts: videos,
      profils: profils.filter((p): p is ProfilFeed => p !== null),
      statut: { reseau: "tiktok", etat: videos.length > 0 ? "ok" : "vide", message: MESSAGE_VIDE },
    };
  },
};
