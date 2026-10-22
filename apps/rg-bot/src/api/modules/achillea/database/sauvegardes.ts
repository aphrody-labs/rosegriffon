/**
 * Sauvegarde et restauration du schéma `achillea` par `pg_dump` / `pg_restore`.
 *
 * - Format custom (`-Fc`) : compressé, et `pg_restore` peut n'en extraire qu'une table.
 * - Écriture dans un fichier `.partiel` renommé au succès : la liste ne montre
 *   jamais une archive tronquée.
 * - La restauration n'accepte qu'un nom présent dans la liste (jamais un chemin),
 *   prend d'abord une sauvegarde de l'état courant et refuse si elle échoue, puis
 *   rejoue l'archive en une seule transaction (`--single-transaction`).
 * - Une seule opération à la fois par processus.
 * - Le mot de passe passe par `PGPASSWORD`, jamais par la ligne de commande
 *   (visible dans `ps`).
 *
 * Toutes les dépendances système (lancement de processus, recherche des
 * binaires, horloge) sont injectables : les tests ne lancent rien.
 */
import { mkdir, readdir, rename, stat, unlink } from "node:fs/promises";
import { join } from "node:path";

export const SCHEMA_SAUVEGARDE = "achillea" as const;
export const REPERTOIRE_PAR_DEFAUT = "/var/backups/achillea";
export const CONSERVATION_PAR_DEFAUT = 14;

/** `achillea-20261022T101500Z.dump`, avec suffixe pour les sauvegardes d'avant restauration. */
export const MOTIF_NOM = /^achillea-\d{8}T\d{6}Z(?:-avant-restauration)?\.dump$/;

export type ResultatProcessus = { code: number; stderr: string };
export type Executeur = (commande: string[], env: Record<string, string>) => Promise<ResultatProcessus>;

export const executerParDefaut: Executeur = async (commande, env) => {
  const processus = Bun.spawn(commande, {
    env: { ...Bun.env, ...env },
    stdin: "ignore",
    stdout: "ignore",
    stderr: "pipe",
  });
  const [code, stderr] = await Promise.all([processus.exited, new Response(processus.stderr).text()]);
  return { code, stderr };
};

export type DependancesSauvegarde = {
  executer: Executeur;
  /** Chemin d'un binaire ou `null` (par défaut `Bun.which`). */
  trouver: (binaire: string) => string | null;
  repertoire: string;
  conservation: number;
  urlBase: string;
  maintenant: () => Date;
};

export function configurationDepuisEnv(env: Record<string, string | undefined> = Bun.env) {
  const conservation = Math.floor(Number(env.ACHILLEA_BACKUP_KEEP ?? CONSERVATION_PAR_DEFAUT));
  return {
    repertoire: (env.ACHILLEA_BACKUP_DIR ?? "").trim() || REPERTOIRE_PAR_DEFAUT,
    conservation: Number.isFinite(conservation) && conservation >= 1 ? conservation : CONSERVATION_PAR_DEFAUT,
  };
}

export class OutilAbsent extends Error {
  constructor(readonly binaire: string) {
    super(`« ${binaire} » est introuvable sur l'hôte de l'API : installe les outils clients PostgreSQL.`);
  }
}
export class EchecOutil extends Error {}
export class SauvegardeInconnue extends Error {}
export class OperationEnCours extends Error {}
export class SauvegardePrealableImpossible extends Error {}

export function nomSauvegarde(date: Date, avantRestauration = false): string {
  const horodatage = date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  return `achillea-${horodatage}${avantRestauration ? "-avant-restauration" : ""}.dump`;
}

/** URL sans mot de passe + `PGPASSWORD` à part. */
export function connexionPg(url: string): { dbname: string; env: Record<string, string> } {
  const analyse = new URL(url);
  const motDePasse = decodeURIComponent(analyse.password);
  analyse.password = "";
  return { dbname: analyse.toString(), env: motDePasse ? { PGPASSWORD: motDePasse } : {} };
}

export type Sauvegarde = { name: string; sizeBytes: number; createdAt: string };

