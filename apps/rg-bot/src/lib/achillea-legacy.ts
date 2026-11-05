/**
 * Rendu « comme l'ancien bot » des réponses Achilléa.
 *
 * Les commandes du profil Achilléa sont construites avec `lib/ui` (budget tenu,
 * textes bornés), mais l'ancien bot (`legacy/achillea-bot`) posait ses propres
 * couleurs — celles de `discord.js` (`Colors.*`) — et AUCUN pied de marque :
 * seulement l'horodatage, et une note de pied quand la liste débordait. Les
 * joueurs ont appris ces couleurs ; ce module les rend à l'identique.
 */
import { Colors, EmbedBuilder } from "discord.js";

import type { Fiche } from "./ui";

/** Couleurs posées par l'ancien bot, au bit près (`Colors` de discord.js). */
export const COULEURS_LEGACY = Object.freeze({
  vert: Colors.Green,
  rouge: Colors.Red,
  rougeFonce: Colors.DarkRed,
  orange: Colors.Orange,
  jaune: Colors.Yellow,
  bleu: Colors.Blue,
  bleuFonce: Colors.DarkBlue,
  or: Colors.Gold,
  blurple: Colors.Blurple,
  presqueNoir: Colors.NotQuiteBlack,
});

/**
 * Termine une `Fiche` comme l'ancien bot : couleur imposée, pas de pied de
 * marque, un pied texte seulement quand l'ancien en posait un.
 */
export function finirCommeLegacy(f: Fiche, couleur: number, piedTexte?: string | null): EmbedBuilder {
  f.couleur(couleur);
  if (piedTexte) f.embed.setFooter({ text: piedTexte });
  return f.embed;
}

/** `followUpWithSuccessEmbed` de l'ancien bot : vert, titre `✅ message`, sans horodatage. */
export function embedSuccesLegacy(message: string): EmbedBuilder {
  return new EmbedBuilder().setColor(0x57_f2_87).setTitle(`✅ ${message}`.slice(0, 256));
}

/** `formatBytes` de `/ping` dans l'ancien bot : `512 B`, `1.5 KB`, `42.0 MB`, `1.25 GB`. */
export function octetsLegacy(octets: number): string {
  if (octets < 1024) return `${octets} B`;
  const ko = octets / 1024;
  if (ko < 1024) return `${ko.toFixed(1)} KB`;
  const mo = ko / 1024;
  if (mo < 1024) return `${mo.toFixed(1)} MB`;
  return `${(mo / 1024).toFixed(2)} GB`;
}

/** `formatUptime` de `/ping` dans l'ancien bot : `1j 2h 3m 4s` (secondes en entrée). */
export function dureeLegacy(secondes: number): string {
  const j = Math.floor(secondes / 86_400);
  const h = Math.floor((secondes % 86_400) / 3600);
  const m = Math.floor((secondes % 3600) / 60);
  const s = Math.floor(secondes % 60);
  const parts: string[] = [];
  if (j) parts.push(`${j}j`);
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  parts.push(`${s}s`);
  return parts.join(" ");
}

/** `formatFrenchDate` de l'ancien bot : « 27 oct. à 12h02 », heure de Paris. */
export function dateFrancaiseLegacy(valeur: Date | string | null | undefined): string {
  const date = valeur instanceof Date ? valeur : new Date(valeur ?? Date.now());
  if (!Number.isFinite(date.getTime())) return "—";
  return date
    .toLocaleString("fr-FR", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "Europe/Paris",
    })
    .replace(",", " à")
    .replace(":", "h");
}

/** `followUpWithErrorEmbed` de l'ancien bot : rouge, titre `❌ message`, sans horodatage. */
export function embedEchecLegacy(message: string): EmbedBuilder {
  return new EmbedBuilder().setColor(Colors.Red).setTitle(`❌ ${message}`.slice(0, 256));
}
