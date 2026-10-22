/**
 * `/database` — taille, liste, sauvegarde et restauration du schéma `achillea`.
 *
 * Lecture et sauvegarde : SuperAdministrateur ou jeton de développement, comme
 * les autres sondes. Restauration : session SuperAdministrateur uniquement,
 * pour qu'un humain identifié signe l'opération dans le journal d'audit.
 */
import { Elysia, status, t } from "elysia";
import { sql, type Kysely } from "kysely";
import type { Database } from "@rosegriffon/db/schema";
import { getAchilleaDatabaseUrl } from "@rosegriffon/db/achillea";
import { dbPlugin } from "../../../plugins/db";
import { journaliserAudit, type EntreeAudit } from "../audit";
import { chargerRoleEnBase, ROLE_STAFF, staff, superAdminOuJetonDev, type ChargeurRole } from "../staff";
import {
  configurationDepuisEnv,
  EchecOutil,
  executerParDefaut,
  listerSauvegardes,
  OperationEnCours,
  OutilAbsent,
  restaurer,
  sauvegarder,
  SauvegardeInconnue,
  SauvegardePrealableImpossible,
  SCHEMA_SAUVEGARDE,
  type DependancesSauvegarde,
} from "./sauvegardes";

export type Journal = (db: Kysely<Database>, entree: EntreeAudit) => Promise<void>;

const journalParDefaut: Journal = async (db, entree) => {
  await journaliserAudit(db, entree);
};

export type OptionsDatabase = {
  chargerRole?: ChargeurRole;
  sauvegardes?: Partial<DependancesSauvegarde>;
  journal?: Journal;
};

function traduireErreur(cause: unknown) {
  const message = cause instanceof Error ? cause.message : String(cause);
  if (cause instanceof OutilAbsent) return status(503, { message });
  if (cause instanceof SauvegardeInconnue) return status(404, { message });
  if (cause instanceof OperationEnCours) return status(409, { message });
  if (cause instanceof SauvegardePrealableImpossible) return status(409, { message });
  if (cause instanceof EchecOutil) return status(500, { message });
  throw cause;
}

export function creerDatabaseController(options: OptionsDatabase = {}) {
  const chargerRole = options.chargerRole ?? chargerRoleEnBase;
  const journal = options.journal ?? journalParDefaut;
  const dependances = (): DependancesSauvegarde => ({
    executer: executerParDefaut,
    trouver: binaire => Bun.which(binaire),
    urlBase: getAchilleaDatabaseUrl(),
    maintenant: () => new Date(),
    ...configurationDepuisEnv(),
    ...options.sauvegardes,
  });

  return new Elysia({ prefix: "/database" })
    .use(dbPlugin)
    .get("/size", async ({ db, headers }) => {
      const auth = await superAdminOuJetonDev(db, headers, chargerRole);
      if (auth.error) return auth.error;
      const resultat = await sql<{ base: string; schema: string }>`
        SELECT
          pg_database_size(current_database())::text AS base,
          (SELECT coalesce(sum(pg_total_relation_size(c.oid)), 0)
             FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = ${SCHEMA_SAUVEGARDE} AND c.relkind IN ('r', 'p', 'm'))::text AS schema
      `.execute(db);
      const base = Number(resultat.rows[0]?.base ?? 0);
      const schema = Number(resultat.rows[0]?.schema ?? 0);
      return {
        database: { bytes: base, pretty: formaterOctets(base) },
        schema: { name: SCHEMA_SAUVEGARDE, bytes: schema, pretty: formaterOctets(schema) },
      };
    })
    .get("/backups", async ({ db, headers }) => {
      const auth = await superAdminOuJetonDev(db, headers, chargerRole);
      if (auth.error) return auth.error;
      const deps = dependances();
      return { data: await listerSauvegardes(deps.repertoire), retention: deps.conservation };
    })
    .post("/backup", async ({ db, headers }) => {
      const auth = await superAdminOuJetonDev(db, headers, chargerRole);
      if (auth.error) return auth.error;
      try {
        const snapshotName = await sauvegarder(dependances());
        await journal(db, {
          acteur: auth.actor?.id ?? null,
          action: "database.backup",
          cibleType: "database",
          cibleId: snapshotName,
        });
        return { message: `Sauvegarde créée : ${snapshotName}`, data: { snapshotName } };
      } catch (cause) {
        return traduireErreur(cause);
      }
    })
    .post(
      "/restore",
      async ({ db, headers, body }) => {
        const auth = await staff(db, headers, ROLE_STAFF.SuperAdministrateur, chargerRole);
        if (auth.error) return auth.error;
        try {
          const { sauvegardePrealable } = await restaurer(dependances(), body.snapshotName);
          await journal(db, {
            acteur: auth.actor.id,
            action: "database.restore",
            cibleType: "database",
            cibleId: body.snapshotName,
            charge: { sauvegardePrealable },
          });
          return {
            message: `Sauvegarde ${body.snapshotName} restaurée. État précédent conservé dans ${sauvegardePrealable}.`,
            data: { snapshotName: body.snapshotName },
          };
        } catch (cause) {
          return traduireErreur(cause);
        }
      },
      { body: t.Object({ snapshotName: t.String({ minLength: 1, maxLength: 120 }) }) },
    );
}

export function formaterOctets(octets: number): string {
  const unites = ["o", "Kio", "Mio", "Gio", "Tio"];
  let valeur = octets;
  let indice = 0;
  while (valeur >= 1024 && indice < unites.length - 1) {
    valeur /= 1024;
    indice++;
  }
  return `${valeur.toFixed(indice === 0 ? 0 : 1)} ${unites[indice]}`;
}

export const databaseController = creerDatabaseController();
