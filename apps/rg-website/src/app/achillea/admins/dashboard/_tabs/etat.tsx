"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, Skeleton } from "@rosegriffon/ui";
import { AlertTriangle, Inbox, RefreshCw } from "lucide-react";
import { createAchilleaClient } from "@/lib/achillea";
import { signalerEchec, signalerException } from "@/lib/achillea/signaler";
import type { AchilleaClient, AchilleaClientResult } from "@rosegriffon/achillea-client";

/** Client Achilléa avec cookie de session, stable sur la vie du composant. */
export function useClientAchillea(): AchilleaClient {
  return useMemo(() => createAchilleaClient({ credentials: "include" }), []);
}

/**
 * États partagés des onglets du back-office : chargement, vide, erreur.
 *
 * Chaque onglet lisait son API avec `.catch(() => {})` : une panne et une
 * table vide s'affichaient pareil. Ici l'erreur a toujours un message et un
 * bouton « Réessayer ».
 */

export function Chargement({ lignes = 3, libelle = "Chargement…" }: { lignes?: number; libelle?: string }) {
  return (
    <div aria-live="polite" aria-busy="true" className="space-y-3">
      <span className="sr-only">{libelle}</span>
      {Array.from({ length: lignes }, (_, index) => (
        <Skeleton key={index} className="h-12 w-full rounded-xl" />
      ))}
    </div>
  );
}

export function Vide({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">
      <Inbox className="size-6" aria-hidden="true" />
      <p>{message}</p>
    </div>
  );
}

export function Erreur({ message, onReessayer }: { message: string; onReessayer?: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-col gap-3 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive sm:flex-row sm:items-center sm:justify-between"
    >
      <span className="flex items-center gap-2">
        <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
        {message}
      </span>
      {onReessayer && (
        <Button variant="outline" onClick={onReessayer} className="min-h-11 gap-2">
          <RefreshCw className="size-4" aria-hidden="true" />
          Réessayer
        </Button>
      )}
    </div>
  );
}

/** Bouton « Actualiser » commun aux en-têtes d'onglet. */
export function BoutonActualiser({ onClick, enCours }: { onClick: () => void; enCours: boolean }) {
  return (
    <Button variant="outline" onClick={onClick} disabled={enCours} className="min-h-11 gap-2">
      <RefreshCw className={`size-4 ${enCours ? "animate-spin" : ""}`} aria-hidden="true" />
      Actualiser
    </Button>
  );
}

/**
 * Message d'un échec de lecture.
 *
 * `/health/*` et `/stats/*` répondent 503 quand le bot Discord est
 * injoignable : on le dit tel quel plutôt que d'afficher des zéros ou un
 * « service indisponible » qui laisserait chercher une panne de l'API.
 */
export function messageEchecLecture(contexte: string, resultat: AchilleaClientResult<unknown>): string {
  const message = signalerEchec(contexte, resultat);
  // `signalerEchec` montre déjà le texte de l'API (« Bot Discord Achilléa
  // indisponible : … ») ; le texte propre au 503 ne sert que s'il n'y en a pas.
  if (!resultat.ok && resultat.kind === "http" && resultat.status === 503 && !resultat.message?.trim())
    return "Le bot Discord Achilléa est injoignable : ces mesures viennent de lui.";
  return message;
}

export interface Lecture<T> {
  donnees: T | null;
  chargement: boolean;
  erreur: string | null;
  recharger: () => void;
}

/**
 * Lit une ressource Achilléa au montage, puis à chaque `recharger()`.
 *
 * Une réponse arrivée après le démontage ou après une lecture plus récente
 * est ignorée : un rafraîchissement périodique ne peut pas écraser un état
 * plus frais par un plus ancien.
 */
export function useLecture<T>(contexte: string, lire: () => Promise<AchilleaClientResult<T>>): Lecture<T> {
  const [donnees, setDonnees] = useState<T | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const generation = useRef(0);
  const lireRef = useRef(lire);
  // Déclaré avant l'effet de lecture : React exécute les effets dans l'ordre.
  useEffect(() => {
    lireRef.current = lire;
  });

  // Les mises à jour d'état n'arrivent qu'à la résolution de la lecture : l'effet initial
  // n'appelle donc aucun `setState` de façon synchrone (`chargement` part déjà à vrai).
  const lancer = useCallback((courante: number) => {
    lireRef
      .current()
      .then(resultat => {
        if (courante !== generation.current) return;
        if (resultat.ok) {
          setDonnees(resultat.value);
          setErreur(null);
        } else {
          setDonnees(null);
          setErreur(messageEchecLecture(contexte, resultat));
        }
      })
      .catch(cause => {
        if (courante === generation.current) setErreur(signalerException(contexte, cause));
      })
      .finally(() => {
        if (courante === generation.current) setChargement(false);
      });
  }, [contexte]);

  const recharger = useCallback(() => {
    setChargement(true);
    lancer(++generation.current);
  }, [lancer]);

  useEffect(() => {
    lancer(++generation.current);
    return () => {
      generation.current++;
    };
  }, [lancer]);

  return { donnees, chargement, erreur, recharger };
}

/** Date lisible en français, « — » si absente ou invalide. */
export function formaterDate(valeur: string | Date | null | undefined): string {
  if (!valeur) return "—";
  const date = valeur instanceof Date ? valeur : new Date(valeur);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
}
