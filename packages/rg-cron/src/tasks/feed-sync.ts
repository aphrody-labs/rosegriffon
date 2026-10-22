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
 * PANNE ≠ VIDE : une source (ou un compte) qui échoue GARDE son instantané précédent (le Feed continue de servir
 * ce qu'il sait) et la tâche le consigne ; seule une source lue avec succès remplace le sien.
 * Une source en panne ne fait pas échouer les autres : le passage est un succès PARTIEL, et la
 * tâche n'échoue (alerte du runner) que si rien n'aboutit ou si une panne dure
 * (`SEUIL_ECHECS_DURABLES` passages d'affilée). Une limitation de débit (TikTok répond 429 à l'IP
 * du VPS) DIFFÈRE la source : plus relue avant `reprendreApres` (30 min, doublé, plafond 6 h),
 * état gardé dans `feed/etat-sync.json`.
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
import { estLimiteDebit, lireTiktok, lireYoutube } from "@rosegriffon/types/feed-lecture";
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

/**
 * Issue d'une source à ce passage :
 *  - `ok` : lue, instantané remplacé (certains comptes ont pu échouer : `comptesEnEchec`) ;
 *  - `differe` : limitée par le réseau (429), pas relue avant `reprendreApres` ; instantané gardé ;
 *  - `echec` : en panne, instantané précédent gardé.
 */
export type EtatSync = "ok" | "differe" | "echec";

export interface StatsReseauFeed {
  reseau: Reseau;
  /** Faux seulement pour `echec` (compatibilité des lecteurs de l'historique). */
  ok: boolean;
  etat: EtatSync;
  posts: number;
  vignettes: number;
  erreur?: string;
  /** Comptes du réseau illisibles à ce passage (leurs publications précédentes sont gardées). */
  comptesEnEchec?: string[];
  /** ISO 8601 : fin de l'attente imposée par une limitation de débit. */
  reprendreApres?: string;
}

export interface StatsFeedSync {
  /** Faux si aucune source n'a abouti, ou si une source échoue depuis trop de passages d'affilée. */
  success: boolean;
  /** Vrai si une source ou un compte a échoué ou a été différé : les autres ont tout de même été écrites. */
  partiel: boolean;
  reseaux: StatsReseauFeed[];
  dry: boolean;
  error?: string;
}

interface Resultat {
  posts: PostFeed[];
  profils: ProfilFeed[];
  statut: StatutSource;
}

/** Ce que rend la lecture d'un réseau. */
export interface LectureReseau extends Resultat {
  vignettes: number;
  /** Comptes illisibles (« nom : motif ») alors que d'autres du même réseau ont été lus. */
  comptesEnEchec?: string[];
}

export type LecteurReseau = (precedent: SnapshotFeed | null) => Promise<LectureReseau>;

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

/**
 * Reprend de l'instantané précédent les publications et profils des comptes illisibles à ce
 * passage : une chaîne YouTube ou un profil Instagram en panne ne disparaît pas du Feed.
 */
export function conserverComptesEnEchec(
  lu: { posts: PostFeed[]; profils: ProfilFeed[] },
  precedent: SnapshotFeed | null,
  comptes: readonly string[],
  max = MAX_POSTS,
): { posts: PostFeed[]; profils: ProfilFeed[] } {
  const enEchec = new Set(comptes);
  const ids = new Set(lu.posts.map(p => p.id));
  const repris = (precedent?.posts ?? []).filter(p => p.compte && enEchec.has(p.compte) && !ids.has(p.id));
  const pseudos = new Set(lu.profils.map(p => p.pseudo));
  const profils = [
    ...lu.profils,
    ...(precedent?.profils ?? []).filter(p => enEchec.has(p.pseudo) && !pseudos.has(p.pseudo)),
  ];
  if (repris.length === 0) return { posts: lu.posts, profils };
  const posts = [...lu.posts, ...repris].toSorted((a, b) => b.date.localeCompare(a.date));
  return { posts: posts.slice(0, Math.max(max, lu.posts.length)), profils };
}

// ─────────────────────────────────────────────────────────────────────────────
// Limitation de débit et échecs répétés
// ─────────────────────────────────────────────────────────────────────────────

/** Mémoire d'une source entre deux passages (fichier `feed/etat-sync.json` du bucket `assets`). */
export interface EtatSource {
  /** Passages d'affilée terminés en `echec` (une limitation de débit n'en est pas un). */
  echecs: number;
  /** Limitations de débit (429) d'affilée. */
  limites: number;
  /** ISO 8601 : ne pas relire la source avant. */
  reprendreApres?: string;
  motif?: string;
}

export type EtatsSources = Partial<Record<Reseau, EtatSource>>;

const CHEMIN_ETAT = "feed/etat-sync.json";
/** Attente après la première limitation, doublée à chaque suivante, plafonnée. */
export const ATTENTE_LIMITE_MIN_MS = 30 * 60_000;
export const ATTENTE_LIMITE_MAX_MS = 6 * 3600_000;
/**
 * Au-delà de ce nombre de passages d'affilée en échec (ou limités), la tâche échoue pour que
 * l'alerte du runner parte : une panne passagère est un succès partiel, une panne durable non.
 * Le cron passe toutes les 30 min : 6 échecs ≈ 3 h ; 6 limitations ≈ 14 h d'attente cumulée.
 */
export const SEUIL_ECHECS_DURABLES = 6;

/** Fin de l'attente après la `limites`-ième limitation d'affilée ; `Retry-After` si plus long. */
export function prochaineReprise(limites: number, maintenant: number, retryAfterMs?: number): number {
  const exponentielle = ATTENTE_LIMITE_MIN_MS * 2 ** Math.max(0, limites - 1);
  const attente = Math.min(ATTENTE_LIMITE_MAX_MS, exponentielle);
  return maintenant + Math.max(attente, Math.min(retryAfterMs ?? 0, ATTENTE_LIMITE_MAX_MS));
}

function lireEtats(valeur: unknown): EtatsSources {
  if (!valeur || typeof valeur !== "object") return {};
  const sortie: EtatsSources = {};
  for (const reseau of RESEAUX_SYNCHRONISES) {
    const e = (valeur as Record<string, Partial<EtatSource> | undefined>)[reseau];
    if (!e || typeof e !== "object") continue;
    sortie[reseau] = {
      echecs: Number(e.echecs) || 0,
      limites: Number(e.limites) || 0,
      reprendreApres: typeof e.reprendreApres === "string" ? e.reprendreApres : undefined,
      motif: typeof e.motif === "string" ? e.motif : undefined,
    };
  }
  return sortie;
}

/** `rg-core` est permanent : l'état vit en mémoire, et sur disque pour survivre à un redémarrage. */
let etatsMemoire: EtatsSources | null = null;

async function chargerEtats(): Promise<EtatsSources> {
  etatsMemoire ??= lireEtats(await lireJsonDisque(CHEMIN_ETAT).catch(() => null));
  return etatsMemoire;
}

/** Oublie l'état en mémoire (tests, ou relecture forcée depuis le disque). */
export function oublierEtatsSources(): void {
  etatsMemoire = null;
}

// ─────────────────────────────────────────────────────────────────────────────
// YouTube
// ─────────────────────────────────────────────────────────────────────────────

/** Le flux Atom répond 404/500 par intermittence : trois lectures espacées avant de conclure. */
const LECTURE_YOUTUBE = { essais: 3, pauseMs: 2000 } as const;

async function syncYoutube(precedent: SnapshotFeed | null): Promise<LectureReseau> {
  const connus = indexer(precedent);
  const lus = await Promise.allSettled(COMPTES_SOURCE_YOUTUBE.map(c => lireYoutube(c, LECTURE_YOUTUBE)));
  const ok = lus.flatMap(l => (l.status === "fulfilled" ? [l.value] : []));
  const enEchec = COMPTES_SOURCE_YOUTUBE.flatMap((c, i) => {
    const l = lus[i]!;
    return l.status === "rejected" ? [{ compte: c.pseudo, erreur: `${c.nom} : ${message(l.reason)}` }] : [];
  });
  if (ok.length === 0) throw new Error(enEchec.map(e => e.erreur).join(" ; "));
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
  // Une chaîne en panne garde ses vidéos de l'instantané précédent : panne ≠ vide, chaîne par chaîne.
  const fusion = conserverComptesEnEchec(
    { posts, profils: ok.flatMap(r => (r.profil ? [r.profil] : [])) },
    precedent,
    enEchec.map(e => e.compte),
  );
  return {
    ...fusion,
    statut: { reseau: "youtube", etat: fusion.posts.length > 0 ? "ok" : "vide" },
    vignettes,
    comptesEnEchec: enEchec.map(e => e.erreur),
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

async function syncTiktok(precedent: SnapshotFeed | null): Promise<LectureReseau> {
  const connus = indexer(precedent);
  const compte = COMPTES_SOURCE_TIKTOK[0]!;
  // 429 : `ErreurHttp` remonte telle quelle, la tâche diffère TikTok (voir `synchroniserFeed`).
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
    // Vignette d'origine illisible : image d'affiche tirée du MP4 déjà en mémoire, si on l'a
    // (et si le runtime a `Bun.Video` : sinon `afficheVideo` rend `null`). Jamais fatal au réseau.
    if (post.medias.length === 0 && mp4) {
      try {
        const affiche = await afficheVideo(mp4, VIGNETTE_9_16);
        if (affiche) {
          const chemin = cheminVignette("tiktok", brut.idOrigine);
          const ecrit = await televerserObjet("assets", chemin, affiche.octets.slice().buffer as ArrayBuffer, "image/webp");
          if (ecrit.ok) {
            post = { ...post, medias: [{ type: "video", url: brut.lien, apercu: urlAsset(chemin), largeur: affiche.largeur, hauteur: affiche.hauteur }] };
            vignettes++;
          }
        }
      } catch (err) {
        console.warn(`${PREFIXE} affiche TikTok ${brut.idOrigine} : ${message(err)}`);
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


/** Ouvre un onglet et y pose la session Instagram, si elle est fournie. */
async function ouvrirPageInstagram(): Promise<PageWebView> {
  const page = await PageWebView.connect();
  const cookies = cookiesDepuisEnv(Bun.env.FEED_INSTAGRAM_COOKIES, ".instagram.com");
  if (cookies.length > 0) await page.addCookies(cookies as unknown as Array<Record<string, unknown>>);
  return page;
}

async function lireProfilInstagram(page: PageWebView, compte: CompteSource): Promise<PageInstagram> {
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
}

async function syncInstagram(precedent: SnapshotFeed | null): Promise<LectureReseau> {
  const connus = indexer(precedent);
  let vignettes = 0;
  const posts: PostFeed[] = [];
  const profils: ProfilFeed[] = [];
  const enEchec: { compte: string; erreur: string }[] = [];
  let mur = 0;
  // UN onglet pour tous les comptes : fermer la dernière vue tue Chrome (`fermerVue`), et l'onglet
  // du compte suivant, ouvert dans la foulée, tombait sur le navigateur mourant (« WebView.navigate:
  // view is closed », un passage sur deux sur le VPS). Après une erreur, onglet neuf et un second essai.
  // Un compte à la fois : Instagram limite vite les lectures parallèles d'une même IP.
  let page: PageWebView | null = null;
  try {
    for (const compte of COMPTES_SOURCE_INSTAGRAM) {
      let lu: PageInstagram | null = null;
      for (let essai = 1; essai <= 2 && !lu; essai++) {
        try {
          page ??= await ouvrirPageInstagram();
          lu = await lireProfilInstagram(page, compte);
        } catch (err) {
          await page?.close().catch(() => undefined);
          page = null;
          if (essai === 2) enEchec.push({ compte: compte.pseudo, erreur: `${compte.pseudo} : ${message(err)}` });
          else console.warn(`${PREFIXE} Instagram ${compte.pseudo}, nouvel essai : ${message(err)}`);
        }
      }
      if (!lu) continue;
      profils.push(profilDepuisPageInstagram(lu, compte));
      if (lu.items.length === 0) {
        if (lu.mur) mur++;
        continue;
      }
      for (const el of lu.items.slice(0, MAX_POSTS)) {
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
  } finally {
    await page?.close().catch(() => undefined);
  }
  if (enEchec.length === COMPTES_SOURCE_INSTAGRAM.length) throw new Error(enEchec.map(e => e.erreur).join(" ; "));
  const comptesEnEchec = enEchec.map(e => e.erreur);
  if (posts.length === 0 && enEchec.length === 0 && mur === COMPTES_SOURCE_INSTAGRAM.length) {
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
  const fusion = conserverComptesEnEchec(
    { posts: posts.slice(0, MAX_POSTS), profils },
    precedent,
    enEchec.map(e => e.compte),
  );
  return {
    ...fusion,
    vignettes,
    comptesEnEchec,
    statut: { reseau: "instagram", etat: fusion.posts.length > 0 ? "ok" : "vide" },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Tâche
// ─────────────────────────────────────────────────────────────────────────────

const LECTEURS: Record<ReseauSynchronise, LecteurReseau> = {
  youtube: syncYoutube,
  tiktok: syncTiktok,
  instagram: syncInstagram,
};

/** Remplacements pour les tests : lecteurs factices, horloge fixe. */
export interface DependancesFeedSync {
  lecteurs?: Partial<Record<ReseauSynchronise, LecteurReseau>>;
  maintenant?: () => number;
}

/**
 * Bilan d'un passage. Une source en panne ou différée ne fait plus échouer la tâche : les autres
 * ont écrit leur instantané, c'est un succès PARTIEL (`partiel`, motifs dans `error`). La tâche
 * échoue quand rien n'a abouti, ou quand une panne dure (`durables`) : l'alerte du runner part.
 */
export function bilanFeedSync(
  reseaux: readonly StatsReseauFeed[],
  durables: readonly string[] = [],
): Pick<StatsFeedSync, "success" | "partiel" | "error"> {
  const motifs = [
    ...reseaux.flatMap(r => {
      if (r.etat === "echec") return [`${r.reseau} : ${r.erreur ?? "échec"}`];
      if (r.etat === "differe") return [`${r.reseau} : différé jusqu'à ${r.reprendreApres ?? "?"} (${r.erreur ?? "limité"})`];
      return (r.comptesEnEchec ?? []).map(c => `${r.reseau} : ${c}`);
    }),
    ...durables,
  ];
  const aboutis = reseaux.filter(r => r.etat !== "echec");
  return {
    success: aboutis.length > 0 && durables.length === 0,
    partiel: motifs.length > 0,
    error: motifs.length > 0 ? motifs.join(" ; ") : undefined,
  };
}

export async function synchroniserFeed(
  options: OptionsFeedSync = {},
  dependances: DependancesFeedSync = {},
): Promise<StatsFeedSync> {
  const dry = options.dry ?? false;
  const demande = options.reseau?.trim().toLowerCase();
  const cibles = RESEAUX_SYNCHRONISES.filter(r => !demande || r === demande);
  if (cibles.length === 0)
    return {
      success: false,
      partiel: false,
      reseaux: [],
      dry,
      error: `Réseau inconnu : ${demande} (youtube, tiktok, instagram)`,
    };

  const lecteurs = { ...LECTEURS, ...dependances.lecteurs };
  const horloge = dependances.maintenant ?? Date.now;
  // Un passage « dry » ne doit rien changer aux suivants : il travaille sur une copie de l'état.
  const etats: EtatsSources = dry ? structuredClone(await chargerEtats()) : await chargerEtats();
  const reseaux: StatsReseauFeed[] = [];
  const durables: string[] = [];

  for (const reseau of cibles) {
    const etat: EtatSource = etats[reseau] ?? { echecs: 0, limites: 0 };
    const maintenant = horloge();
    const reprise = etat.reprendreApres ? Date.parse(etat.reprendreApres) : Number.NaN;
    if (reprise > maintenant) {
      // Limitée au passage précédent : on ne la relit pas avant l'échéance (relire prolonge la limite).
      console.warn(`${PREFIXE} ${reseau} : différé jusqu'à ${etat.reprendreApres} (${etat.motif ?? "limité"})`);
      reseaux.push({ reseau, ok: true, etat: "differe", posts: 0, vignettes: 0, erreur: etat.motif, reprendreApres: etat.reprendreApres });
      if (etat.limites >= SEUIL_ECHECS_DURABLES) durables.push(`${reseau} : limité ${etat.limites} fois d'affilée`);
      continue;
    }
    try {
      const precedent = await lirePrecedent(reseau);
      const lu = await lecteurs[reseau](precedent);
      const snapshot: SnapshotFeed = {
        version: 1,
        reseau,
        genereLe: new Date(maintenant).toISOString(),
        posts: lu.posts,
        profils: lu.profils,
        statut: lu.statut,
      };
      if (!dry) await ecrireJson(CHEMIN_SNAPSHOT(reseau), snapshot);
      const comptes = lu.comptesEnEchec ?? [];
      console.log(
        `${PREFIXE} ${reseau} : ${lu.posts.length} publications, ${lu.vignettes} vignettes écrites${dry ? " (dry)" : ""}` +
          (comptes.length > 0 ? ` ; comptes en échec (publications précédentes gardées) : ${comptes.join(" ; ")}` : ""),
      );
      etats[reseau] = { echecs: 0, limites: 0 };
      reseaux.push({
        reseau,
        ok: true,
        etat: "ok",
        posts: lu.posts.length,
        vignettes: lu.vignettes,
        ...(comptes.length > 0 ? { comptesEnEchec: comptes } : {}),
      });
    } catch (err) {
      if (estLimiteDebit(err)) {
        // 429 : attendre, en doublant l'attente à chaque limitation d'affilée (`Retry-After` s'il est plus long).
        const limites = etat.limites + 1;
        const reprendreApres = new Date(prochaineReprise(limites, maintenant, err.reessayerApresMs)).toISOString();
        etats[reseau] = { echecs: etat.echecs, limites, reprendreApres, motif: message(err) };
        console.warn(`${PREFIXE} ${reseau} : ${message(err)} ; différé jusqu'à ${reprendreApres} (limitation n° ${limites})`);
        reseaux.push({ reseau, ok: true, etat: "differe", posts: 0, vignettes: 0, erreur: message(err), reprendreApres });
        if (limites >= SEUIL_ECHECS_DURABLES) durables.push(`${reseau} : limité ${limites} fois d'affilée`);
        continue;
      }
      // Panne ≠ vide : l'instantané précédent reste en place, on le consigne.
      const echecs = etat.echecs + 1;
      etats[reseau] = { echecs, limites: etat.limites, motif: message(err) };
      console.error(`${PREFIXE} ${reseau} : ${message(err)}`);
      reseaux.push({ reseau, ok: false, etat: "echec", posts: 0, vignettes: 0, erreur: message(err) });
      if (echecs >= SEUIL_ECHECS_DURABLES) durables.push(`${reseau} : en échec ${echecs} passages d'affilée`);
    }
  }

  if (!dry) {
    await ecrireJson(CHEMIN_ETAT, etats).catch(err => console.warn(`${PREFIXE} état non écrit : ${message(err)}`));
  }
  const bilan = bilanFeedSync(reseaux, durables);
  if (bilan.success && bilan.partiel) console.warn(`${PREFIXE} passage partiel : ${bilan.error}`);
  return { ...bilan, reseaux, dry };
}

if (import.meta.main) {
  const args = Bun.argv.slice(2);
  const resultat = await synchroniserFeed({ reseau: args.find(a => !a.startsWith("--")), dry: args.includes("--dry") });
  console.log(JSON.stringify(resultat, null, 2));
  process.exit(resultat.success ? 0 : 1);
}
