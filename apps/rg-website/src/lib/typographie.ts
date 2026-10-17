/**
 * Espaces insécables de la typographie française : « » et : ; ! ? ne doivent
 * jamais se retrouver seuls en début de ligne. Les titres viennent de la base,
 * saisis avec des espaces ordinaires ; on les corrige à l'affichage.
 */
export function typographieFr(texte: string): string {
  return texte
    .replace(/«\s+/g, "« ")
    .replace(/\s+»/g, " »")
    .replace(/\s+([:;!?])/g, " $1");
}
