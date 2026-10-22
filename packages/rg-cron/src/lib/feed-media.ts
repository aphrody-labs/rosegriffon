/**
 * @license
 * Copyright 2026 Rose Griffon
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Médias du Feed : vignettes normalisées et ré-hébergées (`Bun.Image`), vidéos sondées (`Bun.Video`).
 *
 * POURQUOI : les URL d'images d'Instagram et de TikTok sont signées et expirent en quelques heures
 * (`x-expires`, `oe=`), comme celles de Discord (voir `storage-assets.ts`). Servir l'URL d'origine,
 * c'est afficher une vignette cassée le lendemain. Chaque vignette est donc recadrée, convertie en
 * WebP et copiée dans le bucket `assets` (`RG_MEDIA_ROOT` sur le VPS, sinon Storage), sous un chemin
 * déterminé par l'identifiant du post : relancer la synchronisation ne retélécharge rien.
 *
 * LIMITES RÉELLES (docs/runtime/image.mdx, docs/runtime/video.mdx du runtime) :
 *  - `Bun.Image` : JPEG, PNG, WebP en lecture/écriture sur toutes les plateformes ; HEIC/AVIF
 *    seulement macOS/Windows. `fit` ne connaît que `fill` et `inside` : il n'y a pas de recadrage
 *    « cover », le rectangle est donc calculé ici (`rectangleRecadrage`) puis passé à `extract`.
 *  - `Bun.Video` : MP4 H.264 (+ AAC) uniquement, décodeur FilmCraft ; entrée mémoire ≤ 256 MiB. Les
 *    lectures MP4 de TikTok sont signées et périssables : on les sonde au moment de la synchronisation
 *    (durée, dimensions) et on n'en garde que ces mesures, jamais l'URL. YouTube et Instagram ne
 *    donnent aucun MP4 téléchargeable sans session : `Bun.Video` n'y sert pas.
 *  - `Bun.Video` peut manquer (Bun 1.4.5 du VPS) : il est détecté (`moteurVideo`), jamais supposé.
 *    Sans lui, la sonde lit l'en-tête MP4 (`sonderMp4`) et l'image d'affiche est abandonnée.
 */

import { fichierMedia, objetPresent, televerserObjet } from "./storage-assets.js";

const BUCKET = "assets";
const MAX_IMAGE_OCTETS = 12 * 1024 * 1024;
export const MAX_VIDEO_OCTETS = 24 * 1024 * 1024;
const DELAI_TELECHARGEMENT_MS = 30_000;

export interface OptionsVignette {
  /** largeur / hauteur voulues (16/9, 1, 9/16…) */
  ratio: number;
  /** Largeur maximale de sortie, en pixels (jamais agrandie). */
  largeurMax: number;
  qualite?: number;
}

/** Rectangle centré qui a le ratio voulu, au plus grand possible dans l'image source. */
export function rectangleRecadrage(
  largeur: number,
  hauteur: number,
  ratio: number,
): { left: number; top: number; width: number; height: number } {
  const ratioSource = largeur / hauteur;
  if (ratioSource > ratio) {
    const width = Math.max(1, Math.round(hauteur * ratio));
    return { left: Math.floor((largeur - width) / 2), top: 0, width: Math.min(width, largeur), height: hauteur };
  }
  const height = Math.max(1, Math.round(largeur / ratio));
  return { left: 0, top: Math.floor((hauteur - height) / 2), width: largeur, height: Math.min(height, hauteur) };
}

/** Dimensions de sortie : largeur bornée, hauteur dérivée du ratio. */
export function dimensionsSortie(largeurRecadree: number, o: OptionsVignette): { largeur: number; hauteur: number } {
  const largeur = Math.max(1, Math.min(o.largeurMax, largeurRecadree));
  return { largeur, hauteur: Math.max(1, Math.round(largeur / o.ratio)) };
}

