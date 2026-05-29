import { spawn } from "bun";

/**
 * Exécute la commande de push d'Inagle pour synchroniser la base de données
 * Supabase avec les fichiers de données du jeu les plus récents.
 */
export async function runInaglePush(): Promise<{ success: boolean; error?: string }> {
  console.log("[Cron DB] Démarrage de la synchronisation Inagle avec la base de données...");
  try {
    const proc = spawn(["bun", "run", "--filter", "@rose-griffon/inagle", "push"], {
      cwd: "/home/ubuntu/rg",
      stdout: "inherit",
      stderr: "inherit",
    });

    const exitCode = await proc.exited;
    if (exitCode === 0) {
      console.log("[Cron DB] Synchronisation réussie.");
      return { success: true };
    } else {
      const errMsg = `Le push d'Inagle a échoué avec le code de sortie ${exitCode}`;
      console.error(`[Cron DB] ${errMsg}`);
      return { success: false, error: errMsg };
    }
  } catch (err: any) {
    console.error("[Cron DB] Erreur lors du push d'Inagle :", err);
    return { success: false, error: err.message || String(err) };
  }
}
