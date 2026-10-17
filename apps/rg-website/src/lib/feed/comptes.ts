// SPDX-License-Identifier: Apache-2.0
// Les comptes X que le Feed affiche : l'écosystème Rose Griffon, les comptes officiels
// d'Inazuma Eleven et LEVEL-5. Chaque pseudo a été vérifié sur X ; la liste est la seule source,
// le serveur n'accepte aucun autre compte (la session du serveur n'est pas un proxy ouvert).

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

/** Onglet qui réunit tous les comptes, du plus récent au plus ancien. */
export const COMPTE_TOUS = "tous";

export function estCompteX(valeur: string): valeur is CompteX {
  return (COMPTES_X as readonly string[]).includes(valeur);
}
