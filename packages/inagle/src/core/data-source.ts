import {
  getInagleDatabaseURL,
  isInagleDatabaseConfigured,
} from "@rosegriffon/db/pg";
import { resolveMirrorSqlitePath } from "@rosegriffon/db/sqlite";

export type InagleDataSource = "vfs" | "sqlite" | "postgres";
export type InagleDataSourceOption = InagleDataSource | "auto";

export function configuredDataSource(): string | undefined {
  return process.env.NIE_DATA_SOURCE ?? process.env.INAGLE_DATA_SOURCE;
}

export function ownedPostgresUrl(): string {
  try {
    return getInagleDatabaseURL();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("must identify")) {
      throw new Error(
        "INAGLE_DATABASE_URL must identify an IECODE PostgreSQL host and database",
      );
    }
    throw new Error(
      "INAGLE_DATABASE_URL is required for the selected IECODE PostgreSQL source",
    );
  }
}

export function localMirrorPath(): string | undefined {
  return (
    resolveMirrorSqlitePath({
      envVars: ["NIE_WIKI_DB", "NIE_MIRROR_DB"],
      requireNonEmptyFile: true,
      strictExplicit: true,
    }) ?? undefined
  );
}

/** Whether the Neon gameplay database (INAGLE_DATABASE_URL or its alias NIE_PG_URL) is configured. */
export function postgresConfigured(): boolean {
  return isInagleDatabaseConfigured();
}

/**
 * `auto` prefers the Neon gameplay database when it is configured, then a local SQLite mirror
 * (offline development), then the native VFS.
 */
export function selectDataSource(options: {
  explicit?: string;
  sqliteAvailable?: boolean;
  postgresAvailable?: boolean;
  postgresDisabled?: boolean;
}): InagleDataSource {
  const explicit = options.explicit?.trim() || "auto";
  if (!["auto", "vfs", "sqlite", "postgres"].includes(explicit))
    throw new Error("INAGLE_DATA_SOURCE must be auto, vfs, sqlite or postgres");
  if (explicit === "postgres" && options.postgresDisabled)
    throw new Error(
      "PostgreSQL was selected but IEVR_CFGBIN_POSTGRES=0 disables it",
    );
  if (explicit !== "auto") return explicit as InagleDataSource;
  if (options.postgresAvailable && !options.postgresDisabled) return "postgres";
  return options.sqliteAvailable ? "sqlite" : "vfs";
}
