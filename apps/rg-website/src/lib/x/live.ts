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
}

export interface XLive {
  profil: XProfil;
  tweets: XTweet[];
  recuLe: string;
}

/** Comptes affichables : la session du serveur n'est pas un proxy ouvert. */
export const COMPTES_X = ["Azalee_IE", "Achillea_IE", "rose_griffon"] as const;
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

/** Profil et derniers posts d'un compte officiel, relus sur X (cache 30 s). */
export function lireCompte(compte: CompteX, nombre = 12): Promise<XLive> {
  const n = Math.min(Math.max(1, nombre), 30);
  return memo(`compte:${compte}:${n}`, async () => {
    const [profil, page] = await Promise.all([
      lancer<XProfil>(["user", compte]),
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
