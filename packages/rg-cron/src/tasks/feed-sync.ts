/**
 * Copyright 2026 Rose Griffon
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * `feed:sync` — INSTANTANÉS DES SOURCES NON TEMPS RÉEL DU FEED (YouTube, TikTok, Instagram).
 *
 * X reste lu en direct par le site (CLI `aphrody x`, cache de 45 s). Les trois autres réseaux
 * ne changent pas à la seconde, et deux d'entre eux exigent des ressources que le site n'a pas
 * (navigateur, ré-hébergement d'images) : cette tâche les lit, normalise les vignettes, et écrit
 * un instantané JSON par réseau dans le bucket `assets` (`feed/snapshots/<réseau>.json`). Le site
 * lit l'instantané et sert instantanément ; s'il est absent ou périmé, YouTube et TikTok
 * retombent sur leur lecture directe, Instagram sur ses créations en base.
 *
 * SOURCES, par réseau (voir aussi l'en-tête de chaque source du site) :
 *  - YouTube : flux Atom public de chaque chaîne (`@rosegriffon/types/feed-lecture`). Vignettes
 *    4:3 avec bandes noires → recadrées en 16:9, WebP 640 px, ré-hébergées.
 *  - TikTok : page d'embed du créateur (≈ 10 dernières vidéos, sans session). Vignettes signées
 *    (périssables) → recadrées en 9:16 et ré-hébergées ; le MP4 signé est téléchargé UNE fois par
 *    vidéo nouvelle pour sonder durée/dimensions (`Bun.Video`) puis oublié. Avec
 *    `FEED_TIKTOK_COOKIES`, la page du profil est ouverte dans `Bun.WebView` et la réponse JSON
 *    `api/post/item_list` captée (`Network.responseReceived` + `Network.getResponseBody`) :
 *    plus de vidéos, avec likes et commentaires. Sans session, la page du profil est derrière un
 *    captcha : on ne le contourne pas.
 *  - Instagram : la grille publique du profil, rendue par `Bun.WebView` (un `fetch` reçoit 429),
 *    lue dans le DOM ; légende et auteur via l'oEmbed public ; vignettes signées → carrées 1:1
 *    et ré-hébergées. Les requêtes GraphQL de la page répondent « Unauthorized logged out
 *    query » : sans session, ni likes, ni commentaires, ni suite de la grille. Avec
 *    `FEED_INSTAGRAM_COOKIES`, les cookies sont posés par `Network.setCookies` avant la navigation.
 *
 * VARIABLES D'ENVIRONNEMENT (serveur du cron, jamais dans le dépôt) :
 *  - `FEED_INSTAGRAM_COOKIES`, `FEED_TIKTOK_COOKIES` : session d'un compte, en-tête `a=b; c=d` ou
 *    tableau JSON d'export de navigateur. Facultatives ; jamais journalisées.
 *  - `RG_MEDIA_ROOT`, `RG_MEDIA_PUBLIC_ORIGIN` : voir `lib/storage-assets.ts`.
 *  - `BUN_CHROME_PATH` : Chrome pour `Bun.WebView` (sinon celui du système).
 *
 * PANNE ≠ VIDE : une source qui échoue GARDE son instantané précédent (le Feed continue de servir
 * ce qu'il sait) et la tâche le consigne ; seule une source lue avec succès remplace le sien.
 *
 * Usage : bun packages/cron/src/tasks/feed-sync.ts [youtube|tiktok|instagram] [--dry]
 */

