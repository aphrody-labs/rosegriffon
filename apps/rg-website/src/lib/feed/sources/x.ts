// SPDX-License-Identifier: Apache-2.0
// Source X du Feed : lecture temps réel, via la CLI native `aphrody x` (session cookies du
// serveur, voir lib/feed/live.ts). Tout est lisible : profils, fil de chaque compte, recherche,
// conversations, avec pagination par curseur.
//
// Le curseur de cette source est un JSON `{ pseudo: curseurX }` des comptes qui ont une suite.
import { chercher, lirePostsCompte, lireProfil, lireThread } from "../live";
import type { PageXPosts } from "../live";
import { avecDelai } from "../memo";
import { postDepuisTweet, profilDepuisX } from "../normalisation";
import { COMPTES_SOURCE_X } from "../comptes";
import type { CompteSource, PageSource, PostFeed, SourceFeed } from "../types";

const PARALLELE = 4;
const PAR_COMPTE_FIL = 5;
const PAR_COMPTE_SEUL = 12;
const DELAI_COMPTE_MS = 28_000;

async function parTranches<T, R>(elements: readonly T[], taille: number, f: (e: T) => Promise<R>): Promise<R[]> {
  const sortie: R[] = [];
  for (let i = 0; i < elements.length; i += taille) {
    sortie.push(...(await Promise.all(elements.slice(i, i + taille).map(f))));
  }
  return sortie;
}

function lireCurseurs(brut?: string): Record<string, string> | null {
  if (!brut) return null;
  try {
    const valeur: unknown = JSON.parse(brut);
    if (!valeur || typeof valeur !== "object" || Array.isArray(valeur)) return null;
    return Object.fromEntries(Object.entries(valeur).filter(([, v]) => typeof v === "string")) as Record<string, string>;
  } catch {
    return null;
  }
}

export const sourceX: SourceFeed = {
  reseau: "x",
  comptes: COMPTES_SOURCE_X,
  async lire({ comptes, curseur }): Promise<PageSource> {
    if (comptes.length === 0) return { posts: [], profils: [], statut: { reseau: "x", etat: "vide" } };
    const curseurs = lireCurseurs(curseur);
    // Après la première page, seuls les comptes qui ont encore une suite sont relus.
    const aLire = curseurs ? comptes.filter(c => curseurs[c.pseudo]) : comptes;
    const parCompte = comptes.length === 1 ? PAR_COMPTE_SEUL : PAR_COMPTE_FIL;
    const lectures = await parTranches(aLire, PARALLELE, async (compte: CompteSource) => {
      const [profil, page] = await Promise.all([
        lireProfil(compte.pseudo).catch(() => null),
        avecDelai(lirePostsCompte(compte.pseudo, parCompte, curseurs?.[compte.pseudo]), DELAI_COMPTE_MS, `X @${compte.pseudo}`).catch(
          () => null,
        ),
      ]);
      return { compte, profil, page };
    });
    const reponses = lectures.filter(l => l.page);
    if (aLire.length > 0 && reponses.length === 0)
      return {
        posts: [],
        profils: [],
        statut: { reseau: "x", etat: "indisponible", message: "X ne répond pas pour le moment." },
      };
    const posts: PostFeed[] = reponses.flatMap(l => l.page!.tweets.map(t => postDepuisTweet(t, l.compte)));
    const suivants: Record<string, string> = {};
    for (const l of reponses) if (l.page!.next_cursor) suivants[l.compte.pseudo] = l.page!.next_cursor;
    return {
      posts,
      profils: lectures.flatMap(l => (l.profil ? [profilDepuisX(l.profil)] : [])),
      curseur: Object.keys(suivants).length > 0 ? JSON.stringify(suivants) : undefined,
      // Un compte muet ne rend pas la source indisponible : le fil reste utile.
      statut: { reseau: "x", etat: posts.length > 0 ? "ok" : "vide" },
    };
  },
};

function pagePosts(page: PageXPosts): { posts: PostFeed[]; curseur?: string } {
  return { posts: page.tweets.map(t => postDepuisTweet(t)), curseur: page.next_cursor };
}

/** Recherche « Latest » sur X (réservée à X : les deux autres réseaux n'ont pas de recherche publique). */
export async function rechercherX(q: string, curseur?: string) {
  return pagePosts(await chercher(q, 20, curseur));
}

/** Conversation d'un post X : le post puis ses réponses. */
export async function conversationX(id: string, curseur?: string) {
  return pagePosts(await lireThread(id, curseur));
}