export interface VignetteNormalisee {
  octets: Uint8Array;
  largeur: number;
  hauteur: number;
}

/** Recadre au ratio voulu, borne la taille et encode en WebP. Rejette si l'image est illisible. */
export async function normaliserVignette(source: Uint8Array, o: OptionsVignette): Promise<VignetteNormalisee> {
  // maxPixels : garde-fou contre les images « bombes » (la source est un CDN tiers).
  const options = { maxPixels: 4096 * 4096 };
  const { width, height } = await new Bun.Image(source, options).metadata();
  const rect = rectangleRecadrage(width, height, o.ratio);
  const sortie = dimensionsSortie(rect.width, o);
  const octets = await new Bun.Image(source, options)
    .extract(rect)
    .resize(sortie.largeur, sortie.hauteur)
    .webp({ quality: o.qualite ?? 78 })
    .bytes();
  return { octets, ...sortie };
}

/** Téléchargement borné : refuse au-delà de `max` octets, que l'en-tête le dise ou non. */
export async function telechargerBorne(
  url: string,
  max: number,
  entetes: Record<string, string> = {},
): Promise<Uint8Array> {
  const reponse = await fetch(url, { headers: entetes, signal: AbortSignal.timeout(DELAI_TELECHARGEMENT_MS) });
  if (!reponse.ok) throw new Error(`HTTP ${reponse.status}`);
  const annonce = Number(reponse.headers.get("content-length") ?? 0);
  if (annonce > max) throw new Error(`Fichier trop gros (${annonce} octets)`);
  const flux = reponse.body;
  if (!flux) throw new Error("Réponse sans corps");
  const morceaux: Uint8Array[] = [];
  let total = 0;
  for await (const morceau of flux as unknown as AsyncIterable<Uint8Array>) {
    total += morceau.byteLength;
    if (total > max) throw new Error(`Fichier trop gros (> ${max} octets)`);
    morceaux.push(morceau);
  }
  const sortie = new Uint8Array(total);
  let decalage = 0;
  for (const m of morceaux) {
    sortie.set(m, decalage);
    decalage += m.byteLength;
  }
  return sortie;
}

/** URL publique relative d'un objet du bucket `assets` (même origine que le site, via nginx). */
export const urlAsset = (chemin: string): string => `/storage/v1/object/public/${BUCKET}/${chemin}`;

const SEGMENT_SUR = /[^A-Za-z0-9_-]/g;
/** Chemin déterministe d'une vignette : `feed/vignettes/<réseau>/<id>.webp`. */
export const cheminVignette = (reseau: string, id: string): string =>
  `feed/vignettes/${reseau.replace(SEGMENT_SUR, "")}/${id.replace(SEGMENT_SUR, "").slice(0, 64)}.webp`;

export interface ResultatVignette {
  url: string;
  largeur?: number;
  hauteur?: number;
  /** Vrai si l'objet existait déjà (rien n'a été téléchargé). */
  existante: boolean;
}

/**
 * Ré-héberge la vignette d'un post. Idempotent : si l'objet existe, il est réutilisé tel quel.
 * `null` quand la source est illisible ou expirée : l'appelant garde alors l'URL d'origine ou rien.
 */
