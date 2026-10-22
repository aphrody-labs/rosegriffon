"use client";

import { useState, type FormEvent } from "react";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@rosegriffon/ui";
import { ArchiveRestore, HardDriveDownload, Loader2 } from "lucide-react";
import type { AchilleaClientResult } from "@rosegriffon/achillea-client";
import type { z } from "zod";
import { signalerEchec } from "@/lib/achillea/signaler";
import { BoutonActualiser, Chargement, Erreur, Vide, formaterDate, useClientAchillea, useLecture } from "./etat";
import { formaterOctets, messageRefusSauvegarde, sauvegardesSchema, tailleBaseSchema } from "./database-valeurs";

/** Valide une réponse `unknown` du client contre le schéma attendu. */
async function valider<T>(
  chemin: string,
  schema: z.ZodType<T>,
  lecture: Promise<AchilleaClientResult<unknown>>,
): Promise<AchilleaClientResult<T>> {
  const resultat = await lecture;
  if (!resultat.ok) return resultat;
  const analyse = schema.safeParse(resultat.value);
  return analyse.success
    ? { ok: true, value: analyse.data }
    : { ok: false, kind: "invalid_response", detail: analyse.error.message, path: chemin };
}

function messageEchec(contexte: string, resultat: AchilleaClientResult<unknown>): string {
  if (resultat.ok) return "";
  const generique = signalerEchec(contexte, resultat);
  return (resultat.kind === "http" ? messageRefusSauvegarde(resultat.status) : null) ?? generique;
}

/**
 * Sauvegardes de la base Achilléa : taille, archives disponibles, sauvegarde
 * immédiate et restauration (SuperAdmin). La restauration demande deux
 * confirmations, la seconde en ressaisissant le nom exact de l'archive.
 */
