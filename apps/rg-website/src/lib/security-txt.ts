// SPDX-License-Identifier: Apache-2.0
// Contenu de /.well-known/security.txt (RFC 9116). Pur, sans réseau : testable.

/** Adresse publique de l'association (cellule de médiation, `/api/rg/info`). */
export const CONTACT_SECURITE = "contact@rosegriffon.fr";

const UN_AN_MS = 365 * 24 * 60 * 60 * 1000;

/**
 * `Expires` est obligatoire et doit rester dans le futur : il est calculé à chaque
 * régénération de la route (un an après `maintenant`), au lieu d'être figé dans un
 * fichier statique qui expirerait sans que personne ne le voie.
 */
export function securityTxt(
  siteUrl: string,
  maintenant: Date = new Date(),
): string {
  const origine = siteUrl.replace(/\/+$/, "");
  const expire = new Date(maintenant.getTime() + UN_AN_MS);
  expire.setUTCMilliseconds(0);
  return [
    `Contact: mailto:${CONTACT_SECURITE}`,
    `Contact: ${origine}/a-propos/contact`,
    `Expires: ${expire.toISOString().replace(".000Z", "Z")}`,
    "Preferred-Languages: fr, en",
    `Canonical: ${origine}/.well-known/security.txt`,
    "",
  ].join("\n");
}
