"use client";

import { useState, type ReactNode } from "react";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@rosegriffon/ui";
import { AlertTriangle, CheckCircle2, FileText, Loader2, Power, XCircle } from "lucide-react";
import { signalerEchec } from "@/lib/achillea/signaler";
import { BoutonActualiser, Chargement, Erreur, Vide, useClientAchillea, useLecture } from "./etat";

/**
 * Durée de fonctionnement du bot.
 *
 * `/admin/ops/health` rend `bot.uptime` en SECONDES (contrairement à
 * `/health/check` et `/health/monitoring`, en millisecondes : cet onglet ne
 * lit que la première).
 */
export function formaterUptimeSecondes(duree: number | null | undefined): string {
  if (typeof duree !== "number" || !Number.isFinite(duree) || duree < 0) return "—";
  const secondes = Math.floor(duree);
  const jours = Math.floor(secondes / 86_400);
  const heures = Math.floor((secondes % 86_400) / 3_600);
  const minutes = Math.floor((secondes % 3_600) / 60);
  if (jours > 0) return `${jours} j ${heures} h`;
  if (heures > 0) return `${heures} h ${minutes} min`;
  return `${minutes} min`;
}

/** Latence websocket : l'API rend `{ ping }`, un nombre, ou `null`. */
function formaterLatence(latence: unknown): string {
  const ping =
    typeof latence === "number"
      ? latence
      : latence && typeof latence === "object" && "ping" in latence
        ? (latence as { ping: unknown }).ping
        : null;
  return typeof ping === "number" && ping >= 0 ? `${Math.round(ping)} ms` : "—";
}

function Ligne({ libelle, children }: { libelle: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border/40 py-2 last:border-b-0">
      <dt className="text-muted-foreground">{libelle}</dt>
      <dd className="font-semibold">{children}</dd>
    </div>
  );
}

