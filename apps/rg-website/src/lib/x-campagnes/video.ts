/*
 * Lisibilité d'une vidéo déposée telle quelle (pièce jointe Discord, sans transcodage).
 *
 * ⚠ UN `.mov` N'EST PAS UNE VIDÉO WEB. Le conteneur QuickTime n'est garanti que par
 * Safari ; Chrome et Firefox le refusent selon le codec embarqué, et l'échec est
 * silencieux : un cadre noir. Pire, la balise `<video>` en a déjà téléchargé des
 * mégaoctets avant d'abandonner (27 Mo sur `/iergday?campagne=inazuma-rg-2`, audit du
 * 5/11/2026). Un tel fichier n'est donc jamais monté : la vignette reste un aplat, et la
 * visionneuse propose le téléchargement.
 */

const EXTENSIONS_NON_WEB = /\.(mov|qt|avi|wmv|mkv|flv|3gp)(?:[?#]|$)/i;

/** Vrai si l'URL désigne une vidéo qu'un navigateur courant sait lire dans `<video>`. */
export function videoLisibleNavigateur(src: string): boolean {
  return !EXTENSIONS_NON_WEB.test(src);
}
