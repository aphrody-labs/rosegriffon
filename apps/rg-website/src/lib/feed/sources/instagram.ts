// SPDX-License-Identifier: Apache-2.0
// Source Instagram du Feed.
//
// CE QUI EST LISIBLE (vérifié en octobre 2026, détail dans docs/insta.md) :
//  - la GRILLE publique d'un profil, rendue par `Bun.WebView` (le cron `feed:sync` s'en charge) :
//    ≈ 12 dernières publications (lien, vignette). Un `fetch` simple y reçoit 429 / 401 : seul un
//    vrai navigateur obtient la page. Les requêtes GraphQL de la page (timeline) répondent
//    « Unauthorized logged out query » : likes, commentaires et suite de la grille exigent une
//    session (`FEED_INSTAGRAM_COOKIES`, injectée par `Network.setCookies` dans le cron) ;
//  - l'oEmbed public `instagram.com/api/v1/oembed/?url=<permalien>` : légende et auteur d'UNE
//    publication (le cron l'applique à chaque vignette de la grille) ; la date se déduit
//    exactement du shortcode ;
//  - l'embed `instagram.com/p/<code>/embed/` (iframe publique, chargée au clic) ;
//  - la table `campagne_creations_instagram` : créations déposées par les membres (#IERGDay).
// Le site ne lance jamais de navigateur : il lit l'instantané du cron (`feed/snapshots/instagram.json`),
// les créations en base et les liens de `FEED_INSTAGRAM_POSTS` (permaliens ; espaces, virgules ou lignes).
import { analyserPermalien } from "@rosegriffon/types/instagram";

import { getPgPool } from "@/lib/db/pg";
import { urlImageAsset } from "@/lib/x-campagnes/types";

import { COMPTES_SOURCE_INSTAGRAM } from "../comptes";
import { avecDelai, memo } from "../memo";

import { estFrais, lireSnapshotServeur } from "./snapshots";
import { postDepuisCreationInstagram, postDepuisOembedInstagram } from "../normalisation";
import type { OembedInstagram } from "../normalisation";
import type { PageSource, PostFeed, SourceFeed } from "../types";

const TTL_BASE_MS = 60_000;
const TTL_OEMBED_MS = 3_600_000;
const MAX_CREATIONS = 30;
const MAX_LIENS = 20;

const MESSAGE_VIDE =
  "Aucune publication Instagram lisible pour le moment : le fil se synchronise en tâche de fond et, sans connexion, se limite aux dernières publications de la grille.";

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
    const snapshot = await lireSnapshotServeur("instagram");
    const frais = estFrais(snapshot, 12 * 3600_000) ? snapshot : null;
    const [creations, liens] = await Promise.allSettled([
      avecDelai(memo("ig-creations", TTL_BASE_MS, lireCreations), 8000, "Instagram (base)"),
      avecDelai(lireLiens(), 12_000, "Instagram (oEmbed)"),
    ]);
    // Créations d'abord : à identifiant égal, c'est leur image ré-hébergée qui est servie.
    const tous = [...[creations, liens].flatMap(r => (r.status === "fulfilled" ? r.value : [])), ...(frais?.posts ?? [])];
    const vus = new Set<string>();
    const posts = tous.filter(p => {
      if (vus.has(p.id)) return false;
      vus.add(p.id);
      return p.compte ? pseudos.has(p.compte.toLowerCase()) : toutLeReseau;
    });
    const enPanne = creations.status === "rejected" && liens.status === "rejected";
    return {
      posts,
      profils: frais ? frais.profils.filter(p => pseudos.has(p.pseudo.toLowerCase())) : [],
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
