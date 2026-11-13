/**
 * @license
 * Copyright 2026 Rose Griffon
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Metadata } from "next";

import { tronquerUnicode } from "./unicode";

/**
 * Fabrique d'URL canoniques pour les listes filtrables (`/chara`, `/skill`,
 * `/aura/<categorie>`…).
 *
 * Deux défauts constatés sur les canoniques construits à la main :
 *
 * 1. `` `/chara${rawParams ? `?${…}` : ""}` `` — `rawParams` est le résultat
 *    de `await searchParams`, donc **toujours** un objet, donc toujours vrai :
 *    la page nue déclarait `…/chara?` (constaté en production), une URL qui
 *    n'est pas celle servie. Ici, le `?` n'apparaît que s'il reste au moins un
 *    paramètre.
 * 2. Recopier tout `searchParams` fait entrer les paramètres de campagne
 *    (`utm_*`, `gclid`, `fbclid`…) dans le canonique : chaque lien tracké
 *    devient sa propre page canonique, ce qui annule la déduplication. Ici,
 *    seules les clés explicitement autorisées passent.
 *
 * Les valeurs multiples (`?element=feu&element=vent`) sont sérialisées une clé
 * par occurrence, comme le fait le routeur, et les clés sont triées pour que
 * deux URLs équivalentes produisent un canonique identique.
 */
export function buildCanonical(
  path: string,
  params: Record<string, string | string[] | undefined>,
  allowedKeys: readonly string[],
): string {
  const query = new URLSearchParams();
  for (const key of [...allowedKeys].sort()) {
    const value = params[key];
    if (value === undefined) {
      continue;
    }
    for (const one of Array.isArray(value) ? value : [value]) {
      if (one !== "") {
        query.append(key, one);
      }
    }
  }
  const qs = query.toString();
  return qs ? `${path}?${qs}` : path;
}

type OpenGraph = NonNullable<Metadata["openGraph"]>;

/** Image de partage par défaut (`app/opengraph-image.png`, 1200×630). */
export const DEFAULT_OG_IMAGE = {
  alt: "Rose Griffon - Association Inazuma Eleven",
  height: 630,
  url: "/opengraph-image.png",
  width: 1200,
} as const;

/**
 * Bloc `openGraph` avec un titre obligatoire et une image garantie.
 *
 * Next fusionne les métadonnées de façon superficielle : un segment qui
 * déclare `openGraph` remplace tout l'objet du parent, y compris l'image que
 * `app/opengraph-image.png` attache au segment racine (et celles des
 * `opengraph-image.tsx` des segments parents). Seize pages publiques
 * partaient ainsi sans `og:image`. Sans image (absente, vide ou `undefined`),
 * {@link DEFAULT_OG_IMAGE} est posée.
 */
export function withDefaultOgImage<
  T extends OpenGraph & { title: NonNullable<OpenGraph["title"]> },
>(og: T): Omit<T, "images"> & { images: NonNullable<OpenGraph["images"]> } {
  const { images } = og;
  if (Array.isArray(images) ? images.length > 0 : Boolean(images)) {
    return og as Omit<T, "images"> & {
      images: NonNullable<OpenGraph["images"]>;
    };
  }
  return { ...og, images: [DEFAULT_OG_IMAGE] };
}

/** Longueur au-delà de laquelle Google tronque une méta-description. */
export const DESCRIPTION_MAX = 160;

/**
 * Coupe un texte libre à `max` caractères au plus, sur une frontière de mot,
 * avec une ellipse : jamais au milieu d'un mot, jamais d'espace ou de
 * ponctuation pendante avant l'ellipse. Les sauts de ligne et espaces
 * multiples sont réduits à un espace (une méta-description est une ligne).
 *
 * Sert aux méta-descriptions et aux titres construits depuis du contenu
 * (tweets, articles, sondages) : `slice(0, n)` coupait en plein mot et
 * laissait des descriptions de 300 caractères passer telles quelles.
 */
export function clampText(
  text: string | null | undefined,
  max: number = DESCRIPTION_MAX,
): string {
  const clean = (text ?? "").replace(/\s+/g, " ").trim();
  if (clean.length <= max) {
    return clean;
  }
  const cut = tronquerUnicode(clean, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  // Un mot unique plus long que la moitié de la limite : couper net plutôt
  // que de ne garder qu'un fragment.
  const base = lastSpace > max / 2 ? cut.slice(0, lastSpace) : cut;
  return `${base.replace(/[\s,;:.!?\-–—|·]+$/u, "")}…`;
}

/** Longueur au-delà de laquelle un `<title>` est tronqué dans les résultats. */
export const TITLE_MAX = 65;

/**
 * Titre construit depuis du contenu, suivi d'un suffixe de marque si la place
 * le permet. Ordre de préférence : `base + suffix` s'il tient, sinon `base`
 * seul, sinon `base` coupé proprement. La marque est sacrifiée avant le sujet.
 */
export function titleWithSuffix(
  base: string,
  suffix: string,
  max: number = TITLE_MAX,
): string {
  const clean = clampText(base, Number.MAX_SAFE_INTEGER);
  if (clean.length + suffix.length <= max) {
    return `${clean}${suffix}`;
  }
  return clampText(clean, max);
}

/**
 * Titre d'une fiche du wiki : « <sujet> | Inazuma Eleven Victory Road - Azalée »
 * quand il tient en {@link TITLE_MAX} caractères, sinon « <sujet> | Azalée ».
 * `context` précise le type de fiche (« Équipes », « Passifs ») si la place le
 * permet.
 */
export function wikiTitle(subject: string, context?: string): string {
  const game = context
    ? `${context} - Inazuma Eleven Victory Road`
    : "Inazuma Eleven Victory Road";
  const full = `${subject} | ${game} - Azalée`;
  return full.length <= TITLE_MAX
    ? full
    : titleWithSuffix(subject, " | Azalée");
}

/**
 * Clés de filtre communes aux listes du wiki (sous-ensemble de
 * `searchParamsSchema` : uniquement celles qui changent réellement le contenu
 * listé, `view`/`tab` étant de la préférence d'affichage).
 *
 * Trois clés ont été retirées de cette liste :
 *
 * - `sort` et `perPage` ne changent pas le CONTENU, seulement son ordre ou son
 *   découpage. Les y laisser faisait de `?sort=name` et `?sort=power` deux pages
 *   canoniques distinctes pour exactement les mêmes lignes.
 * - `q` est une recherche interne : chaque requête tapée devenait une page
 *   canonique de plus, sur un espace non borné. Une page de résultats se
 *   rattache à sa liste.
 *
 * `page` reste : les pages d'une série paginée sont bien des documents
 * différents, chacun canonique de lui-même.
 */
export const LIST_CANONICAL_KEYS = [
  "category",
  "element",
  "gender",
  "grade",
  "page",
  "position",
  "rarity",
  "role",
  "series",
  "type",
] as const;
