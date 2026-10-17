"use client";

import { useCallback, useMemo, useState } from "react";
import { Ban, CheckCircle2, CircleDashed, Loader2, Play, XCircle } from "lucide-react";

import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@rosegriffon/ui";
import { FAMILLES_TACHES, type FamilleTache } from "@rosegriffon/types/cron";

import { useConfirm } from "@/components/admin/confirmation-dialog";
import { peutLancerDepuisLeSite, type TacheAdmin } from "@/lib/admin/cron-etat";

/** Libellés des familles — l'ordre du tableau de bord. */
const LIBELLES_FAMILLES: Readonly<Record<FamilleTache | "autre", string>> = {
  donnees: "Données et caches",
  discord: "Discord",
  campagnes: "Campagnes et veille",
  patreon: "Patreon",
  seo: "Référencement",
  publication: "Publication",
  stats: "Statistiques",
  qa: "Qualité et QA",
  autre: "Registre (CLI uniquement)",
};

const ORDRE: ReadonlyArray<FamilleTache | "autre"> = [...FAMILLES_TACHES, "autre"];

type Retour = { statut: "ok" | "erreur"; message: string };

function duree(ms: number): string {
  if (ms < 1000) return `${ms} ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(s < 10 ? 1 : 0)} s`;
  return `${Math.floor(s / 60)} min ${Math.round(s % 60)} s`;
}

