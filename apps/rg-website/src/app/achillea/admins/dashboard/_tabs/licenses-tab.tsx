"use client";

import { useState, type FormEvent } from "react";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input, Label } from "@rosegriffon/ui";
import { BadgeCheck, Ban, Loader2 } from "lucide-react";
import { signalerEchec } from "@/lib/achillea/signaler";
import type { License } from "@rosegriffon/achillea-types/domain/license";
import { Erreur, formaterDate, useClientAchillea } from "./etat";

function ResumeLicence({ licence, titre }: { licence: License; titre: string }) {
  return (
    <div className="space-y-1 rounded-xl border border-border/60 bg-muted/20 p-3 text-sm" aria-live="polite">
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold">{titre}</span>
        <Badge variant={licence.status === "Active" ? "success" : "destructive"}>{licence.status}</Badge>
      </div>
      <p className="font-mono">{licence.licenseNumber}</p>
      <p className="text-xs text-muted-foreground">
        Titulaire {licence.userId} · valable jusqu&apos;au {formaterDate(licence.validUntil)}
      </p>
    </div>
  );
}

/** « Licences » — émission pour un membre, révocation par identifiant. */
export function LicensesTab() {
  const client = useClientAchillea();
  const [userId, setUserId] = useState("");
  const [licenceId, setLicenceId] = useState("");
  const [emission, setEmission] = useState(false);
  const [revocation, setRevocation] = useState(false);
  const [derniereEmise, setDerniereEmise] = useState<License | null>(null);
  const [derniereRevoquee, setDerniereRevoquee] = useState<License | null>(null);
  const [erreurEmission, setErreurEmission] = useState<string | null>(null);
  const [erreurRevocation, setErreurRevocation] = useState<string | null>(null);

  const emettre = async (event: FormEvent) => {
    event.preventDefault();
    const cible = userId.trim();
    if (!cible) return;
    setEmission(true);
    setErreurEmission(null);
    try {
      const resultat = await client.licenses.issue(cible);
      if (resultat.ok) {
        setDerniereEmise(resultat.value);
        setUserId("");
      } else setErreurEmission(signalerEchec("licenses/issue", resultat));
    } finally {
      setEmission(false);
    }
  };

  const revoquer = async (event: FormEvent) => {
    event.preventDefault();
    const cible = licenceId.trim();
    if (!cible || !confirm(`Révoquer la licence ${cible} ?`)) return;
    setRevocation(true);
    setErreurRevocation(null);
    try {
      const resultat = await client.licenses.revoke(cible);
      if (resultat.ok) {
        setDerniereRevoquee(resultat.value);
        setLicenceId("");
      } else setErreurRevocation(signalerEchec("licenses/revoke", resultat));
    } finally {
      setRevocation(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="text-base">Émettre une licence</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-3" onSubmit={event => void emettre(event)}>
            <div className="space-y-1">
              <Label htmlFor="licence-emission-user">Identifiant Discord du membre</Label>
              <Input
                id="licence-emission-user"
                value={userId}
                onChange={event => setUserId(event.target.value)}
                inputMode="numeric"
                autoComplete="off"
                className="min-h-11 font-mono"
              />
            </div>
            <Button type="submit" className="min-h-11 w-full gap-2" disabled={emission || !userId.trim()}>
              {emission ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <BadgeCheck className="size-4" aria-hidden="true" />
              )}
              Émettre
            </Button>
            {erreurEmission && <Erreur message={erreurEmission} />}
            {derniereEmise && <ResumeLicence licence={derniereEmise} titre="Dernière licence émise" />}
          </form>
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="text-base">Révoquer une licence</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-3" onSubmit={event => void revoquer(event)}>
            <div className="space-y-1">
              <Label htmlFor="licence-revocation-id">Identifiant de la licence</Label>
              <Input
                id="licence-revocation-id"
                value={licenceId}
                onChange={event => setLicenceId(event.target.value)}
                autoComplete="off"
                className="min-h-11 font-mono"
              />
            </div>
            <Button
              type="submit"
              variant="destructive"
              className="min-h-11 w-full gap-2"
              disabled={revocation || !licenceId.trim()}
            >
              {revocation ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Ban className="size-4" aria-hidden="true" />
              )}
              Révoquer
            </Button>
            {erreurRevocation && <Erreur message={erreurRevocation} />}
            {derniereRevoquee && <ResumeLicence licence={derniereRevoquee} titre="Dernière licence révoquée" />}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