export function SauvegardesBase() {
  const client = useClientAchillea();
  const taille = useLecture("database/size", () =>
    valider("/database/size", tailleBaseSchema, client.admin.databaseSize()),
  );
  const archives = useLecture("database/backups", () =>
    valider("/database/backups", sauvegardesSchema, client.admin.listBackups()),
  );
  const [sauvegarde, setSauvegarde] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null);
  const [aRestaurer, setARestaurer] = useState<string | null>(null);
  const [saisieNom, setSaisieNom] = useState("");
  const [restauration, setRestauration] = useState(false);

  const recharger = () => {
    taille.recharger();
    archives.recharger();
  };

  const sauvegarder = async () => {
    setSauvegarde(true);
    setMessage(null);
    try {
      const resultat = await client.admin.createBackup();
      if (resultat.ok) {
        const nom = resultat.value.data?.snapshotName;
        setMessage({ ok: true, texte: nom ? `${resultat.value.message} (${nom})` : resultat.value.message });
        recharger();
      } else setMessage({ ok: false, texte: messageEchec("database/backup", resultat) });
    } finally {
      setSauvegarde(false);
    }
  };

  const demanderRestauration = (nom: string) => {
    const premiere = confirm(
      `Restaurer l'archive « ${nom} » ? Le schéma Achilléa actuel sera remplacé par son contenu (une sauvegarde préalable est faite par l'API).`,
    );
    if (!premiere) return;
    setSaisieNom("");
    setMessage(null);
    setARestaurer(nom);
  };

  const restaurer = async (event: FormEvent) => {
    event.preventDefault();
    if (!aRestaurer || saisieNom !== aRestaurer) return;
    setRestauration(true);
    try {
      const resultat = await client.admin.restoreBackup(aRestaurer);
      if (resultat.ok) {
        setMessage({ ok: true, texte: resultat.value.message });
        setARestaurer(null);
        recharger();
      } else setMessage({ ok: false, texte: messageEchec("database/restore", resultat) });
    } finally {
      setRestauration(false);
    }
  };

  const liste = archives.donnees?.data ?? [];

  return (
    <div className="space-y-6">
      <Card className="border-border/60">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-sm">Taille de la base</CardTitle>
          <BoutonActualiser enCours={taille.chargement || archives.chargement} onClick={recharger} />
        </CardHeader>
        <CardContent className="text-sm">
          {taille.erreur && <Erreur message={taille.erreur} onReessayer={taille.recharger} />}
          {taille.chargement && !taille.donnees ? (
            <Chargement lignes={1} />
          ) : (
            taille.donnees && (
              <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div className="rounded-xl border border-border/60 p-3">
                  <dt className="text-xs text-muted-foreground">Base complète</dt>
                  <dd className="text-lg font-bold">{taille.donnees.database.pretty}</dd>
                </div>
                <div className="rounded-xl border border-border/60 p-3">
                  <dt className="text-xs text-muted-foreground">Schéma {taille.donnees.schema.name}</dt>
                  <dd className="text-lg font-bold">{taille.donnees.schema.pretty}</dd>
                </div>
              </dl>
            )
          )}
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-sm">Sauvegardes ({liste.length})</CardTitle>
            {archives.donnees && (
              <p className="text-xs text-muted-foreground">
                Les {archives.donnees.retention} archives les plus récentes sont conservées.
              </p>
            )}
          </div>
          <Button className="min-h-11 gap-2" onClick={() => void sauvegarder()} disabled={sauvegarde || restauration}>
            {sauvegarde ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <HardDriveDownload className="size-4" aria-hidden="true" />
            )}
            Sauvegarder maintenant
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {message && (
            <p
              role={message.ok ? "status" : "alert"}
              className={`rounded-xl border p-3 text-sm ${
                message.ok
                  ? "border-success/40 bg-success/10 text-success"
                  : "border-destructive/40 bg-destructive/10 text-destructive"
              }`}
            >
              {message.texte}
            </p>
          )}
          {archives.erreur && <Erreur message={archives.erreur} onReessayer={archives.recharger} />}
          {archives.chargement && !archives.donnees ? (
            <Chargement lignes={3} />
          ) : liste.length === 0 && !archives.erreur ? (
            <Vide message="Aucune archive de sauvegarde." />
          ) : (
            liste.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Archive</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Taille</TableHead>
                    <TableHead>
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {liste.map(archive => (
                    <TableRow key={archive.name}>
                      <TableCell className="font-mono text-xs">{archive.name}</TableCell>
                      <TableCell className="whitespace-nowrap text-xs">{formaterDate(archive.createdAt)}</TableCell>
                      <TableCell className="text-right font-mono text-xs">{formaterOctets(archive.sizeBytes)}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          className="min-h-11 gap-2 text-destructive"
                          disabled={sauvegarde || restauration}
                          onClick={() => demanderRestauration(archive.name)}
                          aria-label={`Restaurer l'archive ${archive.name}`}
                        >
                          <ArchiveRestore className="size-4" aria-hidden="true" />
                          Restaurer
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

      <Dialog open={aRestaurer !== null} onOpenChange={ouvert => !ouvert && !restauration && setARestaurer(null)}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={event => void restaurer(event)} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Confirmer la restauration</DialogTitle>
              <DialogDescription>
                Seconde confirmation : ressaisis le nom exact de l&apos;archive <strong>{aRestaurer}</strong>. Les
                données Achilléa écrites depuis cette sauvegarde seront perdues.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-1">
              <Label htmlFor="restauration-nom">Nom de l&apos;archive</Label>
              <Input
                id="restauration-nom"
                value={saisieNom}
                onChange={event => setSaisieNom(event.target.value)}
                autoComplete="off"
                spellCheck={false}
                className="min-h-11 font-mono text-xs"
              />
            </div>
            {message && !message.ok && <Erreur message={message.texte} />}
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                className="min-h-11"
                disabled={restauration}
                onClick={() => setARestaurer(null)}
              >
                Annuler
              </Button>
              <Button
                type="submit"
                variant="destructive"
                className="min-h-11 gap-2"
                disabled={restauration || saisieNom !== aRestaurer}
              >
                {restauration && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
                Restaurer {aRestaurer}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