function ilYA(iso: string): string {
  const ecart = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(ecart / 60_000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const heures = Math.round(minutes / 60);
  if (heures < 48) return `il y a ${heures} h`;
  return `il y a ${Math.round(heures / 24)} j`;
}

/**
 * Les tâches planifiées, avec leur dernier état réel et leur bouton de lancement.
 *
 * ── LE BOUTON ABSENT N'EST PAS LA GARDE ────────────────────────────────────
 * La vraie garde est côté serveur (`/api/admin/cron/lancer` puis
 * `declencherTache`). Cacher un bouton n'a jamais empêché personne de poster la
 * requête à la main.
 *
 * ── « DÉMARRÉE », JAMAIS « RÉUSSIE » ───────────────────────────────────────
 * L'API répond 202 et poursuit en arrière-plan : le résultat se lit ensuite
 * dans « dernière exécution » après rechargement.
 */
export function TableauTaches({
  taches,
  role,
  cronJoignable,
}: {
  taches: readonly TacheAdmin[];
  role: string | null;
  cronJoignable: boolean;
}) {
  const { confirm, dialog } = useConfirm();
  const [enCours, setEnCours] = useState<string | null>(null);
  const [retours, setRetours] = useState<Record<string, Retour>>({});

  const lancer = useCallback(
    async (tache: TacheAdmin) => {
      const accord = await confirm({
        title: `Lancer « ${tache.titre} »`,
        message: `${tache.role}${tache.dureeIndicative ? ` Durée indicative : ${tache.dureeIndicative}.` : ""} La tâche démarre immédiatement en arrière-plan.`,
        confirmText: "Lancer maintenant",
      });
      if (!accord) return;
      setEnCours(tache.nom);
      try {
        const reponse = await fetch("/api/admin/cron/lancer", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ tache: tache.nom }),
        });
        const charge = (await reponse.json()) as { message?: string; error?: string };
        setRetours(precedent => ({
          ...precedent,
          [tache.nom]: {
            statut: reponse.ok ? "ok" : "erreur",
            message: charge.message ?? charge.error ?? `HTTP ${reponse.status}`,
          },
        }));
      } catch (erreur) {
        setRetours(precedent => ({
          ...precedent,
          [tache.nom]: { statut: "erreur", message: erreur instanceof Error ? erreur.message : String(erreur) },
        }));
      } finally {
        setEnCours(null);
      }
    },
    [confirm],
  );

  const parFamille = useMemo(
    () =>
      ORDRE.map(famille => ({ famille, taches: taches.filter(t => t.famille === famille) })).filter(
        groupe => groupe.taches.length > 0,
      ),
    [taches],
  );

  return (
    <div className="space-y-8">
      {dialog}
      {parFamille.map(({ famille, taches: liste }) => (
        <section key={famille} className="space-y-3" aria-labelledby={`famille-${famille}`}>
          <h2 id={`famille-${famille}`} className="text-lg font-semibold">
            {LIBELLES_FAMILLES[famille]}
          </h2>
          <div className="grid gap-3 md:grid-cols-2">
            {liste.map(tache => {
              const autorise = peutLancerDepuisLeSite(tache, role);
              const retour = retours[tache.nom];
              return (
                <Card key={tache.nom}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <CardTitle className="text-base">{tache.titre}</CardTitle>
                        <CardDescription className="mt-1">{tache.role}</CardDescription>
                      </div>
                      {tache.motifBlocage ? (
                        <Badge variant="outline" className="shrink-0 gap-1">
                          <Ban className="size-3" aria-hidden />
                          lecture seule
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="shrink-0">
                          admin
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <dl className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
                      <div className="flex gap-1.5">
                        <dt>Nom :</dt>
                        <dd className="font-mono text-foreground">{tache.nom}</dd>
                      </div>
                      <div className="flex gap-1.5">
                        <dt>Planification :</dt>
                        <dd className="font-mono text-foreground">
                          {tache.planification === "manuel" ? "manuelle" : tache.planification}
                        </dd>
                      </div>
                    </dl>

                    <div className="rounded-md border border-border p-2 text-xs" aria-label="Dernière exécution">
                      {tache.dernier ? (
                        <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          {tache.dernier.succes ? (
                            <CheckCircle2 className="size-4 text-succes" aria-hidden />
                          ) : (
                            <XCircle className="size-4 text-destructive" aria-hidden />
                          )}
                          <span className="font-medium">{tache.dernier.succes ? "Réussie" : "Échec"}</span>
                          <span className="text-muted-foreground">
                            {ilYA(tache.dernier.demarre_le)} · {duree(tache.dernier.duree_ms)}
                          </span>
                        </p>
                      ) : (
                        <p className="flex items-center gap-2 text-muted-foreground">
                          <CircleDashed className="size-4" aria-hidden />
                          Jamais exécutée (ou historique indisponible)
                        </p>
                      )}
                      {tache.dernierEchec && (
                        <p className="mt-1 text-destructive">
                          Dernier échec {ilYA(tache.dernierEchec.demarre_le)}
                          {tache.dernierEchec.erreur ? ` : ${tache.dernierEchec.erreur.slice(0, 160)}` : ""}
                        </p>
                      )}
                    </div>

                    {tache.horsServerless && (
                      <p className="text-xs text-muted-foreground">Exige un serveur dédié : {tache.horsServerless}.</p>
                    )}

                    {tache.motifBlocage ? (
                      <p className="rounded-md border border-border bg-muted/40 p-2 text-xs text-muted-foreground">
                        {tache.motifBlocage}
                      </p>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="min-h-11 sm:min-h-9"
                        disabled={!autorise || !cronJoignable || enCours === tache.nom}
                        onClick={() => lancer(tache)}
                        title={
                          !cronJoignable
                            ? "L'API des tâches est injoignable."
                            : autorise
                              ? undefined
                              : "Réservé aux administrateurs."
                        }
                      >
                        {enCours === tache.nom ? (
                          <Loader2 className="size-4 animate-spin" aria-hidden />
                        ) : (
                          <Play className="size-4" aria-hidden />
                        )}
                        Lancer maintenant
                      </Button>
                    )}

                    {retour && (
                      <p
                        role={retour.statut === "ok" ? "status" : "alert"}
                        className={`text-xs ${retour.statut === "ok" ? "text-succes" : "text-destructive"}`}
                      >
                        {retour.message}
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
