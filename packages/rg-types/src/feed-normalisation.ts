// SPDX-License-Identifier: Apache-2.0
// Normaliseurs purs du Feed (aucun réseau, aucun accès disque) : chaque lecture d'un réseau, qu'elle
// vienne du site en direct ou du cron `feed:sync`, passe ici pour devenir un `PostFeed`.
import type { AuteurFeed, CompteSource, MediaFeed, PostFeed, ProfilFeed } from "./feed";

// ── Dates portées par les identifiants ──────────────────────────────────────

/**
 * TikTok : l'identifiant d'une vidéo est un « snowflake » dont les 32 bits de poids fort sont
 * l'horodatage Unix en secondes. Ni l'oEmbed ni l'embed ne donnent de date : celle-ci est exacte.
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

/** « 1 551 », « 1,2 k », « 3,4 M », « 12.5K » → nombre ; `undefined` si illisible. */
export function nombreAbrege(brut: string | undefined): number | undefined {
  if (!brut) return undefined;
  const m = /^\s*([\d\s  .,]+?)\s*([kKmM]?)\s*$/.exec(brut);
  if (!m?.[1]) return undefined;
  const suffixe = m[2]!.toLowerCase();
  let texte = m[1].replace(/[\s  ]/g, "");
  if (suffixe) texte = texte.replace(",", ".");
  else texte = texte.replace(/[.,]/g, "");
  const n = Number(texte);
  if (!Number.isFinite(n)) return undefined;
  return Math.round(n * (suffixe === "k" ? 1e3 : suffixe === "m" ? 1e6 : 1));
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

const integrationInstagram = (code: string) => ({
  url: `https://www.instagram.com/p/${code}/embed/`,
  ratio: 0.62,
  titre: "Publication Instagram",
});

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
    integration: integrationInstagram(code),
    compte: compte?.pseudo,
    groupe: compte?.groupe,
  };
}

/** Une vignette de la grille d'un profil Instagram, lue dans la page rendue par `Bun.WebView`. */
export interface ElementGrilleInstagram {
  href: string;
  image?: string;
  alt?: string;
}

