// SPDX-License-Identifier: Apache-2.0
// Modèle commun du Feed (types, normaliseurs purs, format des instantanés), partagé entre le site
// (lecture en direct, rendu) et le cron `feed:sync` (lecture en tâche de fond). Sûr côté client :
// aucun import serveur, aucun accès réseau. Chaque réseau est normalisé vers `PostFeed` ; l'interface
// ne connaît que ce format.

export type Reseau = "x" | "instagram" | "tiktok" | "youtube";

export type Groupe = "Rose Griffon" | "Inazuma Eleven" | "LEVEL-5";

export interface MediaFeed {
  type: "image" | "video" | "gif";
  url: string;
  apercu?: string;
  largeur?: number;
  hauteur?: number;
  /** Durée en secondes (vidéos sondées par `Bun.Video`). */
  duree?: number;
}

export interface AuteurFeed {
  pseudo: string;
  nom: string;
  avatar?: string;
  certifie?: boolean;
  lien: string;
}

export interface MetriquesFeed {
  reponses?: number;
  partages?: number;
  jaime?: number;
  vues?: number;
}

/** Lecteur intégré (iframe publique du réseau), chargé seulement au clic. */
export interface IntegrationFeed {
  url: string;
  /** largeur / hauteur */
  ratio: number;
  titre: string;
}

export interface PostFeed {
  /** Identifiant unique dans le fil : `<réseau>:<id d'origine>`. */
  id: string;
  idOrigine: string;
  reseau: Reseau;
  auteur: AuteurFeed;
  texte: string;
  medias: MediaFeed[];
  /** ISO 8601 */
  date: string;
  metriques?: MetriquesFeed;
  /** Lien vers la publication sur le réseau d'origine. */
  lien: string;
  citation?: PostFeed;
  integration?: IntegrationFeed;
  /** Compte suivi (pseudo) dont provient le post, et son groupe, pour les filtres. */
  compte?: string;
  groupe?: Groupe;
}

export interface ProfilFeed {
  reseau: Reseau;
  pseudo: string;
  nom: string;
  avatar?: string;
  banniere?: string;
  bio?: string;
  site?: { affichage: string; url: string };
  abonnes?: number;
  abonnements?: number;
  publications?: number;
  rejointLe?: string;
  certifie?: boolean;
  lien: string;
}

export type EtatSource = "ok" | "vide" | "indisponible";

export interface StatutSource {
  reseau: Reseau;
  etat: EtatSource;
  /** Phrase affichée à l'utilisateur quand la source est vide ou en panne. */
  message?: string;
}

/** Une page rendue par une source. */
export interface PageSource {
  posts: PostFeed[];
  profils: ProfilFeed[];
  /** Curseur opaque de la page suivante ; absent à la fin. */
  curseur?: string;
  statut: StatutSource;
}

/**
 * Instantané d'une source non temps réel, écrit par le cron `feed:sync` (bucket `assets`,
 * `feed/snapshots/<réseau>.json`) et servi instantanément par le site.
 */
export interface SnapshotFeed {
  version: 1;
  reseau: Reseau;
  /** ISO 8601 de la dernière synchronisation réussie. */
  genereLe: string;
  posts: PostFeed[];
  profils: ProfilFeed[];
  statut: StatutSource;
}

export const CHEMIN_SNAPSHOT = (reseau: Reseau): string => `feed/snapshots/${reseau}.json`;

export function lireSnapshot(valeur: unknown, reseau: Reseau): SnapshotFeed | null {
  if (!valeur || typeof valeur !== "object") return null;
  const s = valeur as Partial<SnapshotFeed>;
  if (s.version !== 1 || s.reseau !== reseau || !Array.isArray(s.posts) || !Array.isArray(s.profils) || !s.statut)
    return null;
  if (typeof s.genereLe !== "string" || Number.isNaN(Date.parse(s.genereLe))) return null;
  return s as SnapshotFeed;
}

export interface FilUnifie {
  posts: PostFeed[];
  /** Clé : `<réseau>:<pseudo en minuscules>`. */
  profils: Record<string, ProfilFeed>;
  sources: StatutSource[];
  curseur?: string;
  recuLe: string;
}

export interface CompteSource {
  reseau: Reseau;
  pseudo: string;
  nom: string;
  groupe: Groupe;
}

export interface ParametresLecture {
  comptes: readonly CompteSource[];
  curseur?: string;
}

/**
 * Contrat d'une source : un réseau, ses comptes, une lecture paginée déjà normalisée.
 * `lire` ne doit jamais rejeter pour une panne réseau attendue : elle rend un statut
 * `indisponible` ; le fil unifié tolère de toute façon un rejet (une source ne casse pas les autres).
 */
export interface SourceFeed {
  reseau: Reseau;
  comptes: readonly CompteSource[];
  lire(parametres: ParametresLecture): Promise<PageSource>;
}

export const cleProfil = (reseau: Reseau, pseudo: string): string => `${reseau}:${pseudo.toLowerCase()}`;
