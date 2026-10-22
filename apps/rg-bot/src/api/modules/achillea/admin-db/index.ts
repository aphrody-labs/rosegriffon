/**
 * `/admin/db` — navigateur de tables et console SQL du back-office.
 *
 * Réservé au SuperAdministrateur (rôle 3, comme le legacy). Toutes les règles
 * d'autorisation sont dans `./securite` ; ce fichier ne fait qu'assembler du
 * SQL à partir d'identifiants déjà passés par la liste blanche.
 */
import { Elysia, status, t } from "elysia";
import { sql, type Kysely, type RawBuilder } from "kysely";
import type { Database } from "@rosegriffon/db/schema";
import type { DbColumn, DbTableRow } from "@rosegriffon/achillea-client/v1";
import { dbPlugin } from "../../../plugins/db";
import { journaliserAudit } from "../audit";
import { chargerRoleEnBase, ROLE_STAFF, staff, type ChargeurRole, type EnTetesAuth } from "../staff";
import {
  citerIdent,
  citerTable,
  clePrimaire,
  consoleSqlOuverte,
  DELAI_REQUETE_MS,
  envelopperAvecLimite,
  LIGNES_PAR_PAGE_MAX,
  LIGNES_REQUETE_MAX,
  masquerLigne,
  SCHEMA_ACHILLEA,
  TABLES_LISIBLES,
  TABLES_PROTEGEES,
  tableAutorisee,
  tableEditable,
  validerRequeteLecture,
  valeursEcrivables,
  verifierPlan,
} from "./securite";

const message = t.Object({ message: t.String() });

async function colonnesDe(db: Kysely<Database>, table: string): Promise<DbColumn[]> {
  const [colonnes, cles] = await Promise.all([
    sql<{ column_name: string; data_type: string; is_nullable: string; column_default: string | null }>`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = ${SCHEMA_ACHILLEA} AND table_name = ${table}
      ORDER BY ordinal_position
    `.execute(db),
    sql<{ column_name: string }>`
      SELECT kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
      WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_schema = ${SCHEMA_ACHILLEA} AND tc.table_name = ${table}
    `.execute(db),
  ]);
  const pk = new Set(cles.rows.map(r => r.column_name));
  return colonnes.rows.map(c => ({
    name: c.column_name,
    dataType: c.data_type,
    nullable: c.is_nullable === "YES",
    default: c.column_default,
    isPrimaryKey: pk.has(c.column_name),
  }));
}

function egalites(valeurs: Record<string, unknown>): RawBuilder<unknown> {
  return sql.join(
    Object.entries(valeurs).map(([colonne, valeur]) => sql`${sql.raw(citerIdent(colonne))} = ${valeur}`),
    sql` AND `,
  );
}

function messageErreurPg(cause: unknown): string {
  const brut = cause instanceof Error ? cause.message : String(cause);
  return brut.slice(0, 300);
}

export type OptionsAdminDb = { chargerRole?: ChargeurRole };

