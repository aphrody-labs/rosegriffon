"use client";

import { useState } from "react";
import {
  Button,
  Badge,
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
import { Loader2, ShieldCheck } from "lucide-react";
import { signalerEchec } from "@/lib/achillea/signaler";
import type { AuditChainVerification } from "@rosegriffon/achillea-client";
import { BoutonActualiser, Chargement, Erreur, Vide, formaterDate, useClientAchillea, useLecture } from "./etat";

/** « Audit » — 80 dernières entrées du journal d'actions chaîné (SuperAdmin). */
export function AuditTab() {
  const client = useClientAchillea();
  const journal = useLecture("admin/ops/audit", () => client.admin.audit(80));
  const lignes = journal.donnees?.data ?? [];
  const [verification, setVerification] = useState<AuditChainVerification | null>(null);
  const [verificationEnCours, setVerificationEnCours] = useState(false);
  const [erreurVerification, setErreurVerification] = useState<string | null>(null);

  const verifier = async () => {
    setVerificationEnCours(true);
    setErreurVerification(null);
    setVerification(null);
    try {
      const resultat = await client.admin.verifyAudit();
      if (resultat.ok) setVerification(resultat.value);
      else setErreurVerification(signalerEchec("admin/ops/audit/verify", resultat));
    } finally {
      setVerificationEnCours(false);
    }
  };

  return (
    <Card className="border-border/60">
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div className="space-y-1">
          <CardTitle className="text-base">Journal d&apos;audit</CardTitle>
          <p className="text-xs text-muted-foreground">Actions staff signées et chaînées, de la plus récente.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            className="min-h-11 gap-2"
            onClick={() => void verifier()}
            disabled={verificationEnCours}
          >
            {verificationEnCours ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <ShieldCheck className="size-4" aria-hidden="true" />
            )}
            Vérifier la chaîne
          </Button>
          <BoutonActualiser enCours={journal.chargement} onClick={journal.recharger} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {verificationEnCours && <Chargement lignes={1} libelle="Vérification de la chaîne…" />}
        {erreurVerification && <Erreur message={erreurVerification} onReessayer={() => void verifier()} />}
        {verification && (
          <p
            role={verification.valid ? "status" : "alert"}
            className={`rounded-xl border p-3 text-sm font-semibold ${
              verification.valid
                ? "border-success/40 bg-success/10 text-success"
                : "border-destructive/40 bg-destructive/10 text-destructive"
            }`}
          >
            {verification.valid
              ? `Chaîne intègre — ${verification.total} entrées`
              : `Chaîne rompue à l'entrée ${verification.broken_at ?? "inconnue"}`}
          </p>
        )}
        {journal.erreur && <Erreur message={journal.erreur} onReessayer={journal.recharger} />}
        {journal.chargement && !journal.donnees ? (
          <Chargement lignes={5} />
        ) : lignes.length === 0 && !journal.erreur ? (
          <Vide message="Aucune entrée d'audit." />
        ) : (
          lignes.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Cible</TableHead>
                  <TableHead>Acteur</TableHead>
                  <TableHead>Motif</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lignes.map(ligne => (
                  <TableRow key={ligne.id}>
                    <TableCell className="whitespace-nowrap text-xs">{formaterDate(ligne.ts)}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="font-mono">
                        {ligne.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {ligne.targetType}
                      {ligne.targetId ? ` · ${ligne.targetId}` : ""}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{ligne.actorId ?? "système"}</TableCell>
                    <TableCell className="text-xs">{ligne.reason ?? "—"}</TableCell>
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
