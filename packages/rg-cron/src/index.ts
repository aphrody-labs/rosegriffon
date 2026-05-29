import { runInaglePush } from "./tasks/db";
import { syncCdnAssets } from "./tasks/cdn";
import { runIeCrawl } from "./tasks/ie-crawl";
import {
  triggerPublishScheduled,
  triggerPatreonRefresh,
  triggerPatreonReminders,
  warmCaches,
} from "./tasks/api";

console.log("==================================================================");
console.log("🚀 Initialisation du Daemon Cron Rose Griffon");
console.log(`⏰ Heure actuelle : ${new Date().toISOString()}`);
console.log("==================================================================");

// Permet d'exécuter manuellement une tâche via CLI (ex: `bun src/index.ts --run db`)
const args = process.argv.slice(2);
if (args.includes("--run")) {
  const taskIdx = args.indexOf("--run") + 1;
  const task = args[taskIdx];
  console.log(`🏃 Exécution manuelle de la tâche : ${task}`);

  if (task === "db") {
    await runInaglePush();
  } else if (task === "cdn") {
    await syncCdnAssets();
  } else if (task === "crawl") {
    await runIeCrawl();
  } else if (task === "publish") {
    await triggerPublishScheduled();
  } else if (task === "patreon") {
    await triggerPatreonRefresh();
  } else if (task === "reminders") {
    const stage = args[taskIdx + 1] || "announce";
    await triggerPatreonReminders(stage);
  } else if (task === "warm") {
    await warmCaches();
  } else if (task === "all") {
    console.log("🏃 Exécution de toutes les tâches...");
    await triggerPublishScheduled();
    await warmCaches();
    await runInaglePush();
    await triggerPatreonRefresh();
    await syncCdnAssets();
    await runIeCrawl();
    await triggerPatreonReminders("announce");
  } else {
    console.error(
      `❌ Tâche inconnue : ${task}. Choisissez parmi : db, cdn, crawl, publish, patreon, reminders, warm, all.`
    );
  }
  process.exit(0);
}

// 1. Publication programmée Azalée : toutes les 15 minutes
Bun.cron("*/15 * * * *", async () => {
  console.log(`[Cron] Exécution tâche: Publication programmée (${new Date().toISOString()})`);
  const result = await triggerPublishScheduled();
  if (!result.success) {
    console.error("[Cron] Échec publication programmée:", result.error);
  }
});

// 2. Pré-chauffage des caches ISR : toutes les 30 minutes
Bun.cron("*/30 * * * *", async () => {
  console.log(`[Cron] Exécution tâche: Pré-chauffage caches (${new Date().toISOString()})`);
  await warmCaches();
});

// 3. Synchronisation Inagle DB : tous les jours à 2h00 UTC
Bun.cron("0 2 * * *", async () => {
  console.log(`[Cron] Exécution tâche: Synchronisation Inagle DB (${new Date().toISOString()})`);
  const result = await runInaglePush();
  if (!result.success) {
    console.error("[Cron] Échec de la synchronisation Inagle DB:", result.error);
  }
});

// 4. Rafraîchissement Patreon Website : tous les jours à 3h00 UTC
Bun.cron("0 3 * * *", async () => {
  console.log(`[Cron] Exécution tâche: Rafraîchissement Patreon (${new Date().toISOString()})`);
  const result = await triggerPatreonRefresh();
  if (!result.success) {
    console.error("[Cron] Échec du rafraîchissement Patreon:", result.error);
  }
});

// 5. Synchronisation CDN : tous les jours à 4h00 UTC
Bun.cron("0 4 * * *", async () => {
  console.log(`[Cron] Exécution tâche: Synchronisation CDN (${new Date().toISOString()})`);
  const result = await syncCdnAssets();
  if (!result.success) {
    console.error("[Cron] Échec de la synchronisation CDN:", result.error);
  }
});

// 5b. Crawl officiel Inazuma Eleven (Zukan & Actus) : tous les jours à 5h00 UTC
Bun.cron("0 5 * * *", async () => {
  console.log(`[Cron] Exécution tâche: Crawl Inazuma Eleven (${new Date().toISOString()})`);
  const result = await runIeCrawl();
  if (!result.success) {
    console.error("[Cron] Échec du crawl Inazuma Eleven:", result.error);
  }
});

// 6. Rappels Patreon Website : tous les jours à 8h00 UTC
Bun.cron("0 8 * * *", async () => {
  console.log(`[Cron] Exécution tâche: Rappels Patreon (${new Date().toISOString()})`);
  const result = await triggerPatreonReminders("announce");
  if (!result.success) {
    console.error("[Cron] Échec des rappels Patreon:", result.error);
  }
});

console.log("✅ Toutes les tâches cron ont été enregistrées avec succès.");
console.log("💤 Le daemon est en cours d'exécution...");
