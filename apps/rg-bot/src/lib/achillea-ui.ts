/**
 * Appui commun des commandes du profil Achilléa.
 *
 * Toute commande métier suit le même chemin :
 *
 *     1. différer (privé quand la réponse ne regarde que l'auteur) ;
 *     2. `appelApi(interaction, c => c.clans.myRole(), "Rôle introuvable")` —
 *        le client est signé pour l'AUTEUR de l'interaction, l'échec est
 *        déjà rendu à l'écran, la valeur revient sinon ;
 *     3. construire la réponse avec `lib/ui`.
 *
 * Ce module ne parle à aucune base : il ne fait que relier une interaction
 * discord.js à `lib/achillea-api.ts`.
 */
import {
  PermissionFlagsBits,
  type GuildMember,
  type RepliableInteraction,
} from "discord.js";

import {
  clientAchilleaPour,
  ConfigurationApiAchillea,
  identiteDe,
  type AchilleaClientResult,
  type ClientAchilleaDelegue,
} from "./achillea-api";
import { RG_BASE_URL } from "./config";
import { echec, repondre } from "./ui";

/** Client Achilléa signé pour l'auteur de l'interaction. */
export function clientDe(interaction: { user: { id: string; username?: string | null; avatar?: string | null } }): ClientAchilleaDelegue {
  return clientAchilleaPour(identiteDe(interaction.user));
}

/**
 * Appelle l'API au nom de l'auteur et rend la valeur, ou `null` après avoir
 * affiché l'échec. L'interaction doit déjà être différée (ou le sera par
 * `repondre`, qui choisit `reply`/`editReply` selon son état).
 */
export async function appelApi<T>(
  interaction: RepliableInteraction,
  appel: (client: ClientAchilleaDelegue) => Promise<AchilleaClientResult<T>>,
  titreEchec: string,
): Promise<T | null> {
  let client: ClientAchilleaDelegue;
  try {
    client = clientDe(interaction);
  } catch (err) {
    if (err instanceof ConfigurationApiAchillea) {
      await repondre(interaction, echec(titreEchec, err.message));
      return null;
    }
    throw err;
  }
  const resultat = await appel(client);
  if (resultat.ok) return resultat.value;
  await repondre(interaction, echec(titreEchec, client.motifEchec(resultat)));
  return null;
}

/**
 * Comme `appelApi`, sans rien afficher : rend le résultat et le motif lisible.
 * Pour les écrans qui composent plusieurs lectures et tolèrent qu'une manque.
 */
export async function lireApi<T>(
  interaction: { user: { id: string; username?: string | null; avatar?: string | null } },
  appel: (client: ClientAchilleaDelegue) => Promise<AchilleaClientResult<T>>,
): Promise<{ ok: true; valeur: T } | { ok: false; motif: string }> {
  let client: ClientAchilleaDelegue;
  try {
    client = clientDe(interaction);
  } catch (err) {
    if (err instanceof ConfigurationApiAchillea) return { ok: false, motif: err.message };
    throw err;
  }
  const resultat = await appel(client);
  return resultat.ok ? { ok: true, valeur: resultat.value } : { ok: false, motif: client.motifEchec(resultat) };
}

/** Lien absolu vers une page du site Achilléa (`ACHILLEA_WEBSITE_URL`, sinon rosegriffon.fr/achillea). */
export function urlAchillea(chemin = "/"): string {
  return `${RG_BASE_URL}${chemin.startsWith("/") ? chemin : `/${chemin}`}`;
}

/**
 * Le membre peut-il administrer CE serveur Discord ? (Gérer le serveur ou Administrateur.)
 *
 * Lecture purement Discord : c'est l'équivalent de la garde `GuildAdminOnly`
 * de l'ancien bot, pour les réglages qui décrivent un serveur et non un joueur.
 */
export function administreLeServeur(membre: GuildMember | null | undefined | { permissions?: unknown }): boolean {
  const permissions = (membre as GuildMember | null | undefined)?.permissions;
  if (!permissions || typeof permissions === "string" || typeof (permissions as { has?: unknown }).has !== "function")
    return false;
  return (
    permissions.has(PermissionFlagsBits.Administrator) || permissions.has(PermissionFlagsBits.ManageGuild)
  );
}
