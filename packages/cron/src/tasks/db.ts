import { $ } from "bun";

/**
 * Exécute la commande de push d'Inagle pour synchroniser la base de données
 * Supabase avec les fichiers de données du jeu les plus récents.
 */
export async function runInaglePush(): Promise<{ success: boolean; error?: string }> {
  console.log("[Cron DB] Démarrage de la synchronisation Inagle avec la base de données...");
  try {
    // Utilise Bun Shell pour exécuter le push dans le bon dossier
    await $`bun run --filter @rose-griffon/inagle push`.cwd("/home/ubuntu/rg");
    console.log("[Cron DB] Synchronisation réussie.");
    return { success: true };
  } catch (err: unknown) {
    console.error("[Cron DB] Erreur lors du push d'Inagle :", err);
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Génère une sauvegarde SQLite locale optimisée depuis la base Supabase.
 */
export async function runSQLiteBackup(): Promise<{ success: boolean; error?: string }> {
  console.log("[Cron DB] Démarrage de la sauvegarde Supabase vers SQLite local...");
  try {
    await $`bun run --filter @rose-griffon/azalee backup:supabase`.cwd("/home/ubuntu/rg");
    console.log("[Cron DB] Sauvegarde SQLite réussie.");
    return { success: true };
  } catch (err: unknown) {
    console.error("[Cron DB] Erreur lors de la sauvegarde SQLite :", err);
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Exécute le script de sauvegarde logique de la base PostgreSQL Supabase.
 */
export async function runPostgresBackup(): Promise<{ success: boolean; error?: string }> {
  console.log("[Cron DB] Démarrage de la sauvegarde PostgreSQL logique...");
  try {
    await $`bash scripts/ops/backup-postgres.sh`.cwd("/home/ubuntu/rg");
    console.log("[Cron DB] Sauvegarde PostgreSQL réussie.");
    return { success: true };
  } catch (err: unknown) {
    console.error("[Cron DB] Erreur lors de la sauvegarde PostgreSQL :", err);
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}


