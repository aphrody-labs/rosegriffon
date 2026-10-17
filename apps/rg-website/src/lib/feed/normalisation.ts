// SPDX-License-Identifier: Apache-2.0
// Normalisation pure (sans réseau) de chaque réseau vers `PostFeed`, et fil unifié : fusion,
// dédoublonnage, tri par date, curseur composite. Aucun import serveur : testable avec des fixtures.
import type { XProfil, XTweet } from "./live";
import type { AuteurFeed, CompteSource, MediaFeed, PostFeed, ProfilFeed } from "./types";

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

// ── Dates portées par les identifiants ──────────────────────────────────────

/**
 * TikTok : l'identifiant d'une vidéo est un « snowflake » dont les 32 bits de poids fort sont
 * l'horodatage Unix en secondes. L'oEmbed ne donne pas de date : celle-ci est exacte, pas estimée.
 */
export function dateDepuisIdTiktok(id: string): string | null {
  if (!/^\d{15,22}$/.test(id)) return null;
  const secondes = Number(BigInt(id) >> 32n);
  const date = new Date(secondes * 1000);
  return secondes > 1_400_000_000 && date.getTime() < Date.now() + 86_400_000 ? date.toISOString() : null;
}

const ALPHABET_INSTAGRAM = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const EPOCH_INSTAGRAM_MS = 1_314_220_021_721n;

/**
 * Instagram : le shortcode est l'identifiant du média en base 64 ; ses bits de poids fort (après
 * 23 bits de fragment et de séquence) sont les millisecondes depuis le 24/08/2011.
 */
export function dateDepuisShortcode(code: string): string | null {
  if (!/^[A-Za-z0-9_-]{5,30}$/.test(code)) return null;
  let id = 0n;
  // Les shortcodes récents font 11 caractères ; au-delà, ce sont des suffixes de lien privé.
  for (const c of code.slice(0, 11)) id = id * 64n + BigInt(ALPHABET_INSTAGRAM.indexOf(c));
  const ms = Number((id >> 23n) + EPOCH_INSTAGRAM_MS);
  return ms > 1_300_000_000_000 && ms < Date.now() + 86_400_000 ? new Date(ms).toISOString() : null;
}

// ── Instagram ───────────────────────────────────────────────────────────────

export interface OembedInstagram {
  title?: string;
  author_name?: string;
  author_url?: string;
  thumbnail_url?: string;
  thumbnail_width?: number;
  thumbnail_height?: number;
}

export interface CreationInstagram {
  shortcode: string;
  permalink: string | null;
  auteur_pseudo: string | null;
  legende: string | null;
  images: unknown;
  publie_le: string | Date | null;
}

export const permalienInstagram = (code: string): string => `https://www.instagram.com/p/${code}/`;

function auteurInstagram(pseudo: string | null | undefined, nom?: string): AuteurFeed {
  const p = pseudo?.trim() || "instagram";
  return { pseudo: p, nom: nom?.trim() || p, lien: `https://www.instagram.com/${p}/` };
}

/** Création déposée par un membre (table `campagne_creations_instagram`) : image ré-hébergée. */
export function postDepuisCreationInstagram(c: CreationInstagram, urlImage: (chemin: string) => string): PostFeed {
  const images = Array.isArray(c.images)
    ? (c.images as Array<{ chemin?: string | null; largeur?: number; hauteur?: number }>)
    : [];
  const medias: MediaFeed[] = images
    .filter(i => typeof i.chemin === "string" && i.chemin.trim() !== "")
    .map(i => ({ type: "image", url: urlImage(i.chemin as string), largeur: i.largeur, hauteur: i.hauteur }));
  const publie = c.publie_le ? new Date(c.publie_le) : null;
  const date =
    publie && !Number.isNaN(publie.getTime())
      ? publie.toISOString()
      : (dateDepuisShortcode(c.shortcode) ?? new Date(0).toISOString());
  return {
    id: `instagram:${c.shortcode}`,
    idOrigine: c.shortcode,
    reseau: "instagram",
    auteur: auteurInstagram(c.auteur_pseudo),
    texte: c.legende ?? "",
    medias,
    date,
    lien: c.permalink ?? permalienInstagram(c.shortcode),
    compte: "rose_griffonfr",
    groupe: "Rose Griffon",
  };
}

/** Publication lue par l'oEmbed public d'Instagram (légende, auteur, vignette signée). */
export function postDepuisOembedInstagram(code: string, o: OembedInstagram, compte?: CompteSource): PostFeed | null {
  const date = dateDepuisShortcode(code);
  if (!date) return null;
  const pseudo = o.author_url?.match(/instagram\.com\/([A-Za-z0-9._]+)/)?.[1] ?? o.author_name;
  return {
    id: `instagram:${code}`,
    idOrigine: code,
    reseau: "instagram",
    auteur: auteurInstagram(pseudo, o.author_name),
    texte: o.title ?? "",
    medias: o.thumbnail_url
      ? [{ type: "image", url: o.thumbnail_url, largeur: o.thumbnail_width, hauteur: o.thumbnail_height }]
      : [],
    date,
    lien: permalienInstagram(code),
    integration: { url: `https://www.instagram.com/p/${code}/embed/`, ratio: 0.62, titre: "Publication Instagram" },
    compte: compte?.pseudo,
    groupe: compte?.groupe,
  };
}

