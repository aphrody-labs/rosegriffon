import { join } from "node:path";

/** Données générées par le cron, hors des releases immuables. */
export const CRON_SHARED_ROOT = process.env.RG_CRON_SHARED_ROOT ?? "/srv/rg/shared/cron";

export function cronSharedPath(...segments: string[]): string {
  return join(CRON_SHARED_ROOT, ...segments);
}

/**
 * Corpus écrits par `crawl` (sources officielles, Reddit, Discord).
 *
 * Ils allaient dans le dépôt `iecode` (`iecodeDataPath`), absent de l'hôte et en
 * lecture seule pour le service ; `DATA_PATH` ne peut pas servir d'aiguillage,
 * car le push d'Inagle y lit les fichiers du jeu.
 */
export function crawlDataPath(...segments: string[]): string {
  return join(process.env.RG_CRAWL_DATA_ROOT ?? cronSharedPath("ie-crawl"), ...segments);
}
