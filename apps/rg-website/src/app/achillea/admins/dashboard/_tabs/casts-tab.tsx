"use client";

import Link from "next/link";
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
import { CalendarClock, ExternalLink } from "lucide-react";
import { CastEventStatus } from "@rosegriffon/achillea-types/enums/cast";
import { BoutonActualiser, Chargement, Erreur, Vide, formaterDate, useClientAchillea, useLecture } from "./etat";

const LIBELLES_STATUT: Record<CastEventStatus, string> = {
  [CastEventStatus.Planned]: "Planifié",
  [CastEventStatus.OpenSignup]: "Inscriptions ouvertes",
  [CastEventStatus.Attributed]: "Attribué",
  [CastEventStatus.Live]: "En direct",
  [CastEventStatus.Done]: "Terminé",
  [CastEventStatus.Cancelled]: "Annulé",
};

function varianteStatut(statut: CastEventStatus): "default" | "secondary" | "destructive" | "success" | "warning" {
  if (statut === CastEventStatus.Live) return "success";
  if (statut === CastEventStatus.OpenSignup) return "warning";
  if (statut === CastEventStatus.Cancelled) return "destructive";
  if (statut === CastEventStatus.Done) return "secondary";
  return "default";
}

/** « Casts » — 40 événements cast et accès au planning. */
export function CastsTab() {
  const client = useClientAchillea();
  const evenements = useLecture("casts/events", () => client.casts.listEvents({ page: 1, pageSize: 40 }));
  const liste = evenements.donnees?.data ?? [];

  return (
    <Card className="border-border/60">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <CardTitle className="text-base">Événements cast ({evenements.donnees?.total ?? 0})</CardTitle>
          <p className="text-xs text-muted-foreground">Planning des casteurs et attributions.</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" className="min-h-11 gap-2">
            <Link href="/achillea/casts">
              <ExternalLink className="size-4" aria-hidden="true" />
              Espace casts
            </Link>
          </Button>
          <BoutonActualiser enCours={evenements.chargement} onClick={evenements.recharger} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {evenements.erreur && <Erreur message={evenements.erreur} onReessayer={evenements.recharger} />}
        {evenements.chargement && !evenements.donnees ? (
          <Chargement />
        ) : liste.length === 0 && !evenements.erreur ? (
          <Vide message="Aucun événement cast." />
        ) : (
          liste.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Événement</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {liste.map(evenement => (
                  <TableRow key={evenement.id}>
                    <TableCell className="font-medium">{evenement.name || evenement.id}</TableCell>
                    <TableCell className="whitespace-nowrap text-xs">{formaterDate(evenement.scheduledAt)}</TableCell>
                    <TableCell>
                      <Badge variant={varianteStatut(evenement.status)}>{LIBELLES_STATUT[evenement.status]}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="ghost" className="min-h-11 gap-2">
                        <Link
                          href={`/achillea/casts/${encodeURIComponent(evenement.id)}/planning`}
                          aria-label={`Planning de ${evenement.name || evenement.id}`}
                        >
                          <CalendarClock className="size-4" aria-hidden="true" />
                          Planning
                        </Link>
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