import {
  COMPTES_SOURCE_INSTAGRAM,
  COMPTES_SOURCE_TIKTOK,
  COMPTES_SOURCE_YOUTUBE,
} from "@rosegriffon/types/feed-comptes";
import { CHEMIN_SNAPSHOT, lireSnapshot } from "@rosegriffon/types/feed";
import type { CompteSource, PostFeed, ProfilFeed, Reseau, SnapshotFeed, StatutSource } from "@rosegriffon/types/feed";
import { lireTiktok, lireYoutube } from "@rosegriffon/types/feed-lecture";
import {
  cookiesDepuisEnv,
  postDepuisGrilleInstagram,
  postsDepuisItemListTiktok,
  profilDepuisPageInstagram,
} from "@rosegriffon/types/feed-normalisation";
import type { ElementGrilleInstagram, ItemListTiktok, OembedInstagram } from "@rosegriffon/types/feed-normalisation";

import {
  afficheVideo,
  ecrireJson,
  lireJsonDisque,
  MAX_VIDEO_OCTETS,
  reheberger,
  sonderVideo,
  telechargerBorne,
  urlAsset,
  cheminVignette,
} from "../lib/feed-media.js";
import { televerserObjet } from "../lib/storage-assets.js";
import { fermerVue, naviguer, ouvrirVue, PageWebView } from "../lib/webview.js";

const PREFIXE = "[Feed sync]";

const RESEAUX_SYNCHRONISES = ["youtube", "tiktok", "instagram"] as const;
type ReseauSynchronise = (typeof RESEAUX_SYNCHRONISES)[number];

/** Au plus ce nombre de publications conservées par réseau. */
const MAX_POSTS = 40;

export interface OptionsFeedSync {
  /** Un seul réseau (`youtube`, `tiktok`, `instagram`) ; défaut : les trois. */
  reseau?: string;
  /** Lit et normalise, n'écrit rien. */
  dry?: boolean;
}

export interface StatsReseauFeed {
  reseau: Reseau;
  ok: boolean;
  posts: number;
  vignettes: number;
  erreur?: string;
}

export interface StatsFeedSync {
  success: boolean;
  reseaux: StatsReseauFeed[];
  dry: boolean;
  error?: string;
}

interface Resultat {
  posts: PostFeed[];
  profils: ProfilFeed[];
  statut: StatutSource;
}

const message = (err: unknown): string => (err instanceof Error ? err.message : String(err));
const pause = (ms: number) => Bun.sleep(ms);

// ─────────────────────────────────────────────────────────────────────────────
// Vignettes
// ─────────────────────────────────────────────────────────────────────────────

const VIGNETTE_16_9 = { ratio: 16 / 9, largeurMax: 640 } as const;
const VIGNETTE_CARREE = { ratio: 1, largeurMax: 640 } as const;
const VIGNETTE_9_16 = { ratio: 9 / 16, largeurMax: 360 } as const;

/** Remplace l'URL d'aperçu des médias d'un post par la vignette ré-hébergée ; compte celles écrites. */
async function rehebergerPost(
  post: PostFeed,
  precedent: PostFeed | undefined,
  options: typeof VIGNETTE_16_9 | typeof VIGNETTE_CARREE | typeof VIGNETTE_9_16,
  entetes: Record<string, string> = {},
): Promise<{ post: PostFeed; ecrites: number }> {
  const media = post.medias[0];
  const source = media?.apercu ?? (media?.type === "image" ? media.url : undefined);
  if (!media || !source) return { post, ecrites: 0 };
  // Déjà ré-hébergée à une synchronisation précédente : on garde le résultat, l'URL d'origine est périmée.
  const ancien = precedent?.medias[0];
  if (ancien?.apercu?.startsWith("/storage/")) {
    return { post: { ...post, medias: [{ ...media, ...ancien }, ...post.medias.slice(1)] }, ecrites: 0 };
  }
  const resultat = await reheberger(post.reseau, post.idOrigine, source, options, entetes);
  if (!resultat) {
    // Source expirée ou illisible : mieux vaut pas de vignette qu'une vignette qui cassera.
    return { post: { ...post, medias: [] }, ecrites: 0 };
  }
  const nouveau = {
    ...media,
    apercu: resultat.url,
    url: media.type === "image" ? resultat.url : media.url,
    largeur: resultat.largeur ?? media.largeur,
    hauteur: resultat.hauteur ?? media.hauteur,
  };
  return { post: { ...post, medias: [nouveau, ...post.medias.slice(1)] }, ecrites: resultat.existante ? 0 : 1 };
}

