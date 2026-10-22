/**
 * Règles et messages du formulaire de création de clan, sans React : testés
 * par `bun test` sans fenêtre.
 */

/** Président (le compte connecté) + 4 co-fondateurs, comme l'exige l'API. */
export const COFONDATEURS_REQUIS = 4;

/** Types et poids acceptés pour le logo (l'API en fait aussi un émoji Discord, 256 Ko max). */
export const LOGO_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"] as const;
export const LOGO_MAX_OCTETS = 256 * 1024;

/** Identifiants Discord saisis, dédoublonnés ; `null` si l'un n'est pas un identifiant. */
export function lireCofondateurs(saisie: string): string[] | null {
  const ids = saisie
    .split(/[\s,;]+/)
    .map(id => id.trim())
    .filter(Boolean);
  if (ids.some(id => !/^\d{17,20}$/.test(id))) return null;
  return [...new Set(ids)];
}

/** Message d'erreur d'un logo choisi, `null` s'il convient. */
export function erreurLogo(fichier: { type: string; size: number } | null): string | null {
  if (!fichier) return "Choisis un logo pour ton clan (PNG, JPEG, GIF ou WebP).";
  if (!(LOGO_TYPES as readonly string[]).includes(fichier.type))
    return "Le logo doit être une image PNG, JPEG, GIF ou WebP.";
  if (fichier.size > LOGO_MAX_OCTETS) return "Le logo ne doit pas dépasser 256 Ko.";
  return null;
}

/**
 * Échec de `POST /clans/create` traduit pour le formulaire. Le client ne relaie
 * que le statut HTTP : chaque statut de l'API correspond à une famille d'erreur.
 */
export function messageErreurCreation(echec: { kind: string; status?: number }): string {
  if (echec.kind !== "http") return "L'API Achilléa est injoignable. Réessaie dans un instant.";
  switch (echec.status) {
    case 400:
      return "La demande a été refusée : vérifie que tes 4 co-fondateurs ont un compte Achilléa, sont présents sur le Discord d'Achilléa et ne sont dans aucun clan, puis le nom, le sigle et les liens.";
    case 401:
      return "Ta session a expiré. Reconnecte-toi puis recommence.";
    case 409:
      return "Ce nom, ce sigle ou ce logo est déjà utilisé par un autre clan. Choisis-en un autre.";
    case 422:
      return "Le formulaire est incomplet : vérifie chaque champ obligatoire.";
    case 503:
      return "Discord Achilléa est momentanément indisponible : le rôle et le salon du clan n'ont pas pu être créés. Réessaie plus tard.";
    default:
      return "Impossible de créer le clan pour le moment.";
  }
}
