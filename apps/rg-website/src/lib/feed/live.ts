// SPDX-License-Identifier: Apache-2.0
// Lecture X en direct côté serveur : la CLI native `aphrody x` du fork de Bun interroge les
// vrais endpoints X avec la session du serveur (cookies, variables d'environnement du serveur ;
// `APHRODY_BIN` pour changer le binaire). Rien n'est lu en base ; un cache court (par requête)
// protège le quota de la session, et les appels identiques simultanés n'en font qu'un.
import { homedir } from "node:os";
import { join } from "node:path";

import { memo } from "./memo";

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

const TTL_MS = 45_000;
const TTL_PROFIL_MS = 600_000;
const DELAI_MS = 25_000;

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
async function lireProfilBrut(compte: string): Promise<XProfil> {
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

/** Profil d'un compte, mis en cache dix minutes (il change rarement, et coûte un appel par compte). */
export function lireProfil(compte: string): Promise<XProfil> {
  return memo(`profil:${compte}`, TTL_PROFIL_MS, () => lireProfilBrut(compte));
}

/** Une page de posts et le curseur de la suivante (absent à la fin). */
export interface PageXPosts {
  tweets: XTweet[];
  next_cursor?: string;
}

const CURSEUR_OK = /^[A-Za-z0-9_=+/-]{1,400}$/;

export function curseurValide(curseur?: string): curseur is string {
  return !!curseur && CURSEUR_OK.test(curseur);
}

function optionCurseur(curseur?: string): string[] {
  return curseurValide(curseur) ? ["--cursor", curseur] : [];
}

/** Une page de posts d'un compte (le pseudo doit venir de la liste fermée `COMPTES`). */
export function lirePostsCompte(compte: string, nombre: number, curseur?: string): Promise<PageXPosts> {
  const n = Math.min(Math.max(1, nombre), 30);
  return memo(`posts:${compte}:${n}:${curseur ?? ""}`, TTL_MS, () =>
    lancer<PageXPosts>(["user-tweets", compte, "-n", String(n), ...optionCurseur(curseur)]),
  );
}

/** Recherche « Latest » sur X ; la requête est bornée et ne peut pas devenir une option. */
export function chercher(requete: string, nombre = 20, curseur?: string): Promise<PageXPosts> {
  const q = requete.trim().slice(0, 200);
  if (!q || q.startsWith("-")) return Promise.resolve({ tweets: [] });
  const n = Math.min(Math.max(1, nombre), 40);
  return memo(`q:${q}:${n}:${curseur ?? ""}`, TTL_MS, () =>
    lancer<PageXPosts>(["search", q, "-n", String(n), ...optionCurseur(curseur)]),
  );
}

export function estIdPost(valeur: string): boolean {
  return /^\d{5,25}$/.test(valeur);
}

/** Conversation d'un post (le post puis ses réponses), paginée. */
export function lireThread(id: string, curseur?: string): Promise<PageXPosts> {
  if (!estIdPost(id)) return Promise.resolve({ tweets: [] });
  return memo(`thread:${id}:${curseur ?? ""}`, TTL_MS, () =>
    lancer<PageXPosts>(["thread", id, "-n", "20", ...optionCurseur(curseur)]),
  );
}
