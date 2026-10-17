import "server-only";

import { CATALOGUE_TACHES, decrireTache, raisonRefus, type DescriptionTache } from "@rosegriffon/types/cron";

import {
  bilanTaches,
  construireTaches,
  peutLancerDepuisLeSite,
  type BilanCron,
  type ExecutionBrute,
  type ReponseCron,
  type TacheAdmin,
} from "@/lib/admin/cron-etat";
import { getPgPool } from "@/lib/db/pg";

/**
 * Client des tâches planifiées — l'API unifiée `rg-core`, vue depuis le site.
 *
 * Les planifications vivent dans Supabase (`pg_cron` + `pg_net`) qui appelle
 * `POST /v1/cron/<tâche>` ; le site lit le catalogue sur `GET /v1/cron` et
 * l'état réel dans `public.cron_executions`. Il n'existe plus de démon
 * `rg-cron.service` sur le port 3005.
 *
 * ── LA POLITIQUE D'ACCÈS EST APPLIQUÉE DEUX FOIS, ET C'EST VOULU ───────────
 * L'API a sa propre garde (`CRON_SECRET`). Le site applique EN PLUS la sienne
 * avant d'envoyer quoi que ce soit : seuls les administrateurs lancent, les
 * tâches interdites ou à effet financier ne partent jamais, même en postant le
 * corps à la main.
 */

const BASE = (process.env.CRON_API_URL ?? "http://127.0.0.1:8810/v1/cron").replace(/\/+$/, "");
const DELAI_MS = 5_000;

export class CronIndisponibleError extends Error {
  constructor(
    message: string,
    readonly statut?: number,
  ) {
    super(message);
    this.name = "CronIndisponibleError";
  }
}

function entetes(): HeadersInit {
  const secret = (process.env.CRON_SECRET ?? "").trim();
  return secret === ""
    ? { accept: "application/json" }
    : { accept: "application/json", authorization: `Bearer ${secret}` };
}

async function appeler<T>(chemin: string, init: RequestInit = {}): Promise<T> {
  let reponse: Response;
  try {
    reponse = await fetch(`${BASE}${chemin}`, {
      ...init,
      cache: "no-store",
      headers: { ...entetes(), ...init.headers },
      signal: AbortSignal.timeout(DELAI_MS),
    });
  } catch (erreur) {
    const raison =
      erreur instanceof Error
        ? erreur.name === "TimeoutError"
          ? `aucune réponse en ${DELAI_MS} ms`
          : erreur.message
        : String(erreur);
    throw new CronIndisponibleError(`L'API des tâches planifiées est injoignable — ${raison}`);
  }
  if (!reponse.ok) {
    let detail = "";
    try {
      const corps = (await reponse.json()) as { error?: string; message?: string };
      detail = corps.error ?? corps.message ?? "";
    } catch {
      // corps absent ou non JSON : le code HTTP suffit
    }
    throw new CronIndisponibleError(
      reponse.status === 401
        ? "L'API a refusé l'authentification : `CRON_SECRET` est absent ou ne correspond pas à celui du service."
        : `L'API a répondu ${reponse.status}${detail ? ` : ${detail}` : "."}`,
      reponse.status,
    );
  }
  const texte = await reponse.text();
  return (texte.length === 0 ? null : JSON.parse(texte)) as T;
}

/** Une exécution persistée dans PostgreSQL. */
export interface ExecutionCron extends ExecutionBrute {
  origine: string;
}

/**
 * Dernière exécution ET dernier échec de chaque tâche, dans la table que
 * l'exécuteur alimente. Ne lève jamais : une migration en attente donne une
 * liste vide, l'affichage le dit.
 */
async function executionsParTache(): Promise<{ lignes: ExecutionBrute[]; disponible: boolean }> {
  try {
    const { rows } = await getPgPool().query<ExecutionBrute>(
      `SELECT DISTINCT ON (tache, succes) tache, demarre_le::text AS demarre_le, duree_ms, succes, erreur
         FROM public.cron_executions
        ORDER BY tache, succes, demarre_le DESC`,
    );
    return { lignes: rows, disponible: true };
  } catch {
    return { lignes: [], disponible: false };
  }
}

export interface EtatCron {
  /** L'API des tâches répond-elle ? */
  joignable: boolean;
  erreur: string | null;
  taches: TacheAdmin[];
  bilan: BilanCron;
  /** `false` quand `public.cron_executions` est illisible. */
  historiqueDisponible: boolean;
}

/** État des tâches planifiées. Ne lève jamais : une API arrêtée est un affichage. */
export async function etatDuCron(): Promise<EtatCron> {
  const [reponse, executions] = await Promise.all([
    appeler<ReponseCron>("/").then(
      r => ({ ok: true as const, r }),
      (e: unknown) => ({ ok: false as const, e }),
    ),
    executionsParTache(),
  ]);
  const catalogue: readonly DescriptionTache[] =
    reponse.ok && Array.isArray(reponse.r?.catalogue) && reponse.r.catalogue.length > 0
      ? reponse.r.catalogue
      : CATALOGUE_TACHES;
  const taches = construireTaches(catalogue, reponse.ok ? reponse.r : null, executions.lignes);
  return {
    joignable: reponse.ok,
    erreur: reponse.ok ? null : reponse.e instanceof Error ? reponse.e.message : String(reponse.e),
    taches,
    bilan: bilanTaches(taches),
    historiqueDisponible: executions.disponible,
  };
}

export interface ResultatDeclenchement {
  ok: boolean;
  tache: string;
  message: string;
}

/**
 * Déclenche une tâche, après avoir vérifié le rôle CONTRE le catalogue.
 *
 * L'API répond 202 et poursuit en tâche de fond : la réponse dit « démarrée »,
 * jamais « réussie » — le résultat se lit ensuite dans l'historique.
 */
export async function declencherTache(nom: string, role: string | null | undefined): Promise<ResultatDeclenchement> {
  const etat = await etatDuCron();
  const tache = etat.taches.find(t => t.nom === nom);
  if (!tache) {
    return { ok: false, tache: nom, message: raisonRefus(nom) };
  }
  if (!peutLancerDepuisLeSite(tache, role)) {
    return {
      ok: false,
      tache: tache.nom,
      message: tache.motifBlocage ?? `La tâche « ${tache.nom} » exige le rôle administrateur.`,
    };
  }
  if (!etat.joignable) {
    return { ok: false, tache: tache.nom, message: etat.erreur ?? "API des tâches injoignable." };
  }
  const decrite = decrireTache(tache.nom);

  try {
    await appeler(`/${encodeURIComponent(tache.nom)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ origine: "manuel" }),
    });
    return {
      ok: true,
      tache: tache.nom,
      message: `« ${tache.titre} » démarrée en tâche de fond${
        decrite?.dureeIndicative ? ` (${decrite.dureeIndicative})` : ""
      }.`,
    };
  } catch (erreur) {
    return {
      ok: false,
      tache: tache.nom,
      message: erreur instanceof Error ? erreur.message : String(erreur),
    };
  }
}

/** Historique récent, toutes tâches confondues. */
export async function historiqueDuCron(limite = 20): Promise<ExecutionCron[]> {
  const plafond = Math.min(Math.max(Math.trunc(limite), 1), 100);
  try {
    const { rows } = await getPgPool().query<ExecutionCron>(
      `SELECT tache, demarre_le::text AS demarre_le, duree_ms, succes, erreur, origine
         FROM public.cron_executions ORDER BY demarre_le DESC LIMIT $1`,
      [plafond],
    );
    return rows;
  } catch {
    return [];
  }
}
