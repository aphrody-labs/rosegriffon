"use client";

import { useEffect, useState } from "react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@rosegriffon/ui";
import { Loader2, XCircle } from "lucide-react";
import { signalerEchec } from "@/lib/achillea/signaler";
import type { RankedActivePlayer } from "@rosegriffon/achillea-types/domain/ranked";
import { BoutonActualiser, Chargement, Erreur, Vide, formaterDate, useClientAchillea, useLecture } from "./etat";

/** Rafraîchissement de la liste live, comme l'ancien onglet. */
export const INTERVALLE_RAFRAICHISSEMENT_MS = 15_000;

/** Mode 4 = 2v2, le reste = 1v1 (énumération `MatchMode`). */
function libelleMode(mode: number): string {
  return mode === 4 ? "2v2" : "1v1";
}

function Joueur({ joueur }: { joueur: RankedActivePlayer }) {
  return (
    <span className="flex flex-col">
      <span className="font-medium">{joueur.displayName}</span>
      <span className="text-xs text-muted-foreground">
        {joueur.submitted ? "Score déclaré" : "En attente"}
        {joueur.hasProof ? " · preuve" : ""}
      </span>
    </span>
  );
}

/** « Matchs en cours » — lobbies ranked `Ongoing`, rafraîchis toutes les 15 s. */
export function RankedActiveTab() {
  const client = useClientAchillea();
  const matchs = useLecture("admin/lobbies/active", () => client.ranked.adminActiveMatches());
  const [annulation, setAnnulation] = useState<number | null>(null);
  const [erreurAnnulation, setErreurAnnulation] = useState<string | null>(null);
  const { recharger } = matchs;

  useEffect(() => {
    const minuterie = setInterval(recharger, INTERVALLE_RAFRAICHISSEMENT_MS);
    return () => clearInterval(minuterie);
  }, [recharger]);

  const annuler = async (lobbyId: number) => {
    if (!confirm(`Annuler le lobby #${lobbyId} ? Aucun point ne sera appliqué.`)) return;
    setAnnulation(lobbyId);
    setErreurAnnulation(null);
    try {
      const resultat = await client.ranked.adminCancelLobby(lobbyId);
      if (resultat.ok) recharger();
      else setErreurAnnulation(signalerEchec("admin/lobbies/cancel", resultat));
    } finally {
      setAnnulation(null);
    }
  };

  const liste = matchs.donnees ?? [];

  return (
    <Card className="border-border/60">
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div className="space-y-1">
          <CardTitle className="text-base">Matchs en cours ({liste.length})</CardTitle>
          <p className="text-xs text-muted-foreground">Actualisation automatique toutes les 15 secondes.</p>
        </div>
        <BoutonActualiser enCours={matchs.chargement} onClick={recharger} />
      </CardHeader>
      <CardContent className="space-y-4">
        {matchs.erreur && <Erreur message={matchs.erreur} onReessayer={recharger} />}
        {erreurAnnulation && <Erreur message={`Annulation impossible : ${erreurAnnulation}`} />}
        {matchs.chargement && !matchs.donnees ? (
          <Chargement />
        ) : liste.length === 0 && !matchs.erreur ? (
          <Vide message="Aucun match ranked en cours." />
        ) : (
          liste.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lobby</TableHead>
                  <TableHead>Mode</TableHead>
                  <TableHead>Domicile</TableHead>
                  <TableHead className="text-center">Score</TableHead>
                  <TableHead>Extérieur</TableHead>
                  <TableHead>Début</TableHead>
                  <TableHead>
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {liste.map(match => (
                  <TableRow key={match.lobbyId}>
                    <TableCell className="font-mono">#{match.lobbyId}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{libelleMode(match.mode)}</Badge>
                    </TableCell>
                    <TableCell>
                      <Joueur joueur={match.player1} />
                    </TableCell>
                    <TableCell className="text-center font-mono font-semibold">
                      {match.player1.score} – {match.player2.score}
                    </TableCell>
                    <TableCell>
                      <Joueur joueur={match.player2} />
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs">{formaterDate(match.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        className="min-h-11 gap-2 text-destructive"
                        disabled={annulation === match.lobbyId}
                        onClick={() => void annuler(match.lobbyId)}
                        aria-label={`Annuler le lobby ${match.lobbyId}`}
                      >
                        {annulation === match.lobbyId ? (
                          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                        ) : (
                          <XCircle className="size-4" aria-hidden="true" />
                        )}
                        Annuler
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )
        )}
      </CardContent>
    </Card>
  );
}
