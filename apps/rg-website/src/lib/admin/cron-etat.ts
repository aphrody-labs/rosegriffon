/**
 * Vue d'administration des tâches planifiées — module PUR.
 *
 * Il assemble trois sources réelles : le catalogue partagé (descriptions), la
 * réponse de `GET /v1/cron` (noms servis, tâches hors serverless) et
 * l'historique `public.cron_executions` (dernier état, dernier échec). Aucune
 * tâche n'est inventée : une tâche du registre absente du catalogue est
 * affichée telle quelle, en lecture seule.
 */
import type { DescriptionTache, FamilleTache, NiveauTache } from "@rosegriffon/types/cron";

/**
 * Tâches à effet financier : jamais déclenchables depuis le site, même par un
 * administrateur. Elles restent lançables en CLI sur le serveur.
 */
export const TACHES_LECTURE_SEULE: Readonly<Record<string, string>> = Object.freeze({
  "achillea:seasons": "Clôture des saisons et distribution des récompenses : effet financier, lancement manuel interdit.",
  "achillea:weekly-payout": "Versement hebdomadaire : effet financier, lancement manuel interdit.",
});

/** Nom sous lequel l'historique consigne une tâche, quand il diffère du nom public. */
export const ALIAS_HISTORIQUE: Readonly<Record<string, string>> = Object.freeze({
  db: "db:sync",
  discord: "discord:sync",
});

export interface ExecutionBrute {
  tache: string;
  demarre_le: string;
  duree_ms: number;
  succes: boolean;
  erreur: string | null;
}

export interface ReponseCron {
  tasks?: readonly string[];
  catalogue?: readonly DescriptionTache[];
  registre?: readonly string[];
  horsServerless?: Readonly<Record<string, string>>;
  alias?: Readonly<Record<string, string>>;
}

export interface TacheAdmin {
  nom: string;
  titre: string;
  role: string;
  planification: string;
  famille: FamilleTache | "autre";
  niveau: NiveauTache | "cli";
  /** Pourquoi le bouton n'existe pas, ou `null` quand le lancement est permis (selon le rôle). */
  motifBlocage: string | null;
  horsServerless: string | null;
  dureeIndicative: string | null;
  dernier: ExecutionBrute | null;
  dernierEchec: ExecutionBrute | null;
}

/** Dernière exécution et dernier échec de chaque tâche, depuis des lignes triées ou non. */
export function resumerExecutions(lignes: readonly ExecutionBrute[]): {
  dernieres: Map<string, ExecutionBrute>;
  echecs: Map<string, ExecutionBrute>;
} {
  const dernieres = new Map<string, ExecutionBrute>();
  const echecs = new Map<string, ExecutionBrute>();
  for (const ligne of lignes) {
    const t = Date.parse(ligne.demarre_le);
    const courante = dernieres.get(ligne.tache);
    if (!courante || t > Date.parse(courante.demarre_le)) dernieres.set(ligne.tache, ligne);
    if (!ligne.succes) {
      const echec = echecs.get(ligne.tache);
      if (!echec || t > Date.parse(echec.demarre_le)) echecs.set(ligne.tache, ligne);
    }
  }
  return { dernieres, echecs };
}

export function construireTaches(
  catalogue: readonly DescriptionTache[],
  reponse: ReponseCron | null,
  executions: readonly ExecutionBrute[],
): TacheAdmin[] {
  const alias = { ...ALIAS_HISTORIQUE, ...reponse?.alias };
  const horsServerless = reponse?.horsServerless ?? {};
  const { dernieres, echecs } = resumerExecutions(executions);
  const parNom = new Map(catalogue.map(t => [t.nom as string, t]));

  // Ordre : catalogue d'abord, puis les tâches du registre qu'il ne décrit pas.
  const noms = [...catalogue.map(t => t.nom as string)];
  for (const nom of [...(reponse?.registre ?? []), ...(reponse?.tasks ?? [])]) {
    if (!noms.includes(nom)) noms.push(nom);
  }

  return noms.map((nom): TacheAdmin => {
    const decrite = parNom.get(nom);
    const cleHistorique = alias[nom] ?? nom;
    const lectureSeule = TACHES_LECTURE_SEULE[nom] ?? null;
    let motifBlocage: string | null = null;
    if (lectureSeule) motifBlocage = lectureSeule;
    else if (!decrite) motifBlocage = "Tâche absente du catalogue partagé : lançable seulement en CLI sur le serveur.";
    else if (decrite.niveau === "interdit") motifBlocage = decrite.motifInterdiction ?? "Lancement interdit.";
    return {
      nom,
      titre: decrite?.titre ?? nom,
      role: decrite?.role ?? "Tâche du registre, non décrite au catalogue partagé.",
      planification: decrite?.planification ?? "manuel",
      famille: decrite?.famille ?? "autre",
      niveau: decrite?.niveau ?? "cli",
      motifBlocage,
      horsServerless: horsServerless[nom] ?? null,
      dureeIndicative: decrite?.dureeIndicative ?? null,
      dernier: dernieres.get(cleHistorique) ?? null,
      dernierEchec: echecs.get(cleHistorique) ?? null,
    };
  });
}

export interface BilanCron {
  total: number;
  enEchec: number;
  jamaisExecutees: number;
  reussies: number;
}

/** « En échec » : la dernière exécution de la tâche a échoué. */
export function bilanTaches(taches: readonly TacheAdmin[]): BilanCron {
  let enEchec = 0;
  let jamais = 0;
  let reussies = 0;
  for (const t of taches) {
    if (!t.dernier) jamais++;
    else if (t.dernier.succes) reussies++;
    else enEchec++;
  }
  return { total: taches.length, enEchec, jamaisExecutees: jamais, reussies };
}

/** Le rôle peut-il lancer cette tâche depuis le site ? Administrateurs seulement. */
export function peutLancerDepuisLeSite(
  tache: Pick<TacheAdmin, "motifBlocage">,
  role: string | null | undefined,
): boolean {
  return tache.motifBlocage === null && (role === "admin" || role === "superadmin");
}
