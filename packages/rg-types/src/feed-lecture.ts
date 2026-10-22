// SPDX-License-Identifier: Apache-2.0
// Lectures réseau du Feed qui ne demandent ni clé, ni session, ni navigateur : un simple `fetch`.
// Partagées par le cron `feed:sync` (qui en fait des instantanés) et par le site (repli en direct
// quand l'instantané est absent ou périmé).
//
//  - YouTube : flux Atom public `youtube.com/feeds/videos.xml?channel_id=UC…` (15 dernières vidéos),
//    analysé par `Bun.XML.parse`. Le flux répond par intermittence 404 ou 500 pour une chaîne qui
//    existe (relevé sur le VPS, octobre 2026 : deux lectures sur trois en échec certaines heures,
//    200 quelques secondes plus tard) : le cron relit donc avant de conclure (`essais`).
//  - TikTok : page d'embed `tiktok.com/embed/@pseudo` (≈ 10 dernières vidéos, lien MP4 signé inclus)
//    et page du profil (bio, compteurs, lien du site). TikTok limite l'IP du VPS (429) : l'erreur
//    porte son statut (`ErreurHttp`) pour que le cron diffère la source au lieu d'échouer.
// Instagram n'a pas d'équivalent sans navigateur : voir `tasks/feed-sync` du cron (`Bun.WebView`).
import type { CompteSource, ProfilFeed } from "./feed";
import {
  lireEmbedTiktok,
  postsDepuisFluxYoutube,
  profilDepuisHtmlTiktok,
  type LectureEmbedTiktok,
} from "./feed-normalisation";

export const AGENT_FEED =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

/** Réponse HTTP non 2xx d'une source : le statut et l'éventuel `Retry-After` restent lisibles. */
export class ErreurHttp extends Error {
  readonly statut: number;
  /** Délai demandé par `Retry-After`, en millisecondes, quand l'en-tête est présent et lisible. */
  readonly reessayerApresMs?: number;

  constructor(statut: number, url: string, reessayerApresMs?: number) {
    super(`HTTP ${statut} : ${url.split("?")[0]}`);
    this.name = "ErreurHttp";
    this.statut = statut;
    this.reessayerApresMs = reessayerApresMs;
  }
}

/** Vrai pour une limitation de débit (429) : la source n'est pas en panne, elle demande d'attendre. */
export const estLimiteDebit = (err: unknown): err is ErreurHttp => err instanceof ErreurHttp && err.statut === 429;

/** `Retry-After` en millisecondes : secondes ou date HTTP ; `undefined` si absent ou illisible. */
export function delaiRetryAfter(valeur: string | null, maintenant = Date.now()): number | undefined {
  if (!valeur) return undefined;
  const secondes = Number(valeur.trim());
  if (Number.isFinite(secondes) && secondes >= 0) return secondes * 1000;
  const date = Date.parse(valeur);
  return Number.isNaN(date) ? undefined : Math.max(0, date - maintenant);
}

async function texteDe(url: string, delaiMs: number, entetes: Record<string, string> = {}): Promise<string> {
  const reponse = await fetch(url, {
    headers: { "User-Agent": AGENT_FEED, ...entetes },
    signal: AbortSignal.timeout(delaiMs),
  });
  if (!reponse.ok) throw new ErreurHttp(reponse.status, url, delaiRetryAfter(reponse.headers.get("retry-after")));
  return reponse.text();
}

export interface OptionsLectureYoutube {
  /** Nombre de lectures avant d'abandonner (404 et 5xx du flux sont souvent passagers). Défaut : 1. */
  essais?: number;
  /** Pause entre deux lectures, multipliée par le rang de l'essai. Défaut : 1500 ms. */
  pauseMs?: number;
}

/** 404 et 5xx du flux Atom : passagers chez YouTube, on relit. Le reste (400, 403…) ne change pas. */
const reessayableYoutube = (err: unknown): boolean =>
  !(err instanceof ErreurHttp) || err.statut === 404 || err.statut === 408 || err.statut >= 500;

export async function lireYoutube(compte: CompteSource, options: OptionsLectureYoutube = {}) {
  if (!/^UC[A-Za-z0-9_-]{22}$/.test(compte.pseudo)) throw new Error(`Identifiant de chaîne invalide : ${compte.pseudo}`);
  const essais = Math.max(1, options.essais ?? 1);
  const pauseMs = options.pauseMs ?? 1500;
  const url = `https://www.youtube.com/feeds/videos.xml?channel_id=${compte.pseudo}`;
  for (let essai = 1; ; essai++) {
    try {
      const xml = await texteDe(url, 12_000);
      return postsDepuisFluxYoutube(Bun.XML.parse(xml), compte);
    } catch (err) {
      if (essai >= essais || !reessayableYoutube(err)) throw err;
      await Bun.sleep(pauseMs * essai);
    }
  }
}

export async function lireTiktok(compte: CompteSource): Promise<LectureEmbedTiktok & { profilPage: ProfilFeed | null }> {
  if (!/^[A-Za-z0-9._]{1,40}$/.test(compte.pseudo)) throw new Error(`Pseudo TikTok invalide : ${compte.pseudo}`);
  const entetes = { "Accept-Language": "fr-FR,fr;q=0.9" };
  // L'embed d'abord : s'il est limité (429), inutile d'user le quota sur la page du profil.
  const embed = await texteDe(`https://www.tiktok.com/embed/@${compte.pseudo}`, 15_000, entetes);
  const lecture = lireEmbedTiktok(embed, compte);
  if (!lecture) throw new Error(`Page d'embed TikTok illisible : @${compte.pseudo}`);
  const page = await texteDe(`https://www.tiktok.com/@${compte.pseudo}`, 15_000, entetes).catch(() => "");
  return { ...lecture, profilPage: page ? profilDepuisHtmlTiktok(page, compte.pseudo) : null };
}
