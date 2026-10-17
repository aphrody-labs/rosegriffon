import type { CSSProperties } from "react";

/*
 * Réplique du profil X (thème « Noir ») mesurée sur x.com : colonne de 600 px, texte 15/20,
 * bordures #2f3336, gris #71767b, liens #1d9bf0. Les valeurs vivent ici, en variables, parce
 * que c'est un calque volontairement fidèle à X et non un élément de la charte du site.
 */
export const VARIABLES_X = {
  "--x-bg": "#000000",
  "--x-border": "#2f3336",
  "--x-text": "#e7e9ea",
  "--x-muted": "#71767b",
  "--x-link": "#1d9bf0",
  "--x-hover": "#080808",
} as CSSProperties;