/** « Bot & santé » — disponibilité, maintenance, hôte, métriques et logs (SuperAdmin). */
export function BotHealthTab() {
  const client = useClientAchillea();
  const sante = useLecture("admin/ops/health", () => client.admin.health());
  const metriques = useLecture("admin/ops/metrics-summary", () => client.admin.metricsSummary());
  const totaux = useLecture("stats/totals", () => client.stats.totals());
  const topCommandes = useLecture("stats/commands/top", () => client.stats.topCommands());

  const [logs, setLogs] = useState<string[] | null>(null);
  const [logsChargement, setLogsChargement] = useState(false);
  const [logsErreur, setLogsErreur] = useState<string | null>(null);
  const [bascule, setBascule] = useState(false);
  const [basculeErreur, setBasculeErreur] = useState<string | null>(null);

  const chargerLogs = async () => {
    setLogsChargement(true);
    setLogsErreur(null);
    try {
      const resultat = await client.admin.logs();
      if (resultat.ok) setLogs(resultat.value.data);
      else setLogsErreur(signalerEchec("admin/ops/logs", resultat));
    } finally {
      setLogsChargement(false);
    }
  };

  const basculerMaintenance = async () => {
    const actuel = sante.donnees?.bot.maintenance ?? false;
    const message = actuel
      ? "Désactiver le mode maintenance et rouvrir les accès ?"
      : "Activer le mode maintenance ? L'accès joueur sera temporairement verrouillé.";
    if (!confirm(message)) return;
    setBascule(true);
    setBasculeErreur(null);
    try {
      const resultat = await client.admin.setMaintenance(!actuel);
      if (resultat.ok) sante.recharger();
      else setBasculeErreur(signalerEchec("admin/ops/maintenance", resultat));
    } finally {
      setBascule(false);
    }
  };

  const bot = sante.donnees?.bot;
  const compteurs = Object.entries(metriques.donnees?.counters ?? {}).toSorted(([a], [b]) => a.localeCompare(b));
  const stats = totaux.donnees?.stats;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold">Bot & santé</h2>
        <div className="flex flex-wrap gap-2">
          <BoutonActualiser
            enCours={sante.chargement}
            onClick={() => {
              sante.recharger();
              metriques.recharger();
              totaux.recharger();
              topCommandes.recharger();
            }}
          />
          <Button
            variant={bot?.maintenance ? "destructive" : "outline"}
            className="min-h-11 gap-2"
            onClick={() => void basculerMaintenance()}
            disabled={bascule || !bot}
          >
            {bascule ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Power className="size-4" aria-hidden="true" />
            )}
            {bot?.maintenance ? "Désactiver la maintenance" : "Passer en maintenance"}
          </Button>
        </div>
      </div>
      {basculeErreur && <Erreur message={`Maintenance : ${basculeErreur}`} />}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-sm">Bot Discord Achilléa</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {sante.erreur && <Erreur message={sante.erreur} onReessayer={sante.recharger} />}
            {sante.chargement && !sante.donnees ? (
              <Chargement lignes={3} />
            ) : (
              bot && (
                <dl>
                  <Ligne libelle="Passerelle Discord">
                    {bot.online ? (
                      <span className="flex items-center gap-1 text-success">
                        <CheckCircle2 className="size-4" aria-hidden="true" /> Connecté
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-destructive">
                        <XCircle className="size-4" aria-hidden="true" /> Déconnecté
                      </span>
                    )}
                  </Ligne>
                  <Ligne libelle="Compte">{bot.username ?? "—"}</Ligne>
                  <Ligne libelle="Temps de fonctionnement">{formaterUptimeSecondes(bot.uptime)}</Ligne>
                  <Ligne libelle="Serveurs">{bot.guilds}</Ligne>
                  <Ligne libelle="Latence websocket">{formaterLatence(sante.donnees?.latency)}</Ligne>
                  <Ligne libelle="Maintenance">
                    {bot.maintenance ? (
                      <span className="flex items-center gap-1 text-warning">
                        <AlertTriangle className="size-4" aria-hidden="true" /> Active
                      </span>
                    ) : (
                      "Inactive"
                    )}
                  </Ligne>
                </dl>
              )
            )}
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-sm">Usage du bot</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {totaux.erreur && <Erreur message={totaux.erreur} onReessayer={totaux.recharger} />}
            {totaux.chargement && !totaux.donnees ? (
              <Chargement lignes={3} />
            ) : (
              stats && (
                <dl>
                  <Ligne libelle="Comptes en base">{stats.totalActiveUsers}</Ligne>
                  <Ligne libelle="Commandes lancées">{stats.totalCommands}</Ligne>
                  <Ligne libelle="Serveurs (cache Discord)">{stats.totalGuilds}</Ligne>
                  <Ligne libelle="Membres (cache Discord)">{stats.totalUsers}</Ligne>
                </dl>
              )
            )}
            {topCommandes.donnees && topCommandes.donnees.length > 0 && (
              <div className="mt-4 space-y-2">
                <h3 className="text-xs font-semibold uppercase text-muted-foreground">Commandes les plus utilisées</h3>
                <ol className="space-y-1">
                  {topCommandes.donnees.slice(0, 8).map(ligne => (
                    <li key={`${ligne.type}:${ligne.name}`} className="flex justify-between gap-2 font-mono text-xs">
                      <span className="truncate">/{ligne.name ?? "?"}</span>
                      <span>{ligne.count}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="text-sm">Hôte et processus</CardTitle>
        </CardHeader>
        <CardContent>
          {sante.donnees ? (
            <pre className="max-h-72 overflow-auto rounded-lg bg-muted/40 p-3 text-xs">
              {JSON.stringify({ host: sante.donnees.host, pid: sante.donnees.pid }, null, 2)}
            </pre>
          ) : (
            !sante.chargement && <Vide message="Aucune mesure de l'hôte." />
          )}
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="text-sm">
            Métriques{metriques.donnees ? ` (${compteurs.length} compteurs, ${metriques.donnees.rawLines} lignes)` : ""}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {metriques.erreur && <Erreur message={metriques.erreur} onReessayer={metriques.recharger} />}
          {metriques.chargement && !metriques.donnees ? (
            <Chargement lignes={2} />
          ) : compteurs.length === 0 && !metriques.erreur ? (
            <Vide message="Aucun compteur exposé." />
          ) : (
            <dl className="grid grid-cols-1 gap-x-6 text-xs sm:grid-cols-2">
              {compteurs.map(([nom, valeur]) => (
                <Ligne key={nom} libelle={nom}>
                  <span className="font-mono">{valeur.toLocaleString("fr-FR")}</span>
                </Ligne>
              ))}
            </dl>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle className="text-sm">Logs du processus</CardTitle>
          <Button
            variant="outline"
            className="min-h-11 gap-2"
            onClick={() => void chargerLogs()}
            disabled={logsChargement}
          >
            {logsChargement ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <FileText className="size-4" aria-hidden="true" />
            )}
            {logs ? "Recharger les logs" : "Charger les logs"}
          </Button>
        </CardHeader>
        <CardContent>
          {logsErreur && <Erreur message={logsErreur} onReessayer={() => void chargerLogs()} />}
          {logs &&
            (logs.length === 0 ? (
              <Vide message="Aucune ligne de log." />
            ) : (
              <textarea
                readOnly
                aria-label="Dernières lignes du journal du bot"
                className="block h-96 w-full resize-none overflow-auto rounded-lg bg-muted/40 p-3 font-mono text-xs"
                value={logs.join("\n")}
              />
            ))}
        </CardContent>
      </Card>
    </div>
  );
}
