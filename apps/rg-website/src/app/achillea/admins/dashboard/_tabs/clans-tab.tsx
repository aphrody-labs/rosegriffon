"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
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
import { ExternalLink, Info, Loader2, Pause, Pencil, Play, Save } from "lucide-react";
import { signalerEchec } from "@/lib/achillea/signaler";
import type { ClanDTO } from "@rosegriffon/achillea-types/domain/clan";
import { ClanState } from "@rosegriffon/achillea-types/enums/clanState";
import { BoutonActualiser, Chargement, Erreur, Vide, formaterDate, useClientAchillea, useLecture } from "./etat";
import { ROLE_ADMIN } from "./visibilite";
import { EditionClanDialog } from "./clan-edition-dialog";

function IdentiteClan({ clan }: { clan: ClanDTO }) {
  return (
    <span className="flex items-center gap-2">
      <Avatar className="size-7">
        {clan.clanAvatarUrl && <AvatarImage src={clan.clanAvatarUrl} alt="" />}
        <AvatarFallback className="text-xs">{clan.shortenedName.slice(0, 2)}</AvatarFallback>
      </Avatar>
      <span className="font-medium">{clan.name}</span>
    </span>
  );
}

function LimitesEffectif({ peutModifier }: { peutModifier: boolean }) {
  const client = useClientAchillea();
  const limites = useLecture("clans/member-limits", () => client.clans.memberLimits());
  const [joueurs, setJoueurs] = useState<string | null>(null);
  const [staff, setStaff] = useState<string | null>(null);
  const [enregistrement, setEnregistrement] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null);

  const valeurJoueurs = joueurs ?? String(limites.donnees?.playerLimit ?? "");
  const valeurStaff = staff ?? String(limites.donnees?.staffLimit ?? "");

  const enregistrer = async (event: FormEvent) => {
    event.preventDefault();
    const playerLimit = Number(valeurJoueurs);
    const staffLimit = Number(valeurStaff);
    if (!Number.isInteger(playerLimit) || !Number.isInteger(staffLimit) || playerLimit < 1 || staffLimit < 1) {
      setMessage({ ok: false, texte: "Les deux limites doivent être des entiers positifs." });
      return;
    }
    setEnregistrement(true);
    setMessage(null);
    try {
      const resultat = await client.clans.updateMemberLimits({ playerLimit, staffLimit });
      if (resultat.ok) {
        setJoueurs(null);
        setStaff(null);
        limites.recharger();
        setMessage({
          ok: true,
          texte: `Effectifs mis à jour : ${resultat.value.playerLimit} joueurs, ${resultat.value.staffLimit} staff.`,
        });
      } else setMessage({ ok: false, texte: signalerEchec("clans/member-limits", resultat) });
    } finally {
      setEnregistrement(false);
    }
  };

  return (
    <Card className="border-border/60">
      <CardHeader>
        <CardTitle className="text-base">Limites d&apos;effectif par clan</CardTitle>
        <p className="text-xs text-muted-foreground">
          Plafonds appliqués aux invitations, candidatures et recrutements.
          {peutModifier ? "" : " Modification réservée aux administrateurs."}
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {limites.erreur && <Erreur message={limites.erreur} onReessayer={limites.recharger} />}
        {limites.chargement && !limites.donnees ? (
          <Chargement lignes={1} />
        ) : (
          <form className="flex flex-wrap items-end gap-4" onSubmit={event => void enregistrer(event)}>
            <div className="space-y-1">
              <Label htmlFor="clan-limite-joueurs">Joueurs max</Label>
              <Input
                id="clan-limite-joueurs"
                type="number"
                min={1}
                value={valeurJoueurs}
                disabled={!peutModifier}
                onChange={event => setJoueurs(event.target.value)}
                className="min-h-11 w-32"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="clan-limite-staff">Staff max</Label>
              <Input
                id="clan-limite-staff"
                type="number"
                min={1}
                value={valeurStaff}
                disabled={!peutModifier}
                onChange={event => setStaff(event.target.value)}
                className="min-h-11 w-32"
              />
            </div>
            {peutModifier && (
              <Button type="submit" className="min-h-11 gap-2" disabled={enregistrement}>
                {enregistrement ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Save className="size-4" aria-hidden="true" />
                )}
                Enregistrer
              </Button>
            )}
          </form>
        )}
        {message && (
          <output className={`block text-sm ${message.ok ? "text-success" : "text-destructive"}`}>
            {message.texte}
          </output>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * « Clans » — clans bloqués en revue, clans actifs (édition complète et
 * bascule inactif, Admin+) et limites d'effectif.
 */
export function ClansTab({ role }: { role: number }) {
  const client = useClientAchillea();
  const estAdmin = role >= ROLE_ADMIN;
  const enAttente = useLecture("admin/clans?state=1", () =>
    client.clans.adminList({ state: ClanState.PendingReview, page: 1, pageSize: 50 }),
  );
  const actifs = useLecture("admin/clans?state=2", () =>
    client.clans.adminList({ state: ClanState.Approved, page: 1, pageSize: 50 }),
  );
  const [bascule, setBascule] = useState<number | null>(null);
  const [inactifs, setInactifs] = useState<Record<number, boolean>>({});
  const [erreurBascule, setErreurBascule] = useState<string | null>(null);
  const [edition, setEdition] = useState<ClanDTO | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);

  const basculerInactif = async (clan: ClanDTO) => {
    const suivant = !(inactifs[clan.id] ?? clan.isInactive);
    setBascule(clan.id);
    setErreurBascule(null);
    try {
      const resultat = await client.clans.update(clan.id, { isInactive: suivant });
      if (resultat.ok && resultat.value.success) setInactifs(courant => ({ ...courant, [clan.id]: suivant }));
      else if (resultat.ok) setErreurBascule(resultat.value.error ?? "Impossible de mettre à jour le statut du clan.");
      else setErreurBascule(signalerEchec("clans/update", resultat));
    } finally {
      setBascule(null);
    }
  };

  const listeAttente = enAttente.donnees?.data ?? [];
  const listeActifs = actifs.donnees?.data ?? [];

  return (
    <div className="space-y-6">
      <p className="flex items-start gap-2 rounded-xl border border-border/60 bg-muted/20 p-3 text-sm text-muted-foreground">
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        La création d&apos;un clan est approuvée automatiquement dès que tous les fondateurs l&apos;ont rejoint. La
        liste « en revue » ne contient que les cas bloqués (incident technique).
      </p>

      <LimitesEffectif peutModifier={estAdmin} />

      <Card className="border-border/60">
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle className="text-base">Clans actifs ({actifs.donnees?.meta.total ?? listeActifs.length})</CardTitle>
          <BoutonActualiser enCours={actifs.chargement} onClick={actifs.recharger} />
        </CardHeader>
        <CardContent className="space-y-4">
          {actifs.erreur && <Erreur message={actifs.erreur} onReessayer={actifs.recharger} />}
          {erreurBascule && <Erreur message={erreurBascule} />}
          {confirmation && (
            <output className="block text-sm text-success">
              {confirmation}
            </output>
          )}
          {actifs.chargement && !actifs.donnees ? (
            <Chargement />
          ) : listeActifs.length === 0 && !actifs.erreur ? (
            <Vide message="Aucun clan actif." />
          ) : (
            listeActifs.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Clan</TableHead>
                    <TableHead>Tag</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {listeActifs.map(clan => {
                    const inactif = inactifs[clan.id] ?? clan.isInactive;
                    return (
                      <TableRow key={clan.id}>
                        <TableCell>
                          <IdentiteClan clan={clan} />
                        </TableCell>
                        <TableCell className="font-mono">{clan.shortenedName}</TableCell>
                        <TableCell>
                          <span className="flex flex-wrap gap-1">
                            <Badge variant={inactif ? "warning" : "success"}>{inactif ? "Inactif" : "Actif"}</Badge>
                            {clan.isHidden && <Badge variant="outline">Masqué</Badge>}
                          </span>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-right">
                          <Button asChild variant="ghost" className="min-h-11 gap-2">
                            <Link href={`/achillea/clans/${clan.id}`} aria-label={`Fiche du clan ${clan.name}`}>
                              <ExternalLink className="size-4" aria-hidden="true" />
                              Fiche
                            </Link>
                          </Button>
                          {estAdmin && (
                            <Button
                              variant="ghost"
                              className="min-h-11 gap-2"
                              aria-label={`Éditer le clan ${clan.name}`}
                              onClick={() => {
                                setConfirmation(null);
                                setEdition({ ...clan, isInactive: inactif });
                              }}
                            >
                              <Pencil className="size-4" aria-hidden="true" />
                              Éditer
                            </Button>
                          )}
                          {estAdmin && (
                            <Button
                              variant="ghost"
                              className={`min-h-11 gap-2 ${inactif ? "text-success" : "text-warning"}`}
                              disabled={bascule === clan.id}
                              onClick={() => void basculerInactif(clan)}
                            >
                              {bascule === clan.id ? (
                                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                              ) : inactif ? (
                                <Play className="size-4" aria-hidden="true" />
                              ) : (
                                <Pause className="size-4" aria-hidden="true" />
                              )}
                              {inactif ? "Réactiver" : "Rendre inactif"}
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )
          )}
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle className="text-base">
            Clans en revue ({enAttente.donnees?.meta.total ?? listeAttente.length})
          </CardTitle>
          <BoutonActualiser enCours={enAttente.chargement} onClick={enAttente.recharger} />
        </CardHeader>
        <CardContent className="space-y-4">
          {enAttente.erreur && <Erreur message={enAttente.erreur} onReessayer={enAttente.recharger} />}
          {enAttente.chargement && !enAttente.donnees ? (
            <Chargement lignes={2} />
          ) : listeAttente.length === 0 && !enAttente.erreur ? (
            <Vide message="Aucun clan bloqué en revue." />
          ) : (
            listeAttente.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Clan</TableHead>
                    <TableHead>Tag</TableHead>
                    <TableHead className="text-right">Fondateurs</TableHead>
                    <TableHead>Soumis le</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {listeAttente.map(clan => (
                    <TableRow key={clan.id}>
                      <TableCell>
                        <IdentiteClan clan={clan} />
                      </TableCell>
                      <TableCell className="font-mono">{clan.shortenedName}</TableCell>
                      <TableCell className="text-right font-mono">{clan.founders.length}</TableCell>
                      <TableCell className="whitespace-nowrap text-xs">{formaterDate(clan.createdAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )
          )}
        </CardContent>
      </Card>

      <EditionClanDialog
        clan={edition}
        estAdmin={estAdmin}
        onFermer={() => setEdition(null)}
        onEnregistre={nom => {
          setEdition(null);
          setInactifs({});
          setConfirmation(`${nom} mis à jour.`);
          actifs.recharger();
        }}
      />
    </div>
  );
}
