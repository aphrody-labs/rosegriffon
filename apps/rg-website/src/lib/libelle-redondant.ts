/**
 * Un badge de catégorie posé juste au-dessus d'un titre qui commence par le
 * même mot se lit deux fois (« Critique » puis « Critique communautaire… ») :
 * à l'écran, et surtout au lecteur d'écran qui enchaîne les deux. Le titre
 * porte déjà l'information ; le badge est alors redondant.
 *
 * Comparaison insensible à la casse et aux accents, sur un mot entier :
 * « Critique » est redondant avec « Critique communautaire », pas avec
 * « Critiques des fans » ni « Autocritique ».
 */
export function libelleRedondantAvecTitre(
  libelle: string | null | undefined,
  titre: string | null | undefined,
): boolean {
  if (!libelle || !titre) return false;
  const normaliser = (valeur: string) =>
    valeur
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .trim()
      .toLocaleLowerCase("fr");
  const l = normaliser(libelle);
  const t = normaliser(titre);
  if (l.length === 0 || !t.startsWith(l)) return false;
  const suivant = t.charAt(l.length);
  return suivant === "" || !/[\p{L}\p{N}]/u.test(suivant);
}
