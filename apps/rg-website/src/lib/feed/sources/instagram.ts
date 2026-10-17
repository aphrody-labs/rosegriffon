// SPDX-License-Identifier: Apache-2.0
// Source Instagram du Feed.
//
// CE QUI EST LISIBLE SANS CLÉ NI COMPTE (mesuré en octobre 2026, détail dans docs/insta.md) :
//  - l'oEmbed public `instagram.com/api/v1/oembed/?url=<permalien>` : légende, auteur, vignette
//    d'UNE publication dont on connaît le lien ; la date se déduit exactement du shortcode ;
//  - l'embed `instagram.com/p/<code>/embed/` (iframe publique, chargée au clic) ;
//  - la table `campagne_creations_instagram` : créations déposées par les membres (#IERGDay),
//    images ré-hébergées, revalidées chaque heure par le cron (`campagnes:instagram`).
// CE QUI NE L'EST PAS : le fil d'un compte (`web_profile_info`, `tags/web_info`, pages de profil) :
// 429 / 401 « require_login » depuis une IP anonyme, y compris celle du VPS. Il n'existe donc aucun
// moyen honnête de lister les publications de @rose_griffonfr ou @azaleefr sans session Instagram
// ou jeton Graph API (permission Instagram Public Content Access refusée). Cette source n'invente
// rien : elle rend les créations en base et les liens ajoutés, sinon un état vide explicite.
//
// Variable d'environnement (serveur, optionnelle) :
//   FEED_INSTAGRAM_POSTS  permaliens instagram.com/p|reel/<code>, séparés par espaces, virgules
//                         ou retours à la ligne ; chacun est résolu par l'oEmbed public.
import { analyserPermalien } from "@rosegriffon/types/instagram";

import { getPgPool } from "@/lib/db/pg";
import { urlImageAsset } from "@/lib/x-campagnes/types";

import { COMPTES_SOURCE_INSTAGRAM } from "../comptes";
import { avecDelai, memo } from "../memo";
import { postDepuisCreationInstagram, postDepuisOembedInstagram } from "../normalisation";
import type { OembedInstagram } from "../normalisation";
import type { PageSource, PostFeed, SourceFeed } from "../types";

const TTL_BASE_MS = 60_000;
const TTL_OEMBED_MS = 3_600_000;
const MAX_CREATIONS = 30;
const MAX_LIENS = 20;

const MESSAGE_VIDE =
  "Instagram ne permet pas de lire le fil d'un compte sans connexion. Les publications apparaissent ici lorsqu'elles sont déposées par la communauté ou partagées par l'équipe.";

export function listeEnv(valeur: string | undefined): string[] {
  return (valeur ?? "")
    .split(/[\s,]+/)
    .map(l => l.trim())
    .filter(Boolean);
}

async function lireCreations(): Promise<PostFeed[]> {
  const { rows } = await getPgPool().query(
    `SELECT shortcode, permalink, auteur_pseudo, legende, images, publie_le
       FROM campagne_creations_instagram
      WHERE NOT masque
      ORDER BY publie_le DESC NULLS LAST
      LIMIT $1`,
    [MAX_CREATIONS],
  );
  return rows.map(r => postDepuisCreationInstagram(r, urlImageAsset));
}

function lireOembed(code: string): Promise<OembedInstagram> {
  const url = `https://www.instagram.com/api/v1/oembed/?omitscript=true&url=${encodeURIComponent(`https://www.instagram.com/p/${code}/`)}`;
  return memo(`ig-oembed:${code}`, TTL_OEMBED_MS, async () => {
    const reponse = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; RoseGriffonFeed/1.0)" },
      signal: AbortSignal.timeout(8000),
    });
    if (!reponse.ok) throw new Error(`oEmbed Instagram ${reponse.status}`);
    return (await reponse.json()) as OembedInstagram;
  });
}

async function lireLiens(): Promise<PostFeed[]> {
  const codes = [
    ...new Set(
      listeEnv(process.env.FEED_INSTAGRAM_POSTS)
        .map(l => analyserPermalien(l)?.shortcode)
        .filter((c): c is string => !!c),
    ),
  ].slice(0, MAX_LIENS);
  const lus = await Promise.all(
    codes.map(code =>
      lireOembed(code).then(
        o => postDepuisOembedInstagram(code, o),
        () => null,
      ),
    ),
  );
  return lus.filter((p): p is PostFeed => p !== null);
}

export const sourceInstagram: SourceFeed = {
  reseau: "instagram",
  comptes: COMPTES_SOURCE_INSTAGRAM,
  async lire({ comptes }): Promise<PageSource> {
    if (comptes.length === 0) return { posts: [], profils: [], statut: { reseau: "instagram", etat: "vide" } };
    const pseudos = new Set(comptes.map(c => c.pseudo.toLowerCase()));
    const toutLeReseau = comptes.length >= COMPTES_SOURCE_INSTAGRAM.length;
    const [creations, liens] = await Promise.allSettled([
      avecDelai(memo("ig-creations", TTL_BASE_MS, lireCreations), 8000, "Instagram (base)"),
      avecDelai(lireLiens(), 12_000, "Instagram (oEmbed)"),
    ]);
    const tous = [creations, liens].flatMap(r => (r.status === "fulfilled" ? r.value : []));
    const vus = new Set<string>();
    const posts = tous.filter(p => {
      if (vus.has(p.id)) return false;
      vus.add(p.id);
      return p.compte ? pseudos.has(p.compte.toLowerCase()) : toutLeReseau;
    });
    const enPanne = creations.status === "rejected" && liens.status === "rejected";
    return {
      posts,
      profils: [],
      statut: enPanne
        ? {
            reseau: "instagram",
            etat: "indisponible",
            message: "Les publications Instagram ne sont pas lisibles pour le moment.",
          }
        : { reseau: "instagram", etat: posts.length > 0 ? "ok" : "vide", message: MESSAGE_VIDE },
    };
  },
};
