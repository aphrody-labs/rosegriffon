"use client";

import Link from "next/link";
import {
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
import { ExternalLink } from "lucide-react";
import { BoutonActualiser, Chargement, Erreur, Vide, useClientAchillea, useLecture } from "./etat";

/** « Ligues » — championnats déclarés et classement de l'Astral League. */
export function LeaguesTab() {
  const client = useClientAchillea();
  const ligues = useLecture("leagues", () => client.leagues.list());
  const astral = useLecture("leagues/astral", () => client.leagues.astral());
  const liste = ligues.donnees?.items ?? [];
  const equipes = new Map((astral.donnees?.teams ?? []).map(equipe => [equipe.tag, equipe.name]));
  const classement = astral.donnees?.standings ?? [];

  return (
    <div className="space-y-6">
      <Card className="border-border/60">
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle className="text-base">Ligues ({liste.length})</CardTitle>
          <BoutonActualiser
            enCours={ligues.chargement}
            onClick={() => {
              ligues.recharger();
              astral.recharger();
            }}
          />
        </CardHeader>
        <CardContent className="space-y-4">
          {ligues.erreur && <Erreur message={ligues.erreur} onReessayer={ligues.recharger} />}
          {ligues.chargement && !ligues.donnees ? (
            <Chargement lignes={2} />
          ) : liste.length === 0 && !ligues.erreur ? (
            <Vide message="Aucune ligue déclarée." />
          ) : (
            liste.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ligue</TableHead>
                    <TableHead>Saison</TableHead>
                    <TableHead>Format</TableHead>
                    <TableHead className="text-right">Équipes</TableHead>
                    <TableHead>Champion</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {liste.map(ligue => (
                    <TableRow key={ligue.id}>
                      <TableCell className="font-medium">{ligue.name}</TableCell>
                      <TableCell>{ligue.season}</TableCell>
                      <TableCell className="text-xs">{ligue.format}</TableCell>
                      <TableCell className="text-right font-mono">{ligue.teamCount}</TableCell>
                      <TableCell>{ligue.champion || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )
          )}
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle className="text-base">Astral League — classement</CardTitle>
          <Button asChild variant="outline" className="min-h-11 gap-2">
            <Link href="/achillea/leagues/astral">
              <ExternalLink className="size-4" aria-hidden="true" />
              Page publique
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {astral.erreur && <Erreur message={astral.erreur} onReessayer={astral.recharger} />}
          {astral.chargement && !astral.donnees ? (
            <Chargement lignes={3} />
          ) : classement.length === 0 && !astral.erreur ? (
            <Vide message="Classement vide." />
          ) : (
            classement.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Équipe</TableHead>
                    <TableHead className="text-right">Joués</TableHead>
                    <TableHead className="text-right">Points</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {classement.map(ligne => (
                    <TableRow key={ligne.teamId}>
                      <TableCell className="font-mono">{ligne.rank}</TableCell>
                      <TableCell>{equipes.get(ligne.teamId) ?? ligne.teamId}</TableCell>
                      <TableCell className="text-right font-mono">{ligne.played}</TableCell>
                      <TableCell className="text-right font-mono font-semibold">{ligne.points}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )
          )}
        </CardContent>
      </Card>
    </div>
  );
}
