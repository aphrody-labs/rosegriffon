// SPDX-License-Identifier: Apache-2.0
// Découpes de texte qui respectent Unicode. Une chaîne JS est en UTF-16 : `charAt(0)`,
// `s[0]` ou `slice(0, n)` peuvent s'arrêter au milieu d'une paire de substitution (émoji,
// idéogrammes rares). La moitié isolée n'est pas encodable en UTF-8 et arrive dans la page
// sous la forme U+FFFD (« � »), constaté sur /feed (avatars « 👑… », « 🥕… »).

const SEGMENTEUR = new Intl.Segmenter("fr", { granularity: "grapheme" });

/**
 * Initiale affichable d'un nom : premier graphème (émoji compris), en majuscule.
 * `repli` quand le nom est vide.
 */
export function initiale(nom: string | null | undefined, repli = "?"): string {
  const propre = (nom ?? "").trim();
  if (!propre) return repli;
  const premier =
    SEGMENTEUR.segment(propre)[Symbol.iterator]().next().value?.segment ?? "";
  return premier.toLocaleUpperCase("fr") || repli;
}

/**
 * `s.slice(0, n)` sans couper une paire de substitution : si la coupe tombe entre les deux
 * moitiés, la moitié haute est retirée (le résultat fait alors `n - 1` unités).
 */
export function tronquerUnicode(s: string, n: number): string {
  const coupe = s.slice(0, Math.max(0, n));
  const dernier = coupe.charCodeAt(coupe.length - 1);
  return dernier >= 0xd800 && dernier <= 0xdbff ? coupe.slice(0, -1) : coupe;
}

const ILLISIBLE =
  /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]|\uFFFD/g;

/**
 * Retire d'un texte venu d'un réseau tiers les caractères qui s'affichent « � » : moitiés
 * de paire isolées et U+FFFD déjà présents (octets invalides remplacés en amont, que l'on
 * ne peut plus reconstituer). Le reste du texte est inchangé.
 */
export function sansCaracteresIllisibles(s: string): string {
  return s.replace(ILLISIBLE, "");
}