// ─────────────────────────────────────────────────────────────────────────────
// Instantanés
// ─────────────────────────────────────────────────────────────────────────────

async function lirePrecedent(reseau: Reseau): Promise<SnapshotFeed | null> {
  return lireSnapshot(await lireJsonDisque(CHEMIN_SNAPSHOT(reseau)), reseau);
}

function indexer(snapshot: SnapshotFeed | null): Map<string, PostFeed> {
  return new Map((snapshot?.posts ?? []).map(p => [p.id, p]));
}

// ─────────────────────────────────────────────────────────────────────────────
// YouTube
// ─────────────────────────────────────────────────────────────────────────────

async function syncYoutube(precedent: SnapshotFeed | null): Promise<Resultat & { vignettes: number }> {
  const connus = indexer(precedent);
  const lus = await Promise.allSettled(COMPTES_SOURCE_YOUTUBE.map(c => lireYoutube(c)));
  const ok = lus.flatMap(l => (l.status === "fulfilled" ? [l.value] : []));
  if (ok.length === 0) throw new Error(lus.map(l => (l.status === "rejected" ? message(l.reason) : "")).join(" ; "));
  let vignettes = 0;
  const posts: PostFeed[] = [];
  for (const brut of ok.flatMap(r => r.posts)) {
    const id = brut.idOrigine;
    const court = brut.lien.includes("/shorts/");
    // `hqdefault` (4:3) porte des bandes noires, et pour un Short la vidéo verticale au centre.
    // Les Shorts ont une image verticale propre (`oardefault`, 1080×1920) ; les autres vidéos
    // `maxresdefault` (16:9), absente de certaines : repli sur `hqdefault` recadrée.
    const candidates = court
      ? [`https://i.ytimg.com/vi/${id}/oardefault.jpg`]
      : [`https://i.ytimg.com/vi/${id}/maxresdefault.jpg`, `https://i.ytimg.com/vi/${id}/hqdefault.jpg`];
    const options = court ? VIGNETTE_9_16 : VIGNETTE_16_9;
    let retenu: { post: PostFeed; ecrites: number } = { post: { ...brut, medias: [] }, ecrites: 0 };
    for (const url of candidates) {
      const media = { ...brut.medias[0]!, apercu: url };
      retenu = await rehebergerPost({ ...brut, medias: [media] }, connus.get(brut.id), options);
      if (retenu.post.medias.length > 0) break;
    }
    vignettes += retenu.ecrites;
    // YouTube garde des vignettes stables : sans copie, on retombe sur l'URL publique d'origine.
    posts.push(retenu.post.medias.length > 0 ? retenu.post : { ...retenu.post, medias: brut.medias });
  }
  return {
    posts,
    profils: ok.flatMap(r => (r.profil ? [r.profil] : [])),
    statut: { reseau: "youtube", etat: posts.length > 0 ? "ok" : "vide" },
    vignettes,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// TikTok
// ─────────────────────────────────────────────────────────────────────────────

/** Capte la réponse JSON `api/post/item_list` de la page du profil, avec la session fournie. */
async function lireItemListTiktok(compte: CompteSource): Promise<{ posts: PostFeed[]; lectures: Record<string, string> } | null> {
  const cookies = cookiesDepuisEnv(Bun.env.FEED_TIKTOK_COOKIES, ".tiktok.com");
  if (cookies.length === 0) return null;
  const vue = ouvrirVue({ largeur: 1280, hauteur: 900 });
  try {
    // La session CDP naît à la première navigation (docs/runtime/webview, « Raw Chrome DevTools Protocol »).
    await vue.navigate("about:blank");
    await vue.cdp("Network.enable");
    await vue.cdp("Network.setCookies", { cookies });
    const requetes: string[] = [];
    vue.addEventListener("Network.responseReceived", (e: Event) => {
      const data = (e as unknown as { data: { requestId: string; response: { url: string } } }).data;
      if (data.response.url.includes("/api/post/item_list")) requetes.push(data.requestId);
    });
    await naviguer(vue, `https://www.tiktok.com/@${compte.pseudo}`);
    for (let i = 0; i < 20 && requetes.length === 0; i++) await pause(500);
    const posts: PostFeed[] = [];
    const lectures: Record<string, string> = {};
    for (const requestId of requetes) {
      const corps = (await vue.cdp("Network.getResponseBody", { requestId })) as { body?: string };
      if (!corps.body) continue;
      const lu = postsDepuisItemListTiktok(JSON.parse(corps.body) as ItemListTiktok, compte);
      posts.push(...lu.posts);
      Object.assign(lectures, lu.lectures);
    }
    return posts.length > 0 ? { posts, lectures } : null;
  } finally {
    fermerVue(vue);
  }
}

async function syncTiktok(precedent: SnapshotFeed | null): Promise<Resultat & { vignettes: number }> {
  const connus = indexer(precedent);
  const compte = COMPTES_SOURCE_TIKTOK[0]!;
  const embed = await lireTiktok(compte);
  let session: Awaited<ReturnType<typeof lireItemListTiktok>> = null;
  try {
    session = await lireItemListTiktok(compte);
  } catch (err) {
    console.warn(`${PREFIXE} TikTok avec session : ${message(err)}`);
  }
  const lectures = { ...embed.lectures, ...session?.lectures };
  const parId = new Map<string, PostFeed>();
  for (const p of [...embed.posts, ...(session?.posts ?? [])]) parId.set(p.id, { ...parId.get(p.id), ...p });

  let vignettes = 0;
  const posts: PostFeed[] = [];
  for (const brut of parId.values()) {
    const ancien = connus.get(brut.id);
    let post = { ...brut };
    // MP4 : seulement pour une vidéo jamais mesurée (durée absente) ; l'URL signée n'est pas conservée.
    let mp4: Uint8Array | null = null;
    const duree = ancien?.medias[0]?.duree ?? post.medias[0]?.duree;
    if (duree === undefined && lectures[brut.idOrigine]) {
      try {
        mp4 = await telechargerBorne(lectures[brut.idOrigine]!, MAX_VIDEO_OCTETS, { Referer: "https://www.tiktok.com/" });
        const m = await sonderVideo(mp4);
        if (m && post.medias[0]) post.medias[0] = { ...post.medias[0], duree: m.duree, largeur: m.largeur, hauteur: m.hauteur };
      } catch (err) {
        console.warn(`${PREFIXE} MP4 TikTok ${brut.idOrigine} : ${message(err)}`);
      }
    } else if (duree !== undefined && post.medias[0]) {
      post.medias[0] = { ...post.medias[0], duree };
    }
    const r = await rehebergerPost(post, ancien, VIGNETTE_9_16);
    vignettes += r.ecrites;
    post = r.post;
    // Vignette d'origine illisible : image d'affiche tirée du MP4 déjà en mémoire, si on l'a.
    if (post.medias.length === 0 && mp4) {
      const affiche = await afficheVideo(mp4, VIGNETTE_9_16);
      if (affiche) {
        const chemin = cheminVignette("tiktok", brut.idOrigine);
        const ecrit = await televerserObjet("assets", chemin, affiche.octets.slice().buffer as ArrayBuffer, "image/webp");
        if (ecrit.ok) {
          post = { ...post, medias: [{ type: "video", url: brut.lien, apercu: urlAsset(chemin), largeur: affiche.largeur, hauteur: affiche.hauteur }] };
          vignettes++;
        }
      }
    }
    posts.push(post);
  }
  posts.sort((a, b) => b.date.localeCompare(a.date));
  const profil = embed.profilPage ?? embed.profil;
  return {
    posts: posts.slice(0, MAX_POSTS),
    profils: profil ? [profil] : [],
    statut: { reseau: "tiktok", etat: posts.length > 0 ? "ok" : "vide" },
    vignettes,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Instagram
// ─────────────────────────────────────────────────────────────────────────────

const SCRIPT_PROFIL_INSTAGRAM = `(() => ({
  ogDescription: document.querySelector('meta[property="og:description"]')?.content ?? "",
  ogImage: document.querySelector('meta[property="og:image"]')?.content ?? "",
  entete: document.querySelector('header')?.innerText ?? "",
  mur: !!document.querySelector('input[name="username"]'),
  items: [...document.querySelectorAll('a[href*="/p/"], a[href*="/reel/"]')]
    .filter(a => a.querySelector('img'))
    .map(a => ({ href: a.getAttribute('href') ?? "", image: a.querySelector('img').src, alt: a.querySelector('img').alt ?? "" })),
}))()`;

interface PageInstagram {
  ogDescription: string;
  ogImage: string;
  entete: string;
  mur: boolean;
  items: ElementGrilleInstagram[];
}

async function lireOembedInstagram(code: string): Promise<OembedInstagram | null> {
  const reponse = await fetch(
    `https://www.instagram.com/api/v1/oembed/?omitscript=true&url=${encodeURIComponent(`https://www.instagram.com/p/${code}/`)}`,
    { headers: { "User-Agent": "Mozilla/5.0 (compatible; RoseGriffonFeed/1.0)" }, signal: AbortSignal.timeout(8000) },
  ).catch(() => null);
  return reponse?.ok ? ((await reponse.json().catch(() => null)) as OembedInstagram | null) : null;
}

async function lireProfilInstagram(compte: CompteSource): Promise<PageInstagram> {
  const page = await PageWebView.connect();
  try {
    const cookies = cookiesDepuisEnv(Bun.env.FEED_INSTAGRAM_COOKIES, ".instagram.com");
    if (cookies.length > 0) await page.addCookies(cookies as unknown as Array<Record<string, unknown>>);
    await page.goto(`https://www.instagram.com/${compte.pseudo}/`);
    const vues = new Map<string, ElementGrilleInstagram>();
    let derniere: PageInstagram | null = null;
    // La grille se peuple après le rendu ; deux défilements ramènent la suite quand la session l'autorise.
    for (let tour = 0; tour < 3; tour++) {
      for (let i = 0; i < 24; i++) {
        derniere = await page.evaluate<PageInstagram>(SCRIPT_PROFIL_INSTAGRAM);
        if (derniere.items.length > 0 || derniere.mur) break;
        await pause(500);
      }
      if (!derniere) break;
      for (const el of derniere.items) vues.set(el.href, el);
      if (derniere.mur || derniere.items.length === 0) break;
      await page.evaluate("window.scrollTo(0, document.body.scrollHeight)");
      await pause(1500);
    }
    if (!derniere) throw new Error("Page Instagram vide");
    return { ...derniere, items: [...vues.values()] };
  } finally {
    await page.close();
  }
}

async function syncInstagram(precedent: SnapshotFeed | null): Promise<Resultat & { vignettes: number }> {
  const connus = indexer(precedent);
  let vignettes = 0;
  const posts: PostFeed[] = [];
  const profils: ProfilFeed[] = [];
  let mur = 0;
  // Un navigateur à la fois : Instagram limite vite les lectures parallèles d'une même IP.
  for (const compte of COMPTES_SOURCE_INSTAGRAM) {
    const page = await lireProfilInstagram(compte);
    profils.push(profilDepuisPageInstagram(page, compte));
    if (page.items.length === 0) {
      if (page.mur) mur++;
      continue;
    }
    for (const el of page.items.slice(0, MAX_POSTS)) {
      const ancien = connus.get(`instagram:${el.href.match(/\/(?:p|reel|tv)\/([A-Za-z0-9_-]+)/)?.[1]}`);
      // Légende : déjà connue, sinon oEmbed (une requête par nouveauté, jamais par passage).
      const code = el.href.match(/\/(?:p|reel|tv)\/([A-Za-z0-9_-]+)/)?.[1];
      const oembed = ancien?.texte || !code ? undefined : ((await lireOembedInstagram(code)) ?? undefined);
      if (!ancien?.texte && code) await pause(300);
      const brut = postDepuisGrilleInstagram(el, compte, oembed);
      if (!brut) continue;
      const r = await rehebergerPost({ ...brut, texte: ancien?.texte || brut.texte }, ancien, VIGNETTE_CARREE);
      vignettes += r.ecrites;
      posts.push(r.post);
    }
  }
  if (posts.length === 0 && mur === COMPTES_SOURCE_INSTAGRAM.length) {
    return {
      posts: [],
      profils,
      vignettes,
      statut: {
        reseau: "instagram",
        etat: "vide",
        message: "Instagram demande une connexion pour afficher ce profil : aucune publication n'est lisible pour le moment.",
      },
    };
  }
  posts.sort((a, b) => b.date.localeCompare(a.date));
  return {
    posts: posts.slice(0, MAX_POSTS),
    profils,
    vignettes,
    statut: { reseau: "instagram", etat: posts.length > 0 ? "ok" : "vide" },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Tâche
// ─────────────────────────────────────────────────────────────────────────────

const LECTEURS: Record<ReseauSynchronise, (p: SnapshotFeed | null) => Promise<Resultat & { vignettes: number }>> = {
  youtube: syncYoutube,
  tiktok: syncTiktok,
  instagram: syncInstagram,
};

export async function synchroniserFeed(options: OptionsFeedSync = {}): Promise<StatsFeedSync> {
  const dry = options.dry ?? false;
  const demande = options.reseau?.trim().toLowerCase();
  const cibles = RESEAUX_SYNCHRONISES.filter(r => !demande || r === demande);
  if (cibles.length === 0)
    return { success: false, reseaux: [], dry, error: `Réseau inconnu : ${demande} (youtube, tiktok, instagram)` };

  const reseaux: StatsReseauFeed[] = [];
  for (const reseau of cibles) {
    try {
      const precedent = await lirePrecedent(reseau);
      const lu = await LECTEURS[reseau](precedent);
      const snapshot: SnapshotFeed = {
        version: 1,
        reseau,
        genereLe: new Date().toISOString(),
        posts: lu.posts,
        profils: lu.profils,
        statut: lu.statut,
      };
      if (!dry) await ecrireJson(CHEMIN_SNAPSHOT(reseau), snapshot);
      console.log(`${PREFIXE} ${reseau} : ${lu.posts.length} publications, ${lu.vignettes} vignettes écrites${dry ? " (dry)" : ""}`);
      reseaux.push({ reseau, ok: true, posts: lu.posts.length, vignettes: lu.vignettes });
    } catch (err) {
      // Panne ≠ vide : l'instantané précédent reste en place, on le consigne.
      console.error(`${PREFIXE} ${reseau} : ${message(err)}`);
      reseaux.push({ reseau, ok: false, posts: 0, vignettes: 0, erreur: message(err) });
    }
  }
  const echecs = reseaux.filter(r => !r.ok);
  return {
    success: echecs.length === 0,
    reseaux,
    dry,
    error: echecs.length > 0 ? echecs.map(e => `${e.reseau} : ${e.erreur}`).join(" ; ") : undefined,
  };
}

if (import.meta.main) {
  const args = Bun.argv.slice(2);
  const resultat = await synchroniserFeed({ reseau: args.find(a => !a.startsWith("--")), dry: args.includes("--dry") });
  console.log(JSON.stringify(resultat, null, 2));
  process.exit(resultat.success ? 0 : 1);
}
