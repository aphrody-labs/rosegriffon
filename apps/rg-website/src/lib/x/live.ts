// SPDX-License-Identifier: Apache-2.0
// Lecture X en direct côté serveur : la CLI native `aphrody x` du fork de Bun interroge les
// vrais endpoints X avec la session du serveur. Rien n'est lu en base ; un cache court (par
// requête) protège le quota de la session, et les appels identiques simultanés n'en font qu'un.
import { homedir } from "node:os";
import { join } from "node:path";

export interface XMedia {
  type: string;
  url: string;
  preview_url?: string;
  width?: number;
  height?: number;
}

export interface XTweet {
  id: string;
  text: string;
  author: { username: string; name: string };
  created_at: string;
  reply_count?: number;
  retweet_count?: number;
  like_count?: number;
  quote_count?: number;
  view_count?: number;
  media?: XMedia[];
  quoted_tweet?: XTweet;
}

export interface XProfil {
  id: string;
  name: string;
  screen_name: string;
  avatar?: string;
  banner?: string;
  description?: string;
  site?: { affichage: string; url: string };
  followers?: number;
  following?: number;
  posts?: number;
  rejointLe?: string;
  certifie?: boolean;
}

export interface XLive {
  profil: XProfil;
  tweets: XTweet[];
  recuLe: string;
}

/** Comptes affichables : la session du serveur n'est pas un proxy ouvert. */
export const COMPTES_X = ["rose_griffon", "Achillea_IE", "Azalee_IE"] as const;
export type CompteX = (typeof COMPTES_X)[number];

const TTL_MS = 30_000;
const DELAI_MS = 25_000;
const MAX_ENTREES = 64;

const cache = new Map<string, { at: number; valeur: unknown }>();
const enCours = new Map<string, Promise<unknown>>();

function binaire(): string {
  return process.env.APHRODY_BIN || Bun.which("aphrody") || join(homedir(), ".local", "bin", "aphrody");
}

async function lancer<T>(args: string[]): Promise<T> {
  const proc = Bun.spawn([binaire(), "x", ...args], {
    stdout: "pipe",
    stderr: "pipe",
    env: process.env,
    killSignal: "SIGKILL",
    timeout: DELAI_MS,
  });
  const [sortie, erreur, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  if (code !== 0) throw new Error(`aphrody x ${args[0]} : ${(erreur || sortie).trim().slice(-200)}`);
  return JSON.parse(sortie) as T;
}

async function memo<T>(cle: string, produire: () => Promise<T>): Promise<T> {
  const frais = cache.get(cle);
  if (frais && Date.now() - frais.at < TTL_MS) return frais.valeur as T;
  const attente = enCours.get(cle);
  if (attente) return attente as Promise<T>;
  const p = produire()
    .then(valeur => {
      if (cache.size >= MAX_ENTREES) cache.delete(cache.keys().next().value as string);
      cache.set(cle, { at: Date.now(), valeur });
      return valeur;
    })
    .catch(erreur => {
      // Mieux vaut une page légèrement périmée qu'une page vide quand X répond mal.
      if (frais) return frais.valeur as T;
      throw erreur;
    })
    .finally(() => enCours.delete(cle));
  enCours.set(cle, p);
  return p;
}

export function estCompteX(valeur: string): valeur is CompteX {
  return (COMPTES_X as readonly string[]).includes(valeur);
}

interface ProfilBrut {
  data?: {
    user?: {
      result?: {
        rest_id?: string;
        avatar?: { image_url?: string };
        banner?: { image_url?: string };
        core?: { name?: string; screen_name?: string; created_at?: string };
        is_blue_verified?: boolean;
        profile_bio?: {
          description?: string;
          entities?: { url?: { urls?: Array<{ display_url?: string; expanded_url?: string }> } };
        };
        relationship_counts?: { followers?: number; following?: number };
        tweet_counts?: { tweets?: number };
      };
    };
  };
}

/** Le profil complet vient de l'opération GraphQL `UserByScreenName` (avatar, bannière, compteurs). */
async function lireProfil(compte: CompteX): Promise<XProfil> {
  const brut = await lancer<ProfilBrut>(["graphql", "UserByScreenName", "--var", `screen_name=${compte}`, "--var", "withSafetyModeUserFields=true"]);
  const r = brut.data?.user?.result;
  if (!r?.rest_id) throw new Error(`profil X introuvable : ${compte}`);
  const lien = r.profile_bio?.entities?.url?.urls?.[0];
  return {
    id: r.rest_id,
    name: r.core?.name ?? compte,
    screen_name: r.core?.screen_name ?? compte,
    avatar: r.avatar?.image_url?.replace("_normal", "_400x400"),
    banner: r.banner?.image_url ? `${r.banner.image_url}/1500x500` : undefined,
    description: r.profile_bio?.description,
    site: lien?.expanded_url ? { affichage: lien.display_url ?? lien.expanded_url, url: lien.expanded_url } : undefined,
    followers: r.relationship_counts?.followers,
    following: r.relationship_counts?.following,
    posts: r.tweet_counts?.tweets,
    rejointLe: r.core?.created_at,
    certifie: r.is_blue_verified,
  };
}

/** Profil et derniers posts d'un compte officiel, relus sur X (cache 30 s). */
export function lireCompte(compte: CompteX, nombre = 12): Promise<XLive> {
  const n = Math.min(Math.max(1, nombre), 30);
  return memo(`compte:${compte}:${n}`, async () => {
    const [profil, page] = await Promise.all([
      lireProfil(compte),
      lancer<{ tweets: XTweet[] }>(["user-tweets", compte, "-n", String(n)]),
    ]);
    return { profil, tweets: page.tweets, recuLe: new Date().toISOString() };
  });
}

/** Recherche « Latest » sur X ; la requête est bornée et ne peut pas devenir une option. */
export function chercher(requete: string, nombre = 20): Promise<XTweet[]> {
  const q = requete.trim().slice(0, 200);
  if (!q || q.startsWith("-")) return Promise.resolve([]);
  const n = Math.min(Math.max(1, nombre), 40);
  return memo(`q:${q}:${n}`, async () => (await lancer<{ tweets: XTweet[] }>(["search", q, "-n", String(n)])).tweets);
}
