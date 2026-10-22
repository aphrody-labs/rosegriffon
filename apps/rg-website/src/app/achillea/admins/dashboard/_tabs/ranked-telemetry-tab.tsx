"use client";

import { useState, type FormEvent } from "react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@rosegriffon/ui";
import { Filter, X } from "lucide-react";
import { BoutonActualiser, Chargement, Erreur, Vide, formaterDate, useClientAchillea, useLecture } from "./etat";

/** Résumé compact du détail JSON d'un événement. */
function resumerDetail(detail: Record<string, unknown> | null | undefined): string {
  if (!detail) return "";
  try {
    return JSON.stringify(detail);
  } catch {
    return "";
  }
}

/** « Télémétrie » — 200 derniers événements `ranked_match_event`, filtrables par lobby. */
export function RankedTelemetryTab() {
  const client = useClientAchillea();
  const [saisie, setSaisie] = useState("");
  const [lobbyId, setLobbyId] = useState<number | null>(null);
  const journal = useLecture(`admin/ranked/telemetry#${lobbyId ?? "tous"}`, () =>
    client.ranked.adminTelemetry(lobbyId ? { lobbyId, limit: 200 } : { limit: 200 }),
  );
  const evenements = journal.donnees ?? [];

  const filtrer = (event: FormEvent) => {
    event.preventDefault();
    const valeur = Number.parseInt(saisie.trim(), 10);
    setLobbyId(Number.isInteger(valeur) && valeur > 0 ? valeur : null);
  };

  return (
    <Card className="border-border/60">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <CardTitle className="text-base">Télémétrie ranked ({evenements.length})</CardTitle>
          <p className="text-xs text-muted-foreground">
            {lobbyId ? `Lobby #${lobbyId}` : "Tous les lobbies"} · 200 derniers événements
          </p>
        </div>
        <BoutonActualiser enCours={journal.chargement} onClick={journal.recharger} />
      </CardHeader>
      <CardContent className="space-y-4">
        <form className="flex flex-wrap items-end gap-2" onSubmit={filtrer}>
          <div className="space-y-1">
            <Label htmlFor="telemetrie-lobby">Filtrer par lobby</Label>
            <Input
              id="telemetrie-lobby"
              inputMode="numeric"
              value={saisie}
              onChange={event => setSaisie(event.target.value)}
              placeholder="ID du lobby"
              className="min-h-11 w-40 font-mono"
            />
          </div>
          <Button type="submit" variant="outline" className="min-h-11 gap-2">
            <Filter className="size-4" aria-hidden="true" />
            Filtrer
          </Button>
          {lobbyId !== null && (
            <Button
              type="button"
              variant="ghost"
              className="min-h-11 gap-2"
              onClick={() => {
                setSaisie("");
                setLobbyId(null);
              }}
            >
              <X className="size-4" aria-hidden="true" />
              Retirer le filtre
            </Button>
          )}
        </form>

        {journal.erreur && <Erreur message={journal.erreur} onReessayer={journal.recharger} />}
        {journal.chargement && !journal.donnees ? (
          <Chargement lignes={5} />
        ) : evenements.length === 0 && !journal.erreur ? (
          <Vide message="Aucun événement pour ce filtre." />
        ) : (
          evenements.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Lobby</TableHead>
                  <TableHead>Salle</TableHead>
                  <TableHead>Joueur</TableHead>
                  <TableHead>Détail</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {evenements.map(evenement => (
                  <TableRow key={evenement.id}>
                    <TableCell className="whitespace-nowrap text-xs">{formaterDate(evenement.createdAt)}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="font-mono">
                        {evenement.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono">
                      {evenement.lobbyId != null ? `#${evenement.lobbyId}` : "—"}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{evenement.roomCode ?? "—"}</TableCell>
                    <TableCell className="text-xs">{evenement.displayName ?? evenement.userId ?? "—"}</TableCell>
                    <TableCell className="max-w-md truncate font-mono text-xs" title={resumerDetail(evenement.detail)}>
                      {resumerDetail(evenement.detail)}
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
