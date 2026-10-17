// SPDX-License-Identifier: Apache-2.0
// Les comptes que le Feed affiche : l'écosystème Rose Griffon, les comptes officiels
// d'Inazuma Eleven et LEVEL-5. La liste est la seule source : le serveur n'accepte aucun autre
// compte (la session X du serveur n'est pas un proxy ouvert).
//
// Vérifications (octobre 2026) :
//  - X : chaque pseudo a été vérifié sur x.com.
//  - Instagram : rose_griffonfr et azaleefr sont les liens officiels du site (lib/social-links.ts).
//    Aucun compte Instagram officiel d'Inazuma Eleven / LEVEL-5 n'est référencé par inazuma.jp,
//    level5.co.jp ni les profils X : aucun n'est donc listé.
//  - TikTok : rose_griffon (« Association française Inazuma Eleven », lien du profil vers
//    rosegriffon.fr). @inazumaeleven, @level5official, @inazuma_project… sont des comptes de
//    fans ou sans rapport (non vérifiés, non certifiés) : exclus.
import type { CompteSource, Groupe, Reseau } from "./types";

export const COMPTES = [
  { handle: "rose_griffon", nom: "Rose Griffon", groupe: "Rose Griffon" },
  { handle: "Achillea_IE", nom: "Achilléa", groupe: "Rose Griffon" },
  { handle: "Azalee_IE", nom: "Azalée", groupe: "Rose Griffon" },
  { handle: "inazuma_project", nom: "Inazuma Eleven · JP", groupe: "Inazuma Eleven" },
  { handle: "inazuma_cross", nom: "Cross · JP", groupe: "Inazuma Eleven" },
  { handle: "inazumaSD_L5", nom: "SD · JP", groupe: "Inazuma Eleven" },
  { handle: "InazumaSeries", nom: "Series · EN", groupe: "Inazuma Eleven" },
  { handle: "InazumaCrossFR", nom: "Cross · FR", groupe: "Inazuma Eleven" },
  { handle: "ievrfr", nom: "Victory Road · FR", groupe: "Inazuma Eleven" },
  { handle: "LEVEL5_times", nom: "LEVEL-5", groupe: "LEVEL-5" },
  { handle: "AkihiroHino", nom: "Akihiro Hino", groupe: "LEVEL-5" },
] as const;

export type CompteX = (typeof COMPTES)[number]["handle"];

export const COMPTES_X: readonly CompteX[] = COMPTES.map(c => c.handle);

export const GROUPES: readonly Groupe[] = ["Rose Griffon", "Inazuma Eleven", "LEVEL-5"];

export const RESEAUX: readonly Reseau[] = ["x", "instagram", "tiktok"];

/** Libellé et couleur de marque du réseau (la seule couleur brute admise : celle du logo). */
export const MARQUES: Record<Reseau, { nom: string; couleur: string; lien: (pseudo: string) => string }> = {
  x: { nom: "X", couleur: "#000000", lien: p => `https://x.com/${p}` },
  instagram: { nom: "Instagram", couleur: "#E4405F", lien: p => `https://www.instagram.com/${p}/` },
  tiktok: { nom: "TikTok", couleur: "#FE2C55", lien: p => `https://www.tiktok.com/@${p}` },
};

export const COMPTES_SOURCE_X: readonly CompteSource[] = COMPTES.map(c => ({
  reseau: "x",
  pseudo: c.handle,
  nom: c.nom,
  groupe: c.groupe,
}));

export const COMPTES_SOURCE_INSTAGRAM: readonly CompteSource[] = [
  { reseau: "instagram", pseudo: "rose_griffonfr", nom: "Rose Griffon", groupe: "Rose Griffon" },
  { reseau: "instagram", pseudo: "azaleefr", nom: "Azalée", groupe: "Rose Griffon" },
];

export const COMPTES_SOURCE_TIKTOK: readonly CompteSource[] = [
  { reseau: "tiktok", pseudo: "rose_griffon", nom: "Rose Griffon", groupe: "Rose Griffon" },
];

export const TOUS_LES_COMPTES: readonly CompteSource[] = [
  ...COMPTES_SOURCE_X,
  ...COMPTES_SOURCE_INSTAGRAM,
  ...COMPTES_SOURCE_TIKTOK,
];

/** Onglet qui réunit tous les comptes, du plus récent au plus ancien. */
export const COMPTE_TOUS = "tous";

export function estCompteX(valeur: string): valeur is CompteX {
  return (COMPTES_X as readonly string[]).includes(valeur);
}

export function estReseau(valeur: string | null | undefined): valeur is Reseau {
  return valeur === "x" || valeur === "instagram" || valeur === "tiktok";
}

export function estGroupe(valeur: string | null | undefined): valeur is Groupe {
  return (GROUPES as readonly string[]).includes(valeur ?? "");
}

export interface FiltreFil {
  reseau?: Reseau;
  groupe?: Groupe;
  /** Pseudo d'un compte précis (insensible à la casse). */
  compte?: string;
}

/** Comptes retenus par un filtre ; vide si le filtre ne correspond à aucun compte. */
export function comptesDuFiltre(filtre: FiltreFil): CompteSource[] {
  const cible = filtre.compte?.toLowerCase();
  return TOUS_LES_COMPTES.filter(
    c =>
      (!filtre.reseau || c.reseau === filtre.reseau) &&
      (!filtre.groupe || c.groupe === filtre.groupe) &&
      (!cible || c.pseudo.toLowerCase() === cible),
  );
}

/** Lit le filtre depuis des paramètres d'URL ; toute valeur inconnue est ignorée (jamais d'erreur). */
export function lireFiltre(parametres: { get(nom: string): string | null }): FiltreFil {
  const reseau = parametres.get("reseau");
  const groupe = parametres.get("groupe");
  const compte = parametres.get("compte");
  const connu = compte ? TOUS_LES_COMPTES.find(c => c.pseudo.toLowerCase() === compte.toLowerCase()) : undefined;
  return {
    reseau: estReseau(reseau) ? reseau : undefined,
    groupe: estGroupe(groupe) ? groupe : undefined,
    compte: connu?.pseudo,
  };
}

/** Paramètres d'URL canoniques d'un filtre (pour les liens et l'appel API). */
export function parametresDuFiltre(filtre: FiltreFil): string {
  const p = new URLSearchParams();
  if (filtre.reseau) p.set("reseau", filtre.reseau);
  if (filtre.groupe) p.set("groupe", filtre.groupe);
  if (filtre.compte) p.set("compte", filtre.compte);
  return p.toString();
}
