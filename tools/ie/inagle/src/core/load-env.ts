import { existsSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";

/** Charge un fichier .env sans ecraser les variables deja definies (remplace dotenv). */
export function loadEnvFile(file: string): void {
  if (!existsSync(file)) return;
  for (const [key, value] of Object.entries(parseEnv(readFileSync(file, "utf8")))) {
    if (process.env[key] === undefined) process.env[key] = value;
  }
}
