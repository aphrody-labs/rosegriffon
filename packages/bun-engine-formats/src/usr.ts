import { Database } from "bun:sqlite";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

/** Root containing tools installed for yolo-re (`bin`, `lib`, and provenance database). */
export function usrRoot(): string {
  const root = resolve(import.meta.dir, "..", "..", "..");
  return resolve(Bun.env.YOLO_RE_USR ?? join(root, "usr"));
}

export interface InstalledRelease {
  id: string;
  version: string;
  url: string;
  asset: string;
  sha256: string;
  exe: string;
  files: number;
  installedAt: string;
}

function openProvenanceDatabase(): Database | undefined {
  const path = join(usrRoot(), "var", "lib", "yolo-re-tools", "local.db");
  if (!existsSync(path)) return undefined;
  return new Database(path, { create: false, readonly: true, strict: true });
}

/** Reads an installed release record without creating files or changing the tool store. */
export async function installedRelease(id: string): Promise<InstalledRelease | undefined> {
  const database = openProvenanceDatabase();
  if (!database) return undefined;
  try {
    return database.query<InstalledRelease, [string]>("SELECT * FROM packages WHERE id = ?").get(id) ?? undefined;
  } finally {
    database.close();
  }
}

/** Lists yolo-re tool provenance records without creating files or changing the tool store. */
export async function listInstalled(): Promise<InstalledRelease[]> {
  const database = openProvenanceDatabase();
  if (!database) return [];
  try {
    return database.query<InstalledRelease, []>("SELECT * FROM packages ORDER BY id").all();
  } finally {
    database.close();
  }
}
