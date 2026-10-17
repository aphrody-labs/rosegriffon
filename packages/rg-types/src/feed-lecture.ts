// SPDX-License-Identifier: Apache-2.0
// Lectures réseau du Feed qui ne demandent ni clé, ni session, ni navigateur : un simple `fetch`.
// Partagées par le cron `feed:sync` (qui en fait des instantanés) et par le site (repli en direct
// quand l'instantané est absent ou périmé).
//
//  - YouTube : flux Atom public `youtube.com/feeds/videos.xml?channel_id=UC…` (15 dernières vidéos),
//    analysé par `Bun.XML.parse`.
//  - TikTok : page d'embed `tiktok.com/embed/@pseudo` (≈ 10 dernières vidéos, lien MP4 signé inclus)
//    et page du profil (bio, compteurs, lien du site).
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

async function texteDe(url: string, delaiMs: number, entetes: Record<string, string> = {}): Promise<string> {
  const reponse = await fetch(url, {
    headers: { "User-Agent": AGENT_FEED, ...entetes },
    signal: AbortSignal.timeout(delaiMs),
  });
  if (!reponse.ok) throw new Error(`HTTP ${reponse.status} : ${url.split("?")[0]}`);
  return reponse.text();
}

export async function lireYoutube(compte: CompteSource) {
  if (!/^UC[A-Za-z0-9_-]{22}$/.test(compte.pseudo)) throw new Error(`Identifiant de chaîne invalide : ${compte.pseudo}`);
  const xml = await texteDe(`https://www.youtube.com/feeds/videos.xml?channel_id=${compte.pseudo}`, 12_000);
  return postsDepuisFluxYoutube(Bun.XML.parse(xml), compte);
}

export async function lireTiktok(compte: CompteSource): Promise<LectureEmbedTiktok & { profilPage: ProfilFeed | null }> {
  if (!/^[A-Za-z0-9._]{1,40}$/.test(compte.pseudo)) throw new Error(`Pseudo TikTok invalide : ${compte.pseudo}`);
  const [embed, page] = await Promise.all([
    texteDe(`https://www.tiktok.com/embed/@${compte.pseudo}`, 15_000, { "Accept-Language": "fr-FR,fr;q=0.9" }),
    texteDe(`https://www.tiktok.com/@${compte.pseudo}`, 15_000, { "Accept-Language": "fr-FR,fr;q=0.9" }).catch(() => ""),
  ]);
  const lecture = lireEmbedTiktok(embed, compte);
  if (!lecture) throw new Error(`Page d'embed TikTok illisible : @${compte.pseudo}`);
  return { ...lecture, profilPage: page ? profilDepuisHtmlTiktok(page, compte.pseudo) : null };
}
