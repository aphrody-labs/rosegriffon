// SPDX-License-Identifier: Apache-2.0
// Point d'entrée serveur du Feed : les trois sources branchées sur le fil unifié.
import type { FiltreFil } from "./comptes";
import { composerFil } from "./fil";
import { sourceInstagram } from "./sources/instagram";
import { sourceTiktok } from "./sources/tiktok";
import { sourceYoutube } from "./sources/youtube";
import { conversationX, rechercherX, sourceX } from "./sources/x";
import type { FilUnifie } from "./types";

export const SOURCES = [sourceX, sourceInstagram, sourceTiktok, sourceYoutube] as const;

export function lireFil(filtre: FiltreFil, curseur?: string): Promise<FilUnifie> {
  return composerFil(SOURCES, filtre, curseur);
}

export { conversationX, rechercherX };
export { estIdPost } from "./live";
