/**
 * Outils de test des routes Achilléa portées : jeton de session signé et base
 * Kysely factice (dialecte PostgreSQL, requêtes consignées, réponses scriptées).
 */
import {
  Kysely,
  PostgresAdapter,
  PostgresIntrospector,
  PostgresQueryCompiler,
  type CompiledQuery,
  type DatabaseConnection,
  type QueryResult,
} from "kysely";
import type { Database } from "@rosegriffon/db/schema";

const b64url = (value: string | Uint8Array) => Buffer.from(value).toString("base64url");

/** Jeton de session Achilléa valide pour `JWT_SECRET_KEY` (cf. test/setup.ts). */
export async function sessionToken(userId: string): Promise<string> {
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = b64url(
    JSON.stringify({
      sub: userId,
      id: userId,
      tokenUse: "session",
      iss: "achillea",
      aud: "achillea-web",
      exp: Math.floor(Date.now() / 1000) + 3600,
    }),
  );
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(process.env.JWT_SECRET_KEY ?? ""),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${header}.${payload}`));
  return `${header}.${payload}.${b64url(new Uint8Array(signature))}`;
}

export interface RecordedQuery {
  sql: string;
  parameters: readonly unknown[];
}

export type QueryHandler = (query: RecordedQuery) => unknown[] | undefined;

/** Base factice : chaque requête est consignée, `handler` fournit les lignes. */
export function fakeDb(handler: QueryHandler = () => []) {
  const queries: RecordedQuery[] = [];
  const connection: DatabaseConnection = {
    async executeQuery<R>(compiled: CompiledQuery): Promise<QueryResult<R>> {
      const query = { sql: compiled.sql, parameters: compiled.parameters };
      queries.push(query);
      const rows = (handler(query) ?? []) as R[];
      return { rows, numAffectedRows: BigInt(rows.length) };
    },
    // eslint-disable-next-line require-yield
    async *streamQuery() {
      throw new Error("stream non pris en charge");
    },
  };
  const db = new Kysely<Database>({
    dialect: {
      createAdapter: () => new PostgresAdapter(),
      createIntrospector: kysely => new PostgresIntrospector(kysely),
      createQueryCompiler: () => new PostgresQueryCompiler(),
      createDriver: () => ({
        init: async () => {},
        acquireConnection: async () => connection,
        beginTransaction: async () => {},
        commitTransaction: async () => {},
        rollbackTransaction: async () => {},
        releaseConnection: async () => {},
        destroy: async () => {},
      }),
    },
  });
  return { db, queries };
}
