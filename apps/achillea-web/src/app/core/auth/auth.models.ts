/**
 * Modèles d'authentification côté web.
 *
 * L'utilisateur de session EST le `SessionUserDTO` du contrat : le déclarer
 * une seconde fois ici avait fait diverger les deux formes (`type` manquant,
 * rangs sans dégradé).
 */

import type { SessionUserDTO } from "@rosegriffon/achillea-types";

export type AuthStatus = "unknown" | "loading" | "authenticated" | "anonymous" | "error";

export type AuthUser = SessionUserDTO;
