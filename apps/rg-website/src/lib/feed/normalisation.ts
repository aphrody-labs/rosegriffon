// SPDX-License-Identifier: Apache-2.0
// Normalisation pure (sans réseau) de chaque réseau vers `PostFeed`, et fil unifié : fusion,
// dédoublonnage, tri par date, curseur composite. Aucun import serveur : testable avec des fixtures.
// Les normaliseurs des autres réseaux vivent dans `@rosegriffon/types/feed-normalisation`, partagés
// avec le cron `feed:sync`.
import type { XProfil, XTweet } from "./live";
import { RESEAUX } from "./comptes";
import type { CompteSource, MediaFeed, PostFeed, ProfilFeed, Reseau } from "./types";

// ── X ───────────────────────────────────────────────────────────────────────

function typeMediaX(type: string): MediaFeed["type"] {
  if (type === "video") return "video";
  if (type === "animated_gif" || type === "gif") return "gif";
  return "image";
}

export function postDepuisTweet(t: XTweet, compte?: CompteSource): PostFeed {
  const pseudo = t.author.username;
  const date = new Date(t.created_at);
  return {
    id: `x:${t.id}`,
    idOrigine: t.id,
    reseau: "x",
    auteur: { pseudo, nom: t.author.name, lien: `https://x.com/${pseudo}` },
    texte: t.text,
    medias: (t.media ?? [])
      .filter(m => m.url || m.preview_url)
      .map(m => ({
        type: typeMediaX(m.type),
        url: m.url,
        apercu: m.preview_url,
        largeur: m.width,
        hauteur: m.height,
      })),
    date: Number.isNaN(date.getTime()) ? new Date(0).toISOString() : date.toISOString(),
    metriques: {
      reponses: t.reply_count,
      partages: (t.retweet_count ?? 0) + (t.quote_count ?? 0),
      jaime: t.like_count,
      vues: t.view_count,
    },
    lien: `https://x.com/${pseudo}/status/${t.id}`,
    citation: t.quoted_tweet ? postDepuisTweet(t.quoted_tweet) : undefined,
    compte: compte?.pseudo,
    groupe: compte?.groupe,
  };
}

export function profilDepuisX(p: XProfil): ProfilFeed {
  return {
    reseau: "x",
    pseudo: p.screen_name,
    nom: p.name,
    avatar: p.avatar,
    banniere: p.banner,
    bio: p.description,
    site: p.site,
    abonnes: p.followers,
    abonnements: p.following,
    publications: p.posts,
    rejointLe: p.rejointLe,
    certifie: p.certifie,
    lien: `https://x.com/${p.screen_name}`,
  };
}

// ── Fil unifié ──────────────────────────────────────────────────────────────

/** Fusionne des listes : dédoublonnage par identifiant, du plus récent au plus ancien. */
export function fusionner(listes: readonly (readonly PostFeed[])[], max = Infinity): PostFeed[] {
  const vus = new Set<string>();
  const posts: PostFeed[] = [];
  for (const liste of listes)
    for (const post of liste) {
      if (vus.has(post.id)) continue;
      vus.add(post.id);
      posts.push(post);
    }
  return posts.sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)).slice(0, max);
}

/** Curseur composite : un curseur opaque par réseau, en base64url. */
export type CurseursParReseau = Partial<Record<Reseau, string>>;

export function encoderCurseur(curseurs: CurseursParReseau): string | undefined {
  const utiles: CurseursParReseau = {};
  for (const reseau of RESEAUX) if (curseurs[reseau]) utiles[reseau] = curseurs[reseau];
  return Object.keys(utiles).length > 0 ? Buffer.from(JSON.stringify(utiles)).toString("base64url") : undefined;
}

export function decoderCurseur(brut: string | undefined): CurseursParReseau | null {
  if (!brut || brut.length > 4000) return null;
  try {
    const valeur: unknown = JSON.parse(Buffer.from(brut, "base64url").toString("utf8"));
    if (!valeur || typeof valeur !== "object" || Array.isArray(valeur)) return null;
    const sortie: CurseursParReseau = {};
    for (const reseau of RESEAUX) {
      const v = (valeur as Record<string, unknown>)[reseau];
      if (typeof v === "string" && v.length <= 2000) sortie[reseau] = v;
    }
    return sortie;
  } catch {
    return null;
  }
}

export * from "@rosegriffon/types/feed-normalisation";
