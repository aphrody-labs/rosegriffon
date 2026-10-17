/**
 * Les couleurs de rôle Discord sont pensées pour le fond sombre de Discord :
 * claires, elles tombent sous 4.5:1 sur nos fonds. On les tire vers la couleur
 * de texte du thème, ce qui garde la teinte et suit le mode clair ou sombre.
 */
export function couleurLisible(couleur: string): string {
  return `color-mix(in oklab, ${couleur} 50%, var(--foreground))`;
}