// ── TikTok ──────────────────────────────────────────────────────────────────

export interface OembedTiktok {
  title?: string;
  author_url?: string;
  author_name?: string;
  thumbnail_url?: string;
  thumbnail_width?: number;
  thumbnail_height?: number;
}

const MOTIF_VIDEO_TIKTOK =
  /^https:\/\/(?:www\.)?tiktok\.com\/@([A-Za-z0-9._]{1,40})\/video\/(\d{15,22})\/?(?:[?#].*)?$/;

export function analyserVideoTiktok(url: string): { pseudo: string; id: string } | null {
  const m = MOTIF_VIDEO_TIKTOK.exec(url.trim());
  return m ? { pseudo: m[1]!, id: m[2]! } : null;
}

export function postDepuisOembedTiktok(pseudo: string, id: string, o: OembedTiktok, compte?: CompteSource): PostFeed | null {
  const date = dateDepuisIdTiktok(id);
  if (!date) return null;
  const lien = `https://www.tiktok.com/@${pseudo}/video/${id}`;
  return {
    id: `tiktok:${id}`,
    idOrigine: id,
    reseau: "tiktok",
    auteur: { pseudo, nom: o.author_name ?? pseudo, lien: `https://www.tiktok.com/@${pseudo}` },
    texte: o.title ?? "",
    medias: o.thumbnail_url
      ? [{ type: "video", url: lien, apercu: o.thumbnail_url, largeur: o.thumbnail_width, hauteur: o.thumbnail_height }]
      : [],
    date,
    lien,
    integration: { url: `https://www.tiktok.com/embed/v2/${id}`, ratio: 0.44, titre: "Vidéo TikTok" },
    compte: compte?.pseudo,
    groupe: compte?.groupe,
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
export type CurseursParReseau = Partial<Record<"x" | "instagram" | "tiktok", string>>;

export function encoderCurseur(curseurs: CurseursParReseau): string | undefined {
  const utiles: CurseursParReseau = {};
  for (const reseau of ["x", "instagram", "tiktok"] as const) if (curseurs[reseau]) utiles[reseau] = curseurs[reseau];
  return Object.keys(utiles).length > 0 ? Buffer.from(JSON.stringify(utiles)).toString("base64url") : undefined;
}

export function decoderCurseur(brut: string | undefined): CurseursParReseau | null {
  if (!brut || brut.length > 4000) return null;
  try {
    const valeur: unknown = JSON.parse(Buffer.from(brut, "base64url").toString("utf8"));
    if (!valeur || typeof valeur !== "object" || Array.isArray(valeur)) return null;
    const sortie: CurseursParReseau = {};
    for (const reseau of ["x", "instagram", "tiktok"] as const) {
      const v = (valeur as Record<string, unknown>)[reseau];
      if (typeof v === "string" && v.length <= 2000) sortie[reseau] = v;
    }
    return sortie;
  } catch {
    return null;
  }
}

/**
 * Profil public TikTok lu dans le JSON `__UNIVERSAL_DATA_FOR_REHYDRATION__` que la page
 * `tiktok.com/@pseudo` embarque pour un visiteur anonyme (bio, compteurs, avatar). La liste des
 * vidéos (`itemList`) y est vide : TikTok la charge par une API signée, illisible sans session.
 */
export function profilDepuisHtmlTiktok(html: string, pseudo: string): ProfilFeed | null {
  const m = /<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/.exec(html);
  if (!m?.[1]) return null;
  try {
    const donnees = JSON.parse(m[1]) as {
      __DEFAULT_SCOPE__?: {
        "webapp.user-detail"?: {
          userInfo?: {
            user?: {
              uniqueId?: string;
              nickname?: string;
              avatarLarger?: string;
              signature?: string;
              verified?: boolean;
              bioLink?: { link?: string };
            };
            stats?: { followerCount?: number; followingCount?: number; videoCount?: number };
          };
        };
      };
    };
    const info = donnees.__DEFAULT_SCOPE__?.["webapp.user-detail"]?.userInfo;
    const u = info?.user;
    if (!u?.uniqueId || u.uniqueId.toLowerCase() !== pseudo.toLowerCase()) return null;
    const lien = u.bioLink?.link?.trim();
    return {
      reseau: "tiktok",
      pseudo: u.uniqueId,
      nom: u.nickname ?? u.uniqueId,
      avatar: u.avatarLarger,
      bio: u.signature || undefined,
      site: lien ? { affichage: lien, url: /^https?:\/\//.test(lien) ? lien : `https://${lien}` } : undefined,
      abonnes: info?.stats?.followerCount,
      abonnements: info?.stats?.followingCount,
      publications: info?.stats?.videoCount,
      certifie: u.verified,
      lien: `https://www.tiktok.com/@${u.uniqueId}`,
    };
  } catch {
    return null;
  }
}
