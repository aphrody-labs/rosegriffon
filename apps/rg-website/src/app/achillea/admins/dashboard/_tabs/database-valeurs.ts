/**
 * Conversions de l'éditeur de lignes de l'onglet « Base de données ».
 *
 * Module PUR, testé : la saisie passe par des champs texte, et c'est ici
 * qu'on décide comment « 12 », « true » ou un tableau JSON redeviennent des
 * valeurs SQL. Reprise de `database-tab.ts` (Angular), avec une règle de plus :
 * seules les colonnes MODIFIÉES partent vers l'API, pour qu'une valeur masquée
 * par l'API (`[masqué]`) ne soit jamais réécrite telle quelle en base.
 */

import type { DbColumn } from "@rosegriffon/achillea-types/domain/admin";
import { z } from "zod";

// ── Sauvegardes (`/database/*`) ─────────────────────────────────────────────

/**
 * Formes de `/database/size` et `/database/backups`. Le client typé les rend
 * en `unknown` : elles sont validées ici, et une dérive de contrat devient une
 * erreur affichée plutôt qu'un écran vide.
 */
export const tailleBaseSchema = z.object({
  database: z.object({ bytes: z.number(), pretty: z.string() }),
  schema: z.object({ name: z.string(), bytes: z.number(), pretty: z.string() }),
});

export type TailleBase = z.infer<typeof tailleBaseSchema>;

export const sauvegardesSchema = z.object({
  data: z.array(z.object({ name: z.string(), sizeBytes: z.number(), createdAt: z.string() })),
  retention: z.number(),
});

export type ListeSauvegardes = z.infer<typeof sauvegardesSchema>;

/** Taille lisible en unités binaires. */
export function formaterOctets(octets: number): string {
  if (!Number.isFinite(octets) || octets < 0) return "—";
  const unites = ["o", "Kio", "Mio", "Gio", "Tio"];
  let valeur = octets;
  let index = 0;
  while (valeur >= 1024 && index < unites.length - 1) {
    valeur /= 1024;
    index++;
  }
  return `${index === 0 ? valeur : valeur.toFixed(1).replace(".", ",")} ${unites[index]}`;
}

/** Message d'un refus de sauvegarde ou de restauration, selon le contrat `/database`. */
export function messageRefusSauvegarde(statut: number | undefined): string | null {
  if (statut === 403) return "Refusé : rôle Super-Admin requis.";
  if (statut === 404) return "Archive introuvable.";
  if (statut === 409)
    return "Opération refusée : une sauvegarde ou une restauration est déjà en cours, ou la sauvegarde préalable à la restauration a échoué.";
  if (statut === 503) return "Outils PostgreSQL (pg_dump / pg_restore) absents de la machine de l'API.";
  if (statut === 500) return "L'outil de sauvegarde a échoué : voir les journaux de l'API.";
  return null;
}

// ── Éditeur de lignes ───────────────────────────────────────────────────────

/** Valeur que l'API substitue aux colonnes sensibles (secrets, jetons). */
export const VALEUR_MASQUEE = "[masqué]";

export type GenreChamp = "boolean" | "number" | "json" | "text";

export function genreColonne(dataType: string): GenreChamp {
  const type = dataType.toLowerCase();
  if (type === "boolean") return "boolean";
  // json/jsonb et tableaux Postgres (founders, languages…) : édition en JSON.
  if (type.includes("json") || type === "array" || type.endsWith("[]")) return "json";
  if (["int", "numeric", "real", "double", "decimal"].some(motif => type.includes(motif))) return "number";
  return "text";
}

/** Valeur d'une cellule pour un champ de saisie. */
export function versSaisie(valeur: unknown, genre: GenreChamp): string {
  if (valeur === null || valeur === undefined) return "";
  if (genre === "json") return JSON.stringify(valeur, null, 2);
  if (valeur instanceof Date) return valeur.toISOString();
  return String(valeur);
}

/** Saisie → valeur envoyée à l'API. Lève une `SyntaxError` sur un JSON invalide. */
export function depuisSaisie(brute: string, genre: GenreChamp): unknown {
  if (genre === "boolean") return brute === "true";
  if (genre === "number") {
    if (brute.trim() === "") return null;
    const nombre = Number(brute);
    if (!Number.isFinite(nombre)) throw new SyntaxError("Nombre invalide");
    return nombre;
  }
  if (genre === "json") return brute.trim() === "" ? null : JSON.parse(brute);
  return brute === "" ? null : brute;
}

/** Affichage compact d'une cellule dans la grille. */
export function apercuCellule(valeur: unknown): string {
  if (valeur === null || valeur === undefined) return "∅";
  if (typeof valeur === "object") {
    try {
      return JSON.stringify(valeur);
    } catch {
      return String(valeur);
    }
  }
  return String(valeur);
}

/** Clé primaire complète d'une ligne, ou `null` si la table n'en a pas. */
export function clePrimaire(colonnes: readonly DbColumn[], ligne: Record<string, unknown>): Record<string, unknown> | null {
  const cles = colonnes.filter(colonne => colonne.isPrimaryKey);
  if (cles.length === 0) return null;
  return Object.fromEntries(cles.map(colonne => [colonne.name, ligne[colonne.name]]));
}

/** Valeurs d'une insertion : seuls les champs remplis partent, la base complète le reste. */
export function valeursInsertion(
  colonnes: readonly DbColumn[],
  saisie: Readonly<Record<string, string>>,
): Record<string, unknown> {
  const sortie: Record<string, unknown> = {};
  for (const colonne of colonnes) {
    const valeur = saisie[colonne.name] ?? "";
    if (valeur === "") continue;
    try {
      sortie[colonne.name] = depuisSaisie(valeur, genreColonne(colonne.dataType));
    } catch {
      throw new SyntaxError(`Valeur invalide pour « ${colonne.name} ».`);
    }
  }
  return sortie;
}

/**
 * Message d'un refus de la console SQL ou de l'éditeur.
 *
 * Le client ne transmet pas le corps de la réponse d'erreur, seulement son
 * statut : on traduit donc le statut selon le contrat de `/admin/db`.
 */
export function messageRefusDb(statut: number | undefined): string | null {
  if (statut === 400) return "Requête refusée : une seule instruction SELECT/WITH, sur des tables autorisées.";
  if (statut === 403) return "Refusé : rôle Super-Admin requis, ou console SQL désactivée en production.";
  if (statut === 404) return "Table ou ligne introuvable.";
  if (statut === 408 || statut === 504) return "Requête interrompue : délai d'exécution dépassé.";
  if (statut === 413) return "Résultat trop volumineux.";
  return null;
}

/**
 * Valeurs modifiées entre la saisie initiale et la saisie courante.
 *
 * Les clés primaires et les champs restés masqués sont exclus ; une saisie
 * invalide lève avec le nom de la colonne fautive.
 */
export function valeursModifiees(
  colonnes: readonly DbColumn[],
  initiale: Readonly<Record<string, string>>,
  courante: Readonly<Record<string, string>>,
): Record<string, unknown> {
  const sortie: Record<string, unknown> = {};
  for (const colonne of colonnes) {
    if (colonne.isPrimaryKey) continue;
    const valeur = courante[colonne.name] ?? "";
    if (valeur === (initiale[colonne.name] ?? "")) continue;
    if (valeur === VALEUR_MASQUEE) continue;
    try {
      sortie[colonne.name] = depuisSaisie(valeur, genreColonne(colonne.dataType));
    } catch {
      throw new SyntaxError(`Valeur invalide pour « ${colonne.name} ».`);
    }
  }
  return sortie;
}
