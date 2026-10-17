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

/**
 * Texte « décoré » ramené à des lettres ordinaires : les titres de paliers
 * Patreon s'écrivent en caractères mathématiques Unicode (𝙽𝚒𝚟𝚎𝚊𝚞) suivis
 * d'emojis. Un lecteur d'écran les épelle symbole par symbole et la police du
 * site ne s'y applique pas ; NFKC les ramène aux lettres latines.
 */
export function texteSansDecor(texte: string): string {
  return texte
    .normalize("NFKC")
    .replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}
