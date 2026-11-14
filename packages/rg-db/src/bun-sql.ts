import { STACK_CONTRACT } from "@rosegriffon/config/contract";
import { resolvePoolSize } from "@aphrody/sql/env";
import { createSql } from "@aphrody/sql/postgres";
import type { SQL } from "bun";
import { getDatabaseURL, getInagleDatabaseURL } from "./pg";

const POOL_DEFAULTS = STACK_CONTRACT.database.primary.pool;

export interface BunSqlOptions {
  url?: string;
  max?: number;
  idleTimeout?: number;
  maxLifetime?: number;
  connectionTimeout?: number;
}

export interface BunPgQueryResult<Row = Record<string, unknown>> {
  rows: Row[];
  rowCount: number;
}

export interface BunPgClient {
  connect(): Promise<void>;
  query<Row = Record<string, unknown>>(
    text: string,
    params?: unknown[],
  ): Promise<BunPgQueryResult<Row>>;
  end(): Promise<void>;
}

const MESSAGE_POOL_EMPOISONNE =
  /connection must be a (PostgresSQLConnection|MySQLConnection)/;

/** Vrai pour l'erreur d'un pool Bun.SQL dont le socket natif est fermé. */
export function estPoolEmpoisonne(err: unknown): boolean {
  const message =
    err instanceof Error ? err.message : typeof err === "string" ? err : "";
  return MESSAGE_POOL_EMPOISONNE.test(message);
}

export interface ClientParesseux {
  readonly sql: SQL;
  recreer(): boolean;
}

/**
 * Lazy recoverable `Bun.SQL` proxy shared across bots, cron runners, and workers.
 * Defers socket creation until first query and isolates poisoned pool replacement.
 */
export function createLazyBunSql(creer: () => SQL): ClientParesseux {
  let instance: SQL | null = null;
  const reel = (): SQL => (instance ??= creer());
  const sql = new Proxy(function () {} as unknown as SQL, {
    apply: (_cible, _this, args) =>
      Reflect.apply(
        reel() as unknown as (...a: unknown[]) => unknown,
        undefined,
        args,
      ),
    get: (_cible, propriete) => {
      const cible = reel();
      const valeur = Reflect.get(cible, propriete);
      return typeof valeur === "function" ? valeur.bind(cible) : valeur;
    },
  });
  return {
    sql,
    recreer(): boolean {
      const ancien = instance;
      instance = null;
      if (!ancien) return false;
      try {
        ancien
          .close({ timeout: POOL_DEFAULTS.idleTimeoutSec })
          .catch(() => undefined);
      } catch {
        // Ignore close errors on an already poisoned pool.
      }
      return true;
    },
  };
}

/** Build the canonical Bun PostgreSQL client used by Bun workers and bots. */
export function createBunSql(options: BunSqlOptions = {}): SQL {
  const url = options.url ?? getDatabaseURL();

  const max =
    options.max ??
    resolvePoolSize(Bun.env.DATABASE_POOL_MAX, {
      fallback: POOL_DEFAULTS.defaultMax,
      ceiling: POOL_DEFAULTS.ceiling,
    });
  return createSql(url, {
    max,
    idleTimeout: options.idleTimeout ?? POOL_DEFAULTS.idleTimeoutSec,
    maxLifetime: options.maxLifetime ?? POOL_DEFAULTS.maxLifetimeSec,
    connectionTimeout:
      options.connectionTimeout ?? POOL_DEFAULTS.connectTimeoutSec,
    tls: "inherit",
    prepare: "auto",
  });
}

export function createInagleBunSql(
  options: Omit<BunSqlOptions, "url"> = {},
): SQL {
  return createBunSql({ ...options, url: getInagleDatabaseURL() });
}

/** Adaptateur client minimal pour les scripts historiques connect/query/end. */
export function createBunPgClient(connectionString: string): BunPgClient {
  const sql = createBunSql({ url: connectionString, max: 1 });
  return {
    async connect(): Promise<void> {},
    async query<Row = Record<string, unknown>>(
      text: string,
      params: unknown[] = [],
    ): Promise<BunPgQueryResult<Row>> {
      const rows = (await sql.unsafe(text, params)) as Row[];
      return { rows, rowCount: rows.length };
    },
    async end(): Promise<void> {
      await sql.end();
    },
  };
}