const MOTIF_LIEN_INSTAGRAM = /\/(p|reel|tv)\/([A-Za-z0-9_-]{5,30})(?:[/?#]|$)/;

/**
 * Publication de la grille d'un profil. La grille ne porte ni légende ni auteur : `oembed`
 * (facultatif) les complète. La date vient du shortcode, donc exacte même sans légende.
 */
export function postDepuisGrilleInstagram(
  el: ElementGrilleInstagram,
  compte: CompteSource,
  oembed?: OembedInstagram,
): PostFeed | null {
  const m = MOTIF_LIEN_INSTAGRAM.exec(el.href);
  if (!m) return null;
  const code = m[2]!;
  const date = dateDepuisShortcode(code);
  if (!date) return null;
  const video = m[1] === "reel" || m[1] === "tv";
  const image = el.image && /^https:\/\//.test(el.image) ? el.image : undefined;
  return {
    id: `instagram:${code}`,
    idOrigine: code,
    reseau: "instagram",
    auteur: auteurInstagram(compte.pseudo, compte.nom),
    texte: oembed?.title ?? "",
    medias: image ? [{ type: video ? "video" : "image", url: video ? `https://www.instagram.com/reel/${code}/` : image, apercu: image }] : [],
    date,
    lien: video ? `https://www.instagram.com/reel/${code}/` : permalienInstagram(code),
    integration: integrationInstagram(code),
    compte: compte.pseudo,
    groupe: compte.groupe,
  };
}

/** En-tête d'un profil Instagram rendu : méta `og:*` et texte de l'en-tête. */
export interface PageProfilInstagram {
  ogDescription?: string;
  ogImage?: string;
  entete?: string;
}

/** « 483 followers, 26 suivis, 96 publications - … » (la langue dépend du navigateur). */
export function profilDepuisPageInstagram(p: PageProfilInstagram, compte: CompteSource): ProfilFeed {
  const d = p.ogDescription ?? "";
  const nombre = (mots: string) => nombreAbrege(new RegExp(`([\\d\\s\\u00a0\\u202f.,]+[kKmM]?)\\s*(?:${mots})`, "i").exec(d)?.[1]);
  // Lignes de l'en-tête : pseudo, abonnés, suivis, nom, pseudo, bio…
  const lignes = (p.entete ?? "").split("\n").map(l => l.trim()).filter(Boolean);
  const iPseudo = lignes.findIndex((l, i) => i > 0 && l.toLowerCase() === compte.pseudo.toLowerCase());
  const nom = iPseudo > 0 ? lignes[iPseudo - 1] : undefined;
  const bio = iPseudo > 0 ? lignes.slice(iPseudo + 1).join("\n") : undefined;
  return {
    reseau: "instagram",
    pseudo: compte.pseudo,
    nom: nom ?? compte.nom,
    avatar: p.ogImage && /^https:\/\//.test(p.ogImage) ? p.ogImage : undefined,
    bio: bio || undefined,
    abonnes: nombre("followers|abonn[ée]s"),
    abonnements: nombre("suivis|suivi\\(e\\)s|following|abonnements"),
    publications: nombre("publications|posts"),
    lien: `https://www.instagram.com/${compte.pseudo}/`,
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

const integrationTiktok = (id: string, ratio = 0.44) => ({
  url: `https://www.tiktok.com/embed/v2/${id}`,
  ratio,
  titre: "Vidéo TikTok",
});

export function postDepuisOembedTiktok(
  pseudo: string,
  id: string,
  o: OembedTiktok,
  compte?: CompteSource,
): PostFeed | null {
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
    integration: integrationTiktok(id),
    compte: compte?.pseudo,
    groupe: compte?.groupe,
  };
}

/**
 * Profil public TikTok lu dans le JSON `__UNIVERSAL_DATA_FOR_REHYDRATION__` de la page
 * `tiktok.com/@pseudo` (bio, compteurs, avatar). La liste des vidéos y est vide : elle vient de la
 * page d'embed du créateur, voir `lireEmbedTiktok`.
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

export interface LectureEmbedTiktok {
  posts: PostFeed[];
  profil: ProfilFeed | null;
  /** Lien MP4 signé (périssable) de chaque vidéo, par identifiant : sert à sonder et illustrer. */
  lectures: Record<string, string>;
}

interface VideoEmbedTiktok {
  id?: string;
  desc?: string;
  width?: number | string;
  height?: number | string;
  coverUrl?: string;
  originCoverUrl?: string;
  playAddr?: string;
  playCount?: number | string;
  privateItem?: boolean | string;
  authorUniqueId?: string;
}

const nombre = (v: unknown): number | undefined => {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : Number.NaN;
  return Number.isFinite(n) ? n : undefined;
};

/**
 * La page `tiktok.com/embed/@pseudo` (celle que charge l'embed « créateur » de l'oEmbed public)
 * embarque les ~10 dernières vidéos du compte, sans connexion : légende, dimensions, vignette,
 * lien MP4, vues. C'est la seule liste de vidéos lisible anonymement (la page du profil, elle,
 * est derrière un captcha).
 */
export function lireEmbedTiktok(html: string, compte: CompteSource): LectureEmbedTiktok | null {
  const m = /<script id="__FRONTITY_CONNECT_STATE__"[^>]*>([\s\S]*?)<\/script>/.exec(html);
  if (!m?.[1]) return null;
  try {
    const etat = JSON.parse(m[1]) as {
      source?: {
        data?: Record<
          string,
          {
            videoList?: VideoEmbedTiktok[];
            userInfo?: {
              uniqueId?: string;
              nickname?: string;
              avatarThumbUrl?: string;
              signature?: string;
              verified?: boolean | string;
              followerCount?: number | string;
              followingCount?: number | string;
            };
          }
        >;
      };
    };
    const donnees = Object.entries(etat.source?.data ?? {}).find(([cle]) => cle.toLowerCase().startsWith("/embed/@"))?.[1];
    if (!donnees) return null;
    const lectures: Record<string, string> = {};
    const posts: PostFeed[] = [];
    for (const v of donnees.videoList ?? []) {
      if (!v.id || v.privateItem === true || String(v.privateItem).toLowerCase() === "true") continue;
      const date = dateDepuisIdTiktok(v.id);
      if (!date) continue;
      const pseudo = v.authorUniqueId ?? compte.pseudo;
      const lien = `https://www.tiktok.com/@${pseudo}/video/${v.id}`;
      const largeur = nombre(v.width);
      const hauteur = nombre(v.height);
      const cover = v.coverUrl ?? v.originCoverUrl;
      if (v.playAddr) lectures[v.id] = v.playAddr;
      posts.push({
        id: `tiktok:${v.id}`,
        idOrigine: v.id,
        reseau: "tiktok",
        auteur: { pseudo, nom: donnees.userInfo?.nickname ?? compte.nom, lien: `https://www.tiktok.com/@${pseudo}` },
        texte: v.desc ?? "",
        medias: cover ? [{ type: "video", url: lien, apercu: cover, largeur, hauteur }] : [],
        date,
        metriques: { vues: nombre(v.playCount) },
        lien,
        integration: integrationTiktok(v.id, largeur && hauteur ? Math.min(largeur / hauteur, 0.6) : 0.44),
        compte: compte.pseudo,
        groupe: compte.groupe,
      });
    }
    const u = donnees.userInfo;
    return {
      posts,
      lectures,
      profil: u?.uniqueId
        ? {
            reseau: "tiktok",
            pseudo: u.uniqueId,
            nom: u.nickname ?? u.uniqueId,
            avatar: u.avatarThumbUrl,
            bio: u.signature || undefined,
            abonnes: nombre(u.followerCount),
            abonnements: nombre(u.followingCount),
            certifie: u.verified === true || String(u.verified).toLowerCase() === "true",
            lien: `https://www.tiktok.com/@${u.uniqueId}`,
          }
        : null,
    };
  } catch {
    return null;
  }
}

// ── YouTube ─────────────────────────────────────────────────────────────────

type Obj = Record<string, unknown>;
const lui = (v: unknown): Obj => (v && typeof v === "object" ? (v as Obj) : {});
const texte = (v: unknown): string =>
  typeof v === "string" ? v : typeof lui(v)["#text"] === "string" ? (lui(v)["#text"] as string) : "";

/**
 * Entrées d'un flux Atom YouTube déjà analysé par `Bun.XML.parse` (forme compacte, voir
 * docs/runtime/xml). Le flux public `feeds/videos.xml?channel_id=…` renvoie les 15 dernières
 * vidéos avec titre, description, date, vignette et nombre de vues, sans clé d'API.
 */
export function postsDepuisFluxYoutube(analyse: unknown, compte: CompteSource): { posts: PostFeed[]; profil: ProfilFeed | null } {
  const flux = lui(lui(analyse).feed);
  const entrees = [flux.entry ?? []].flat() as unknown[];
  const posts: PostFeed[] = [];
  for (const brute of entrees) {
    const e = lui(brute);
    const id = texte(e["yt:videoId"]);
    const date = new Date(texte(e.published));
    if (!/^[A-Za-z0-9_-]{11}$/.test(id) || Number.isNaN(date.getTime())) continue;
    const groupe = lui(e["media:group"]);
    const vignette = lui(groupe["media:thumbnail"]);
    const lien = texte(lui(e.link)["@href"]) || `https://www.youtube.com/watch?v=${id}`;
    const court = lien.includes("/shorts/");
    const titre = texte(e.title).trim();
    const description = texte(groupe["media:description"]).trim();
    const vues = nombre(lui(lui(groupe["media:community"])["media:statistics"])["@views"]);
    posts.push({
      id: `youtube:${id}`,
      idOrigine: id,
      reseau: "youtube",
      auteur: {
        pseudo: compte.pseudo,
        nom: texte(lui(e.author).name) || compte.nom,
        lien: `https://www.youtube.com/channel/${compte.pseudo}`,
      },
      texte: description ? `${titre}\n\n${description.slice(0, 240)}${description.length > 240 ? "…" : ""}` : titre,
      medias: [
        {
          type: "video",
          url: lien,
          apercu: texte(vignette["@url"]) || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
          largeur: nombre(vignette["@width"]),
          hauteur: nombre(vignette["@height"]),
        },
      ],
      date: date.toISOString(),
      metriques: { vues },
      lien,
      integration: { url: `https://www.youtube-nocookie.com/embed/${id}`, ratio: court ? 9 / 16 : 16 / 9, titre: "Vidéo YouTube" },
      compte: compte.pseudo,
      groupe: compte.groupe,
    });
  }
  const auteur = lui(flux.author);
  return {
    posts,
    profil: texte(flux.title)
      ? { reseau: "youtube", pseudo: compte.pseudo, nom: texte(flux.title), lien: `https://www.youtube.com/channel/${compte.pseudo}` }
      : texte(auteur.name)
        ? { reseau: "youtube", pseudo: compte.pseudo, nom: texte(auteur.name), lien: `https://www.youtube.com/channel/${compte.pseudo}` }
        : null,
  };
}

// ── TikTok, avec session ────────────────────────────────────────────────────

/**
 * Réponse JSON de `tiktok.com/api/post/item_list/`, captée par le cron dans la page du profil
 * quand une session (`FEED_TIKTOK_COOKIES`) lève le captcha. Forme connue de l'API web ; elle n'a
 * été exercée ici que sur des fixtures (aucune session disponible pour la vérifier en direct).
 */
export interface ItemListTiktok {
  itemList?: Array<{
    id?: string;
    desc?: string;
    createTime?: number | string;
    author?: { uniqueId?: string; nickname?: string };
    video?: { cover?: string; originCover?: string; width?: number; height?: number; duration?: number; playAddr?: string };
    stats?: { playCount?: number; diggCount?: number; commentCount?: number; shareCount?: number };
  }>;
  hasMore?: boolean;
}

export function postsDepuisItemListTiktok(
  json: ItemListTiktok,
  compte: CompteSource,
): { posts: PostFeed[]; lectures: Record<string, string> } {
  const posts: PostFeed[] = [];
  const lectures: Record<string, string> = {};
  for (const v of json.itemList ?? []) {
    if (!v.id) continue;
    const secondes = nombre(v.createTime);
    const date = secondes && secondes > 1_400_000_000 ? new Date(secondes * 1000).toISOString() : dateDepuisIdTiktok(v.id);
    if (!date) continue;
    const pseudo = v.author?.uniqueId ?? compte.pseudo;
    const lien = `https://www.tiktok.com/@${pseudo}/video/${v.id}`;
    const cover = v.video?.cover ?? v.video?.originCover;
    if (v.video?.playAddr) lectures[v.id] = v.video.playAddr;
    posts.push({
      id: `tiktok:${v.id}`,
      idOrigine: v.id,
      reseau: "tiktok",
      auteur: { pseudo, nom: v.author?.nickname ?? compte.nom, lien: `https://www.tiktok.com/@${pseudo}` },
      texte: v.desc ?? "",
      medias: cover
        ? [{ type: "video", url: lien, apercu: cover, largeur: v.video?.width, hauteur: v.video?.height, duree: v.video?.duration }]
        : [],
      date,
      metriques: {
        vues: v.stats?.playCount,
        jaime: v.stats?.diggCount,
        reponses: v.stats?.commentCount,
        partages: v.stats?.shareCount,
      },
      lien,
      integration: integrationTiktok(v.id, v.video?.width && v.video.height ? Math.min(v.video.width / v.video.height, 0.6) : 0.44),
      compte: compte.pseudo,
      groupe: compte.groupe,
    });
  }
  return { posts, lectures };
}

// ── Cookies de session (variables d'environnement du serveur) ───────────────

/** Cookie au format CDP `Network.CookieParam`. */
export interface CookieCdp {
  name: string;
  value: string;
  domain: string;
  path: string;
  secure: boolean;
  httpOnly: boolean;
}

/**
 * Lit `FEED_<RÉSEAU>_COOKIES` : soit une chaîne d'en-tête `nom=valeur; nom2=valeur2`, soit un
 * tableau JSON `[{ "name", "value", … }]` (export d'extension de navigateur). Jamais journalisé.
 */
export function cookiesDepuisEnv(brut: string | undefined, domaine: string): CookieCdp[] {
  const texte = brut?.trim();
  if (!texte) return [];
  const cookie = (name: string, value: string): CookieCdp => ({ name, value, domain: domaine, path: "/", secure: true, httpOnly: true });
  if (texte.startsWith("[")) {
    try {
      const liste = JSON.parse(texte) as Array<{ name?: unknown; value?: unknown; domain?: unknown }>;
      return liste
        .filter(c => typeof c.name === "string" && typeof c.value === "string" && c.name && c.value)
        .map(c => ({
          ...cookie(c.name as string, c.value as string),
          domain: typeof c.domain === "string" && c.domain.endsWith(domaine.replace(/^\./, "")) ? c.domain : domaine,
        }));
    } catch {
      return [];
    }
  }
  return texte
    .split(";")
    .map(p => p.trim())
    .filter(Boolean)
    .flatMap(p => {
      const i = p.indexOf("=");
      return i > 0 && i < p.length - 1 ? [cookie(p.slice(0, i).trim(), p.slice(i + 1).trim())] : [];
    });
}