export function creerAdminDbController(options: OptionsAdminDb = {}) {
  const chargerRole = options.chargerRole ?? chargerRoleEnBase;
  const superAdmin = (db: Kysely<Database>, headers: EnTetesAuth) =>
    staff(db, headers, ROLE_STAFF.SuperAdministrateur, chargerRole);

  /** Garde commune aux routes `/tables/:table/*`. */
  const exigerTable = (table: string) =>
    tableAutorisee(table) ? null : status(404, { message: `Table « ${table} » introuvable ou non autorisée.` });

  return new Elysia({ prefix: "/admin/db" })
    .use(dbPlugin)
    .get(
      "/tables",
      async ({ db, headers }) => {
        const auth = await superAdmin(db, headers);
        if (auth.error) return auth.error;
        const lignes = await sql<{ name: string; estimate: string }>`
          SELECT c.relname AS name, GREATEST(c.reltuples, 0)::bigint AS estimate
          FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = ${SCHEMA_ACHILLEA} AND c.relkind IN ('r', 'p')
          ORDER BY c.relname
        `.execute(db);
        const data: DbTableRow[] = lignes.rows
          .filter(ligne => TABLES_LISIBLES.has(ligne.name))
          .map(ligne => ({
            name: ligne.name,
            estimatedRows: Number(ligne.estimate),
            protected: TABLES_PROTEGEES.has(ligne.name),
          }));
        return { data };
      },
    )
    .get(
      "/tables/:table/columns",
      async ({ db, headers, params: { table } }) => {
        const auth = await superAdmin(db, headers);
        if (auth.error) return auth.error;
        const refus = exigerTable(table);
        if (refus) return refus;
        const data = await colonnesDe(db, table);
        if (data.length === 0) return status(404, { message: `Table « ${table} » introuvable.` });
        return { data };
      },
      { params: t.Object({ table: t.String({ maxLength: 63 }) }) },
    )
    .get(
      "/tables/:table/rows",
      async ({ db, headers, params: { table }, query }) => {
        const auth = await superAdmin(db, headers);
        if (auth.error) return auth.error;
        const refus = exigerTable(table);
        if (refus) return refus;
        const columns = await colonnesDe(db, table);
        if (columns.length === 0) return status(404, { message: `Table « ${table} » introuvable.` });
        const limit = Math.min(LIGNES_PAR_PAGE_MAX, Math.max(1, Math.floor(query.limit ?? 25)));
        const page = Math.max(1, Math.floor(query.page ?? 1));
        // Le tri n'accepte qu'un nom de colonne réel, jamais une expression.
        const colonneTri = columns.find(c => c.name === query.sort)?.name;
        const ordre = colonneTri
          ? sql.raw(`ORDER BY ${citerIdent(colonneTri)} ${query.order === "desc" ? "DESC" : "ASC"}`)
          : sql.raw("");
        const cible = sql.raw(citerTable(table));
        const [lignes, compte] = await Promise.all([
          sql<Record<string, unknown>>`SELECT * FROM ${cible} ${ordre} LIMIT ${limit} OFFSET ${(page - 1) * limit}`.execute(
            db,
          ),
          sql<{ total: number }>`SELECT COUNT(*)::int AS total FROM ${cible}`.execute(db),
        ]);
        const total = Number(compte.rows[0]?.total ?? 0);
        return {
          data: lignes.rows.map(ligne => masquerLigne(table, ligne)),
          columns,
          meta: { page, limit, total, pageCount: Math.ceil(total / limit) },
        };
      },
      {
        params: t.Object({ table: t.String({ maxLength: 63 }) }),
        query: t.Object({
          page: t.Optional(t.Numeric({ minimum: 1 })),
          limit: t.Optional(t.Numeric({ minimum: 1 })),
          sort: t.Optional(t.String({ maxLength: 63 })),
          order: t.Optional(t.Union([t.Literal("asc"), t.Literal("desc")])),
        }),
      },
    )
    .post(
      "/tables/:table/rows",
      async ({ db, headers, params: { table }, body }) => {
        const auth = await superAdmin(db, headers);
        if (auth.error) return auth.error;
        if (!tableEditable(table)) return status(403, { message: `Table « ${table} » non éditable depuis cet outil.` });
        const columns = await colonnesDe(db, table);
        if (columns.length === 0) return status(404, { message: `Table « ${table} » introuvable.` });
        const valeurs = valeursEcrivables(
          table,
          body.values,
          columns.map(c => c.name),
        );
        const cles = Object.keys(valeurs);
        if (cles.length === 0) return status(400, { message: "Aucune valeur valide fournie." });
        try {
          const row = await db.transaction().execute(async trx => {
            await sql`SET LOCAL statement_timeout = ${sql.lit(`${DELAI_REQUETE_MS}ms`)}`.execute(trx);
            const insere = await sql<Record<string, unknown>>`
              INSERT INTO ${sql.raw(citerTable(table))} (${sql.join(cles.map(c => sql.raw(citerIdent(c))))})
              VALUES (${sql.join(cles.map(c => sql`${valeurs[c]}`))})
              RETURNING *
            `.execute(trx);
            await journaliserAudit(trx, {
              acteur: auth.actor.id,
              action: "admin_db.insert",
              cibleType: table,
              charge: { values: valeurs },
            });
            return insere.rows[0] ?? null;
          });
          return { success: true, row: row ? masquerLigne(table, row) : null };
        } catch (cause) {
          return status(400, { message: `Insertion refusée : ${messageErreurPg(cause)}` });
        }
      },
      {
        params: t.Object({ table: t.String({ maxLength: 63 }) }),
        body: t.Object({ values: t.Record(t.String(), t.Unknown()) }),
      },
    )
    .patch(
      "/tables/:table/rows",
      async ({ db, headers, params: { table }, body }) => {
        const auth = await superAdmin(db, headers);
        if (auth.error) return auth.error;
        if (!tableEditable(table)) return status(403, { message: `Table « ${table} » non éditable depuis cet outil.` });
        const columns = await colonnesDe(db, table);
        if (columns.length === 0) return status(404, { message: `Table « ${table} » introuvable.` });
        const colonnesCle = columns.filter(c => c.isPrimaryKey).map(c => c.name);
        const pk = clePrimaire(body.pk, colonnesCle);
        if (!pk) return status(400, { message: "Clé primaire absente ou incomplète : édition refusée par sécurité." });
        const valeurs = valeursEcrivables(
          table,
          body.values,
          columns.map(c => c.name),
        );
        // La clé primaire elle-même ne se modifie jamais par ce chemin.
        for (const colonne of colonnesCle) delete valeurs[colonne];
        if (Object.keys(valeurs).length === 0) return status(400, { message: "Aucune valeur à modifier." });
        try {
          const row = await db.transaction().execute(async trx => {
            await sql`SET LOCAL statement_timeout = ${sql.lit(`${DELAI_REQUETE_MS}ms`)}`.execute(trx);
            const affectations = sql.join(
              Object.entries(valeurs).map(([c, v]) => sql`${sql.raw(citerIdent(c))} = ${v}`),
              sql`, `,
            );
            const maj = await sql<Record<string, unknown>>`
              UPDATE ${sql.raw(citerTable(table))} SET ${affectations} WHERE ${egalites(pk)} RETURNING *
            `.execute(trx);
            if (maj.rows.length !== 1) throw new LigneIntrouvable(maj.rows.length);
            await journaliserAudit(trx, {
              acteur: auth.actor.id,
              action: "admin_db.update",
              cibleType: table,
              cibleId: JSON.stringify(pk),
              charge: { pk, values: valeurs },
            });
            return maj.rows[0]!;
          });
          return { success: true, row: masquerLigne(table, row) };
        } catch (cause) {
          if (cause instanceof LigneIntrouvable) return status(404, { message: "Ligne introuvable." });
          return status(400, { message: `Modification refusée : ${messageErreurPg(cause)}` });
        }
      },
      {
        params: t.Object({ table: t.String({ maxLength: 63 }) }),
        body: t.Object({ pk: t.Record(t.String(), t.Unknown()), values: t.Record(t.String(), t.Unknown()) }),
      },
    )
    .delete(
      "/tables/:table/rows",
      async ({ db, headers, params: { table }, body }) => {
        const auth = await superAdmin(db, headers);
        if (auth.error) return auth.error;
        if (!tableEditable(table)) return status(403, { message: `Table « ${table} » non éditable depuis cet outil.` });
        const columns = await colonnesDe(db, table);
        if (columns.length === 0) return status(404, { message: `Table « ${table} » introuvable.` });
        const pk = clePrimaire(
          body.pk,
          columns.filter(c => c.isPrimaryKey).map(c => c.name),
        );
        if (!pk) return status(400, { message: "Clé primaire absente ou incomplète : suppression refusée par sécurité." });
        try {
          await db.transaction().execute(async trx => {
            await sql`SET LOCAL statement_timeout = ${sql.lit(`${DELAI_REQUETE_MS}ms`)}`.execute(trx);
            const supprime = await sql`
              DELETE FROM ${sql.raw(citerTable(table))} WHERE ${egalites(pk)} RETURNING 1
            `.execute(trx);
            if (supprime.rows.length !== 1) throw new LigneIntrouvable(supprime.rows.length);
            await journaliserAudit(trx, {
              acteur: auth.actor.id,
              action: "admin_db.delete",
              cibleType: table,
              cibleId: JSON.stringify(pk),
              charge: { pk },
            });
          });
          return { success: true };
        } catch (cause) {
          if (cause instanceof LigneIntrouvable) return status(404, { message: "Ligne introuvable." });
          return status(400, { message: `Suppression refusée : ${messageErreurPg(cause)}` });
        }
      },
      {
        params: t.Object({ table: t.String({ maxLength: 63 }) }),
        body: t.Object({ pk: t.Record(t.String(), t.Unknown()) }),
      },
    )
    .post(
      "/query",
      async ({ db, headers, body }) => {
        const auth = await superAdmin(db, headers);
        if (auth.error) return auth.error;
        if (!consoleSqlOuverte())
          return status(403, { message: "La console SQL libre est désactivée en production." });
        const verdict = validerRequeteLecture(body.sql);
        if (!verdict.ok) return status(400, { message: verdict.message });
        const enveloppee = envelopperAvecLimite(verdict.sql, LIGNES_REQUETE_MAX);
        const debut = performance.now();
        let data: Record<string, unknown>[];
        try {
          data = await db.transaction().execute(async trx => {
            await sql`SET TRANSACTION READ ONLY`.execute(trx);
            await sql`SET LOCAL statement_timeout = ${sql.lit(`${DELAI_REQUETE_MS}ms`)}`.execute(trx);
            // `public` est retiré du chemin : une fonction non qualifiée ne peut
            // résoudre que dans `achillea` ou `pg_catalog`.
            await sql`SET LOCAL search_path = ${sql.raw(`${citerIdent(SCHEMA_ACHILLEA)}, pg_catalog`)}`.execute(trx);
            const plan = await sql<{ "QUERY PLAN": unknown }>`EXPLAIN (VERBOSE, FORMAT JSON) ${sql.raw(enveloppee)}`.execute(
              trx,
            );
            const controle = verifierPlan(plan.rows[0]?.["QUERY PLAN"]);
            if (!controle.ok) throw new RequeteRefusee(controle.message);
            const resultat = await sql<Record<string, unknown>>`${sql.raw(enveloppee)}`.execute(trx);
            return resultat.rows;
          });
        } catch (cause) {
          if (cause instanceof RequeteRefusee) return status(400, { message: cause.message });
          return status(400, { message: `Requête en échec : ${messageErreurPg(cause)}` });
        }
        const durationMs = Math.round(performance.now() - debut);
        // La transaction de lecture est READ ONLY : l'audit s'écrit à part.
        await journaliserAudit(db, {
          acteur: auth.actor.id,
          action: "admin_db.query",
          cibleType: "sql",
          charge: { sql: verdict.sql, rowCount: data.length },
        }).catch(cause => console.error("[admin-db] audit de la requête impossible", cause));
        return { data, rowCount: data.length, durationMs };
      },
      {
        body: t.Object({ sql: t.String({ maxLength: 10_000 }) }),
        response: {
          200: t.Object({ data: t.Array(t.Record(t.String(), t.Unknown())), rowCount: t.Number(), durationMs: t.Number() }),
          400: message,
          401: message,
          403: message,
        },
      },
    );
}

class LigneIntrouvable extends Error {
  constructor(readonly nombre: number) {
    super(`${nombre} ligne(s) affectée(s)`);
  }
}

class RequeteRefusee extends Error {}

export const adminDbController = creerAdminDbController();
