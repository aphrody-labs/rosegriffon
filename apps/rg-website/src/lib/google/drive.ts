import "server-only";

import { google } from "googleapis";

import { getServiceAccountAuth } from "./auth";

/**
 * Accès en lecture au Drive partagé de l'association.
 *
 * Authentification par **compte de service** (`calendar-service@rgfr-8927d`)
 * via le helper partagé `getServiceAccountAuth`, pas par le client OAuth web :
 * le tableau de bord lit des dossiers partagés avec ce compte, sans qu'un
 * administrateur ait à se connecter.
 */

const SCOPES = ["https://www.googleapis.com/auth/drive.readonly"];

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string | null;
  size: number | null;
  webViewLink: string | null;
  isFolder: boolean;
}

/** Libellé lisible d'un type MIME Google. */
export function describeMimeType(mimeType: string): string {
  const map: Record<string, string> = {
    "application/pdf": "PDF",
    "application/vnd.google-apps.document": "Document",
    "application/vnd.google-apps.folder": "Dossier",
    "application/vnd.google-apps.presentation": "Présentation",
    "application/vnd.google-apps.spreadsheet": "Feuille de calcul",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
      "Classeur Excel",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      "Document Word",
  };
  if (map[mimeType]) {
    return map[mimeType];
  }
  if (mimeType.startsWith("image/")) {
    return "Image";
  }
  if (mimeType.startsWith("video/")) {
    return "Vidéo";
  }
  return mimeType.split("/").pop() ?? mimeType;
}

/**
 * Derniers fichiers modifiés du Drive partagé.
 *
 * Renvoie une liste vide plutôt que de lever : le tableau de bord doit rester
 * affichable si Google est indisponible ou si les identifiants manquent.
 */
export async function listRecentDriveFiles(limit = 8): Promise<DriveFile[]> {
  const auth = getServiceAccountAuth(SCOPES);
  if (!auth) {
    return [];
  }

  try {
    const drive = google.drive({ auth, version: "v3" });
    const res = await drive.files.list({
      fields: "files(id,name,mimeType,modifiedTime,size,webViewLink)",
      orderBy: "modifiedTime desc",
      pageSize: limit,
      // Inclut les Drive partagés, sinon seuls les fichiers appartenant en
      // propre au compte de service remontent — c'est-à-dire aucun.
      includeItemsFromAllDrives: true,
      supportsAllDrives: true,
      q: "trashed = false",
    });

    return (res.data.files ?? []).map((file) => ({
      id: file.id ?? "",
      isFolder: file.mimeType === "application/vnd.google-apps.folder",
      mimeType: file.mimeType ?? "",
      modifiedTime: file.modifiedTime ?? null,
      name: file.name ?? "Sans nom",
      size: file.size ? Number(file.size) : null,
      webViewLink: file.webViewLink ?? null,
    }));
  } catch (error) {
    console.error("[drive] listing impossible", error);
    return [];
  }
}
