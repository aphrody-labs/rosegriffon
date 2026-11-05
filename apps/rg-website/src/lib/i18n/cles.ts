// SPDX-License-Identifier: Apache-2.0
/**
 * Clé d'interface, par opposition aux clés de texte de jeu (`0x` suivi de 8 chiffres hexadécimaux, hachages des
 * fichiers de Victory Road) qui occupent 90 % de `public/locales/fr.json`. Seules les
 * premières sont embarquées dans le JS de la coque (`fr-interface.json`).
 */
export function cleInterface(cle: string): boolean {
  return !/^0x[0-9A-Fa-f]+$/.test(cle);
}
