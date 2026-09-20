/**
 * Constantes Discord — module PUR, lisible côté serveur ET client.
 *
 * Elles vivaient dans `components/shared/DiscordSection.tsx`, marqué
 * `"use client"` : un export lu depuis un composant serveur (l'accueil) passe
 * le `type-check` et fait exploser `next build` en silence. Toute constante
 * partagée serveur/client doit vivre dans un module sans directive.
 */

/** Serveur Rose Griffon interrogé via le widget public de Discord. */
export const ID_SERVEUR_DISCORD = "1072991720268111892";

/** Invitation unique de la communauté (le widget n'en renvoie pas toujours). */
export const INVITATION_DISCORD = "https://discord.com/invite/rosegriffon";
