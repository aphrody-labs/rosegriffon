import "server-only";

import fs from "node:fs";
import path from "node:path";
import { google } from "googleapis";

/** Un secret scellé non déchiffré commence par ce préfixe une fois encodé. */
export function isSealedBlob(value: string): boolean {
  return value.startsWith("eyJ2Ijoi");
}

type ServiceAccountAuth = InstanceType<typeof google.auth.GoogleAuth>;

/**
 * Client d'authentification « compte de service » Google, partagé par toutes
 * les surfaces du site (Drive, Calendar, Docs, Sheets privées). Un seul point
 * d'entrée évite que chaque module réinvente sa résolution d'identifiants.
 *
 * Résout les identifiants dans l'ordre, du contrat canonique au plus implicite :
 *  1. `GOOGLE_APPLICATION_CREDENTIALS` — chemin vers le JSON du compte de service.
 *  2. `GOOGLE_SERVICE_ACCOUNT` — même JSON en ligne (Docker/prod sans fichier).
 *  3. `GOOGLE_CLIENT_EMAIL` + `GOOGLE_PRIVATE_KEY` — paire éclatée (sealed secrets).
 *  4. `google.json` à la racine du process (dev/legacy).
 *  5. Découverte ADC standard (metadata GCE), si un projet est configuré.
 *
 * Renvoie `null` quand aucune source n'est utilisable : l'appelant doit
 * dégrader proprement (liste vide, page affichable) plutôt que de lever.
 */
export function getServiceAccountAuth(
  scopes: string[],
): ServiceAccountAuth | null {
  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (credentialsPath && fs.existsSync(credentialsPath)) {
    return new google.auth.GoogleAuth({ keyFile: credentialsPath, scopes });
  }

  const inlineJson = process.env.GOOGLE_SERVICE_ACCOUNT;
  if (inlineJson && !isSealedBlob(inlineJson)) {
    try {
      return new google.auth.GoogleAuth({
        credentials: JSON.parse(inlineJson),
        scopes,
      });
    } catch (error) {
      console.error(
        "[google] GOOGLE_SERVICE_ACCOUNT n'est pas un JSON valide",
        error,
      );
    }
  }

  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY;
  if (clientEmail && privateKey) {
    if (isSealedBlob(clientEmail) || isSealedBlob(privateKey)) {
      console.error(
        "[google] identifiants inutilisables : secret scellé (eyJ2Ijoi…) au lieu du plaintext.",
      );
      return null;
    }
    return new google.auth.GoogleAuth({
      // Les sauts de ligne de la clé PEM sont stockés littéralement (`\n`).
      credentials: {
        client_email: clientEmail,
        private_key: privateKey.replaceAll(/\\n/g, "\n"),
      },
      scopes,
    });
  }

  const localKey = path.join(process.cwd(), "google.json");
  if (fs.existsSync(localKey)) {
    return new google.auth.GoogleAuth({ keyFile: localKey, scopes });
  }

  // Dernier recours : ADC via metadata GCE, seulement si un projet est déclaré.
  if (process.env.GOOGLE_CLOUD_PROJECT || process.env.GCE_METADATA_HOST) {
    return new google.auth.GoogleAuth({ scopes });
  }

  return null;
}