export async function listerSauvegardes(repertoire: string): Promise<Sauvegarde[]> {
  let noms: string[];
  try {
    noms = await readdir(repertoire);
  } catch (cause) {
    if ((cause as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw cause;
  }
  const archives = await Promise.all(
    noms
      .filter(nom => MOTIF_NOM.test(nom))
      .map(async nom => {
        const infos = await stat(join(repertoire, nom));
        return { name: nom, sizeBytes: infos.size, createdAt: infos.mtime.toISOString() };
      }),
  );
  // Le nom porte l'horodatage UTC : l'ordre lexical est l'ordre chronologique.
  return archives.toSorted((a, b) => b.name.localeCompare(a.name));
}

/** Supprime les archives au-delà de `conservation`, sauf celles protégées. */
export async function appliquerRotation(
  repertoire: string,
  conservation: number,
  proteger: ReadonlySet<string> = new Set(),
): Promise<string[]> {
  const archives = await listerSauvegardes(repertoire);
  const supprimees: string[] = [];
  for (const archive of archives.slice(conservation)) {
    if (proteger.has(archive.name)) continue;
    await unlink(join(repertoire, archive.name));
    supprimees.push(archive.name);
  }
  return supprimees;
}

let operationEnCours: string | null = null;

async function exclusivement<T>(nom: string, travail: () => Promise<T>): Promise<T> {
  if (operationEnCours) throw new OperationEnCours(`Une opération est déjà en cours : ${operationEnCours}.`);
  operationEnCours = nom;
  try {
    return await travail();
  } finally {
    operationEnCours = null;
  }
}

async function dump(deps: DependancesSauvegarde, avantRestauration: boolean, proteger: ReadonlySet<string>) {
  const pgDump = deps.trouver("pg_dump");
  if (!pgDump) throw new OutilAbsent("pg_dump");
  await mkdir(deps.repertoire, { recursive: true });
  const nom = nomSauvegarde(deps.maintenant(), avantRestauration);
  const final = join(deps.repertoire, nom);
  const partiel = `${final}.partiel`;
  const { dbname, env } = connexionPg(deps.urlBase);
  const resultat = await deps.executer(
    [
      pgDump,
      "--format=custom",
      `--schema=${SCHEMA_SAUVEGARDE}`,
      "--no-owner",
      "--no-privileges",
      "--file",
      partiel,
      "--dbname",
      dbname,
    ],
    env,
  );
  if (resultat.code !== 0) {
    await unlink(partiel).catch(() => {});
    throw new EchecOutil(`pg_dump a échoué (code ${resultat.code}) : ${resultat.stderr.trim().slice(0, 400)}`);
  }
  await rename(partiel, final);
  await appliquerRotation(deps.repertoire, deps.conservation, new Set([nom, ...proteger]));
  return nom;
}

/** Sauvegarde le schéma ; rend le nom de l'archive. */
export function sauvegarder(deps: DependancesSauvegarde): Promise<string> {
  return exclusivement("sauvegarde", () => dump(deps, false, new Set()));
}

/**
 * Restaure une archive de la liste. Rend le nom de la sauvegarde prise juste
 * avant, qui permet de revenir en arrière.
 */
export function restaurer(deps: DependancesSauvegarde, nom: string): Promise<{ sauvegardePrealable: string }> {
  return exclusivement("restauration", async () => {
    const archives = await listerSauvegardes(deps.repertoire);
    const cible = archives.find(archive => archive.name === nom);
    if (!MOTIF_NOM.test(nom) || !cible) throw new SauvegardeInconnue(`Sauvegarde « ${nom} » introuvable.`);
    const pgRestore = deps.trouver("pg_restore");
    if (!pgRestore) throw new OutilAbsent("pg_restore");

    let sauvegardePrealable: string;
    try {
      sauvegardePrealable = await dump(deps, true, new Set([cible.name]));
    } catch (cause) {
      const motif = cause instanceof Error ? cause.message : String(cause);
      throw new SauvegardePrealableImpossible(
        `Restauration refusée : la sauvegarde de l'état courant a échoué (${motif}).`,
      );
    }

    const { dbname, env } = connexionPg(deps.urlBase);
    const resultat = await deps.executer(
      [
        pgRestore,
        "--clean",
        "--if-exists",
        "--no-owner",
        "--no-privileges",
        "--single-transaction",
        "--exit-on-error",
        `--schema=${SCHEMA_SAUVEGARDE}`,
        "--dbname",
        dbname,
        join(deps.repertoire, cible.name),
      ],
      env,
    );
    if (resultat.code !== 0)
      throw new EchecOutil(
        `pg_restore a échoué (code ${resultat.code}), transaction annulée : ${resultat.stderr.trim().slice(0, 400)}`,
      );
    return { sauvegardePrealable };
  });
}
