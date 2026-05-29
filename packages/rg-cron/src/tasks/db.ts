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
  } catch (err: any) {
    console.error("[Cron DB] Erreur lors du push d'Inagle :", err);
    return { success: false, error: err.message || String(err) };
  }
}