export async function reheberger(
  reseau: string,
  id: string,
  urlSource: string,
  o: OptionsVignette,
  entetes: Record<string, string> = {},
): Promise<ResultatVignette | null> {
  const chemin = cheminVignette(reseau, id);
  if (await objetPresent(BUCKET, chemin)) return { url: urlAsset(chemin), existante: true };
  try {
    const brut = await telechargerBorne(urlSource, MAX_IMAGE_OCTETS, entetes);
    const vignette = await normaliserVignette(brut, o);
    const ecrit = await televerserObjet(BUCKET, chemin, vignette.octets.slice().buffer as ArrayBuffer, "image/webp");
    if (!ecrit.ok) {
      console.warn(`[Feed] vignette ${reseau}:${id} non écrite : ${ecrit.motif}`);
      return null;
    }
    return { url: urlAsset(chemin), largeur: vignette.largeur, hauteur: vignette.hauteur, existante: false };
  } catch (err) {
    console.warn(`[Feed] vignette ${reseau}:${id} illisible : ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

export interface MesuresVideo {
  duree?: number;
  largeur: number;
  hauteur: number;
  codec: string;
}

/** Ce que le Feed utilise de `Bun.Video` : de quoi le détecter et le remplacer dans les tests. */
export type MoteurVideo = typeof Bun.Video;

/**
 * `Bun.Video` quand le runtime l'a ET peut s'en servir, sinon `undefined`.
 *
 * Le binaire du VPS (Bun 1.4.5) n'expose pas `Bun.Video` du tout : lire `Bun.Video.available`
 * levait « undefined is not an object » et faisait tomber toute la synchronisation TikTok.
 */
export function moteurVideo(): MoteurVideo | undefined {
  const moteur = (Bun as { Video?: MoteurVideo }).Video;
  return typeof moteur === "function" && moteur.available ? moteur : undefined;
}

// ─────────────────────────────────────────────────────────────────────────────
// Sondage MP4 sans `Bun.Video` : lecture des boîtes ISO-BMFF (`moov` → `mvhd`, `tkhd`, `stsd`).
// Aucune image n'est décodée : durée, dimensions et codec sont écrits en clair dans l'en-tête.
// ─────────────────────────────────────────────────────────────────────────────

interface Boite {
  type: string;
  debut: number;
  fin: number;
}

/** Boîtes filles de `[debut, fin)` ; s'arrête à la première taille incohérente. */
function boites(vue: DataView, debut: number, fin: number): Boite[] {
  const sortie: Boite[] = [];
  let p = debut;
  while (p + 8 <= fin) {
    let taille = vue.getUint32(p);
    const type = String.fromCharCode(vue.getUint8(p + 4), vue.getUint8(p + 5), vue.getUint8(p + 6), vue.getUint8(p + 7));
    let entete = 8;
    if (taille === 1) {
      if (p + 16 > fin) break;
      taille = Number(vue.getBigUint64(p + 8));
      entete = 16;
    } else if (taille === 0) {
      taille = fin - p;
    }
    if (taille < entete || p + taille > fin) break;
    sortie.push({ type, debut: p + entete, fin: p + taille });
    p += taille;
  }
  return sortie;
}

const fille = (vue: DataView, b: Boite | undefined, type: string): Boite | undefined =>
  b ? boites(vue, b.debut, b.fin).find(x => x.type === type) : undefined;

/** Durée (`mvhd`) et piste vidéo (`hdlr` = `vide`) d'un MP4 en mémoire ; `null` si illisible. */
export function sonderMp4(mp4: Uint8Array): MesuresVideo | null {
  try {
    const vue = new DataView(mp4.buffer, mp4.byteOffset, mp4.byteLength);
    const moov = boites(vue, 0, mp4.byteLength).find(b => b.type === "moov");
    if (!moov) return null;
    let duree: number | undefined;
    const mvhd = fille(vue, moov, "mvhd");
    if (mvhd) {
      const version = vue.getUint8(mvhd.debut);
      const echelle = vue.getUint32(mvhd.debut + (version === 1 ? 20 : 12));
      const brute = version === 1 ? Number(vue.getBigUint64(mvhd.debut + 24)) : vue.getUint32(mvhd.debut + 16);
      if (echelle > 0 && brute > 0 && brute !== 0xffffffff) duree = Math.round((brute / echelle) * 10) / 10;
    }
    for (const trak of boites(vue, moov.debut, moov.fin).filter(b => b.type === "trak")) {
      const mdia = fille(vue, trak, "mdia");
      const hdlr = fille(vue, mdia, "hdlr");
      // hdlr : version/flags (4), pre_defined (4), handler_type (4).
      if (!hdlr || hdlr.debut + 12 > hdlr.fin) continue;
      const genre = String.fromCharCode(...mp4.subarray(hdlr.debut + 8, hdlr.debut + 12));
      if (genre !== "vide") continue;
      const tkhd = fille(vue, trak, "tkhd");
      if (!tkhd) continue;
      // tkhd : largeur et hauteur en virgule fixe 16.16, dans les 8 derniers octets.
      const largeur = vue.getUint32(tkhd.fin - 8) >>> 16;
      const hauteur = vue.getUint32(tkhd.fin - 4) >>> 16;
      if (largeur === 0 || hauteur === 0) continue;
      const stsd = fille(vue, fille(vue, fille(vue, mdia, "minf"), "stbl"), "stsd");
      // stsd : version/flags (4), nombre d'entrées (4), puis la première entrée (taille, type).
      const codec =
        stsd && stsd.debut + 16 <= stsd.fin ? String.fromCharCode(...mp4.subarray(stsd.debut + 12, stsd.debut + 16)) : "";
      return { duree, largeur, hauteur, codec };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Sonde un MP4 en mémoire (durée, dimensions, codec). `Bun.Video` quand le runtime l'a, sinon
 * lecture des boîtes de l'en-tête (`sonderMp4`) : la mesure ne dépend pas de la version de Bun.
 * `null` si ni l'un ni l'autre ne lit le fichier.
 */
export async function sonderVideo(mp4: Uint8Array, moteur: MoteurVideo | undefined = moteurVideo()): Promise<MesuresVideo | null> {
  if (moteur) {
    try {
      const m = await new moteur(mp4).metadata();
      return { duree: m.duration == null ? undefined : Math.round(m.duration * 10) / 10, largeur: m.width, hauteur: m.height, codec: m.codec };
    } catch {
      // Codec que FilmCraft ne décode pas (HEVC…) : l'en-tête reste lisible.
    }
  }
  return sonderMp4(mp4);
}

/**
 * Image d'affiche d'un MP4 (repli quand la source ne fournit pas de vignette), recadrée en WebP.
 * Exige un décodeur : sans `Bun.Video`, `null` (le post reste sans vignette, il n'échoue pas).
 */
export async function afficheVideo(
  mp4: Uint8Array,
  o: OptionsVignette,
  secondes = 1,
  moteur: MoteurVideo | undefined = moteurVideo(),
): Promise<VignetteNormalisee | null> {
  if (!moteur) return null;
  try {
    const mesures = await new moteur(mp4).metadata();
    const t = Math.min(secondes, Math.max(0, (mesures.duration ?? 2) / 2));
    const rect = rectangleRecadrage(mesures.width, mesures.height, o.ratio);
    const sortie = dimensionsSortie(rect.width, o);
    const octets = await new moteur(mp4)
      .frame(t)
      .extract(rect)
      .resize(sortie.largeur, sortie.hauteur)
      .webp({ quality: o.qualite ?? 78 })
      .bytes();
    return { octets, ...sortie };
  } catch {
    return null;
  }
}

/** Écrit un objet JSON dans le bucket `assets` (disque ou Storage). */
export async function ecrireJson(chemin: string, valeur: unknown): Promise<void> {
  const octets = new TextEncoder().encode(JSON.stringify(valeur));
  const ecrit = await televerserObjet(BUCKET, chemin, octets.slice().buffer as ArrayBuffer, "application/json");
  if (!ecrit.ok) throw new Error(`Écriture de ${chemin} impossible : ${ecrit.motif}`);
}

/** Relit un objet JSON du bucket `assets` quand il vit sur disque ; `null` sinon. */
export async function lireJsonDisque(chemin: string): Promise<unknown | null> {
  const fichier = fichierMedia(BUCKET, chemin);
  if (!fichier) return null;
  const f = Bun.file(fichier);
  return (await f.exists()) ? f.json().catch(() => null) : null;
}
