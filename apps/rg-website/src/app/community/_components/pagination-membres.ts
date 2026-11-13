/*
 * Découpage en pages de la hiérarchie d'un serveur, SANS casser ses sections.
 *
 * ⚠ POURQUOI. L'annuaire rendait chaque membre du serveur dans un seul HTML :
 * 3 144 cartes et 5,7 Mo pour `/community?serveur=achillea`, 1 843 et 3,5 Mo pour
 * Rose Griffon (audit du 5/11/2026). Une page porte désormais `PAR_PAGE` cartes ;
 * les sections (rôles détachés, dans l'ordre Discord) sont conservées et seule
 * celle qui chevauche une limite de page est coupée. Son titre garde l'effectif
 * TOTAL du rôle : couper l'affichage n'en change pas la taille.
 *
 * 60 = un multiple commun de 2, 3, 4 et 6 colonnes : chaque page finit sur une
 * rangée pleine, quelle que soit la largeur.
 */

export const MEMBRES_PAR_PAGE = 60;

export interface TrancheSection<S> {
  section: S;
  /** Index de début et de fin (exclu) dans `section.membres`. */
  debut: number;
  fin: number;
}

/** Lit `?page=`, borné à `[1, derniere]`. Toute valeur illisible vaut 1. */
export function lirePage(
  brut: unknown,
  total: number,
  parPage = MEMBRES_PAR_PAGE,
): number {
  const derniere = Math.max(1, Math.ceil(total / parPage));
  const n = typeof brut === "string" ? Number.parseInt(brut, 10) : Number.NaN;
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, derniere);
}

/** Les morceaux de sections visibles sur la page `page` (1-indexée). */
export function trancherSections<S extends { membres: readonly unknown[] }>(
  sections: readonly S[],
  page: number,
  parPage = MEMBRES_PAR_PAGE,
): TrancheSection<S>[] {
  const debutPage = (page - 1) * parPage;
  const finPage = debutPage + parPage;
  const tranches: TrancheSection<S>[] = [];
  let curseur = 0;
  for (const section of sections) {
    const taille = section.membres.length;
    const debut = Math.max(debutPage - curseur, 0);
    const fin = Math.min(finPage - curseur, taille);
    if (fin > debut) tranches.push({ debut, fin, section });
    curseur += taille;
    if (curseur >= finPage) break;
  }
  return tranches;
}
