/**
 * @license
 * Copyright 2026 Rose Griffon
 * SPDX-License-Identifier: Apache-2.0
 */

import { runInaglePush } from "./tasks/db";
import { syncCdnAssets } from "./tasks/cdn";
import { runIeCrawl } from "./tasks/ie-crawl";
import { runRagSync, queryRag } from "./tasks/ie-crawl/rag";
import {
  triggerPublishScheduled,
  triggerPatreonRefresh,
  triggerPatreonReminders,
  warmCaches,
} from "./tasks/api";
import { ServerWebSocket } from "bun";
import { createSupabaseServiceClient } from "@rose-griffon/db/service";
import { resolveProfile, isAdmin } from "@rose-griffon/auth";

// ─── LOGGER GLOBALE INTERCEPTION ET STREAMING WEBSOCKET ──────────────────────
const wsConnections = new Set<ServerWebSocket<any>>();

const originalLog = console.log;
const originalError = console.error;
const originalWarn = console.warn;

function broadcastLog(level: "info" | "warn" | "error", message: string) {
  const payload = JSON.stringify({
    type: "log",
    level,
    text: message,
    timestamp: Date.now(),
  });
  for (const ws of wsConnections) {
    try {
      ws.send(payload);
    } catch {
      wsConnections.delete(ws);
    }
  }
}

console.log = function (message?: any, ...optionalParams: any[]) {
  const str = String(message) + (optionalParams.length ? " " + optionalParams.map(p => typeof p === 'object' ? JSON.stringify(p) : String(p)).join(" ") : "");
  originalLog(message, ...optionalParams);
  broadcastLog("info", str);
};

console.error = function (message?: any, ...optionalParams: any[]) {
  const str = String(message) + (optionalParams.length ? " " + optionalParams.map(p => typeof p === 'object' ? JSON.stringify(p) : String(p)).join(" ") : "");
  originalError(message, ...optionalParams);
  broadcastLog("error", str);
};

console.warn = function (message?: any, ...optionalParams: any[]) {
  const str = String(message) + (optionalParams.length ? " " + optionalParams.map(p => typeof p === 'object' ? JSON.stringify(p) : String(p)).join(" ") : "");
  originalWarn(message, ...optionalParams);
  broadcastLog("warn", str);
};

console.log("==================================================================");
console.log("🚀 Initialisation du Daemon Cron Rose Griffon (Mode Autonome)");
console.log(`⏰ Heure actuelle : ${new Date().toISOString()}`);
console.log("==================================================================");

// ─── METRICS & STATS D'EXÉCUTION ─────────────────────────────────────────────
const metrics = {
  startedAt: new Date().toISOString(),
  tasksTriggered: 0,
  tasksSucceeded: 0,
  tasksFailed: 0,
  lastExecution: {} as Record<string, { time: string; durationMs: number; success: boolean; error?: string }>
};

/**
 * Enveloppe l'exécution d'une tâche pour l'enregistrer dans les métriques et logger les durées.
 */
async function executeTask(name: string, fn: () => Promise<any>): Promise<{ success: boolean; error?: string }> {
  console.log(`[Cron Runner] Début de la tâche : ${name}`);
  metrics.tasksTriggered++;
  const start = Date.now();
  try {
    const res = await fn();
    const duration = Date.now() - start;
    const isSuccess = res && typeof res === "object" && "success" in res ? res.success : true;
    const errorMsg = res && typeof res === "object" && "error" in res ? res.error : undefined;

    if (isSuccess) {
      metrics.tasksSucceeded++;
      metrics.lastExecution[name] = { time: new Date().toISOString(), durationMs: duration, success: true };
      console.log(`[Cron Runner] Tâche complétée avec succès : ${name} en ${duration}ms`);
      return { success: true };
    } else {
      metrics.tasksFailed++;
      metrics.lastExecution[name] = { time: new Date().toISOString(), durationMs: duration, success: false, error: errorMsg };
      console.error(`[Cron Runner] Échec de la tâche : ${name} en ${duration}ms : ${errorMsg}`);
      return { success: false, error: errorMsg };
    }
  } catch (err: any) {
    const duration = Date.now() - start;
    const errorMsg = err.message || String(err);
    metrics.tasksFailed++;
    metrics.lastExecution[name] = { time: new Date().toISOString(), durationMs: duration, success: false, error: errorMsg };
    console.error(`[Cron Runner] Erreur critique lors de la tâche : ${name} en ${duration}ms :`, err);
    return { success: false, error: errorMsg };
  }
}

// ─── DIALOGUE CLI MANUEL ─────────────────────────────────────────────────────
const args = process.argv.slice(2);
if (args.includes("--run")) {
  const taskIdx = args.indexOf("--run") + 1;
  const task = args[taskIdx];
  console.log(`🏃 Exécution manuelle de la tâche : ${task}`);

  if (task === "db") {
    await executeTask("db", runInaglePush);
  } else if (task === "cdn") {
    await executeTask("cdn", syncCdnAssets);
  } else if (task === "crawl") {
    await executeTask("crawl", runIeCrawl);
  } else if (task === "rag") {
    await executeTask("rag", runRagSync);
  } else if (task === "query") {
    const question = args.slice(taskIdx + 1).join(" ");
    if (!question) {
      console.error("❌ Veuillez spécifier une question sémantique.");
    } else {
      const results = await queryRag(question);
      console.log(`\n🔍 Résultats RAG pour : "${question}"\n`);
      for (const res of results) {
        console.log(`[Score: ${res.score.toFixed(4)}] ${res.title} (${res.type})`);
        console.log(`URL: ${res.url}`);
        console.log(`Date: ${res.date}`);
        console.log(`Extrait: ${res.text.slice(0, 300)}...\n`);
        console.log("------------------------------------------------------------------");
      }
    }
  } else if (task === "publish") {
    await executeTask("publish", triggerPublishScheduled);
  } else if (task === "patreon") {
    await executeTask("patreon", triggerPatreonRefresh);
  } else if (task === "reminders") {
    const stage = args[taskIdx + 1] || "announce";
    await executeTask(`reminders:${stage}`, () => triggerPatreonReminders(stage));
  } else if (task === "warm") {
    await executeTask("warm", warmCaches);
  } else if (task === "all") {
    console.log("🏃 Exécution de toutes les tâches...");
    await executeTask("publish", triggerPublishScheduled);
    await executeTask("warm", warmCaches);
    await executeTask("db", runInaglePush);
    await executeTask("patreon", triggerPatreonRefresh);
    await executeTask("cdn", syncCdnAssets);
    await executeTask("crawl", runIeCrawl);
    await executeTask("reminders", () => triggerPatreonReminders("announce"));
  } else {
    console.error(
      `❌ Tâche inconnue : ${task}. Choisissez parmi : db, cdn, crawl, rag, query, publish, patreon, reminders, warm, all.`
    );
  }
  process.exit(0);
}

// ─── ENREGISTREMENT DES SGHEDULES CRON DE PRODUCTION (BUN.CRON) ───────────────

// 1. Publication programmée Azalée : toutes les 15 minutes
Bun.cron("*/15 * * * *", async () => {
  await executeTask("publish", triggerPublishScheduled);
});

// 2. Pré-chauffage des caches ISR : toutes les 30 minutes
Bun.cron("*/30 * * * *", async () => {
  await executeTask("warm", warmCaches);
});

// 3. Synchronisation Inagle DB : tous les jours à 2h00 UTC
Bun.cron("0 2 * * *", async () => {
  await executeTask("db", runInaglePush);
});

// 4. Rafraîchissement Patreon Website : tous les jours à 3h00 UTC
Bun.cron("0 3 * * *", async () => {
  await executeTask("patreon", triggerPatreonRefresh);
});

// 5. Synchronisation CDN : tous les jours à 4h00 UTC
Bun.cron("0 4 * * *", async () => {
  await executeTask("cdn", syncCdnAssets);
});

// 5b. Crawl officiel Inazuma Eleven & RAG Sync : tous les jours à 5h00 UTC
Bun.cron("0 5 * * *", async () => {
  await executeTask("crawl", runIeCrawl);
});

// 6. Rappels Patreon Website : tous les jours à 8h00 UTC
Bun.cron("0 8 * * *", async () => {
  await executeTask("reminders", () => triggerPatreonReminders("announce"));
});

console.log("✅ Toutes les tâches cron ont été planifiées avec succès.");

// ─── SERVEUR HTTP + WEBSOCKETS (BUN.SERVE) ───────────────────────────────────
const PORT = Number(process.env.CRON_PORT) || 3005;

const server = Bun.serve({
  port: PORT,
  async fetch(req, server) {
    const url = new URL(req.url);

    // 1. WebSocket upgrade
    if (url.pathname === "/ws") {
      const success = server.upgrade(req);
      if (success) return undefined;
      return new Response("Upgrade WebSocket échoué", { status: 400 });
    }

    // 2. Health check
    if (url.pathname === "/health") {
      return Response.json({
        status: "healthy",
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        time: new Date().toISOString(),
        wsConnections: wsConnections.size
      });
    }

    // 3. Prometheus / Custom Metrics
    if (url.pathname === "/metrics") {
      return Response.json(metrics);
    }

    // Helper pour extraire les cookies de la requête
    function getCookie(request: Request, name: string): string | null {
      const cookieHeader = request.headers.get("Cookie");
      if (!cookieHeader) return null;
      const cookies = cookieHeader.split(";");
      for (const cookie of cookies) {
        const [key, value] = cookie.trim().split("=");
        if (key === name) return value ? decodeURIComponent(value) : "";
      }
      return null;
    }

    // Sécurisation par CRON_SECRET ou authentification par Cookie Admin (Better Auth)
    const authHeader = req.headers.get("Authorization");
    const cronSecret = process.env.CRON_SECRET;
    let isAuthorized = false;

    // 1. Autorisation via Token d'automatisation
    if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
      isAuthorized = true;
    }

    // 2. Autorisation via Session Cookie Administrateur
    if (!isAuthorized) {
      const sessionToken = getCookie(req, "better-auth.session-token");
      if (sessionToken) {
        try {
          const supabase = createSupabaseServiceClient();
          const { data: session } = await supabase
            .from("session")
            .select("user_id, expires_at")
            .eq("token", sessionToken)
            .maybeSingle();

          if (session && new Date(session.expires_at) > new Date()) {
            const profile = await resolveProfile(supabase, { id: session.user_id });
            if (profile && isAdmin(profile.role)) {
              isAuthorized = true;
              console.log(`[Cron Auth] Accès autorisé pour l'administrateur : ${profile.username}`);
            }
          }
        } catch (authErr) {
          console.warn("[Cron Auth] Échec de l'authentification par session cookie :", authErr);
        }
      }
    }

    if (!isAuthorized) {
      return new Response("Non autorisé", { status: 401 });
    }

    // 4. Liste des tâches
    if (url.pathname === "/tasks" && req.method === "GET") {
      return Response.json({
        tasks: ["db", "cdn", "crawl", "rag", "publish", "patreon", "reminders", "warm"],
        schedules: {
          publish: "*/15 * * * *",
          warm: "*/30 * * * *",
          db: "0 2 * * *",
          patreon: "0 3 * * *",
          cdn: "0 4 * * *",
          crawl: "0 5 * * *",
          reminders: "0 8 * * *"
        }
      });
    }

    // 5. Déclenchement manuel d'une tâche à la demande
    if (url.pathname.startsWith("/tasks/") && url.pathname.endsWith("/run") && req.method === "POST") {
      const taskName = url.pathname.slice(7, -4);
      
      const runnerMap: Record<string, () => Promise<any>> = {
        db: runInaglePush,
        cdn: syncCdnAssets,
        crawl: runIeCrawl,
        rag: runRagSync,
        publish: triggerPublishScheduled,
        patreon: triggerPatreonRefresh,
        reminders: () => triggerPatreonReminders("announce"),
        warm: warmCaches
      };

      const taskFn = runnerMap[taskName];
      if (!taskFn) {
        return new Response(JSON.stringify({ error: `Tâche "${taskName}" inconnue.` }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
      }

      // Lancer la tâche en tâche de fond pour libérer la requête HTTP instantanément
      executeTask(taskName, taskFn);

      return Response.json({ success: true, message: `Tâche "${taskName}" démarrée en tâche de fond.` }, { status: 202 });
    }

    return new Response("Non trouvé", { status: 404 });
  },
  websocket: {
    open(ws) {
      wsConnections.add(ws);
      ws.send(JSON.stringify({ type: "system", text: "Connexion établie avec le flux de logs rg-cron." }));
    },
    message(ws, msg) {
      originalLog(`[WS Message] reçu : ${msg}`);
    },
    close(ws) {
      wsConnections.delete(ws);
    }
  }
});

console.log(`🌐 Serveur HTTP et WebSocket à l'écoute sur le port ${PORT}`);

// ─── SERVEUR TCP IPC LOCAL (BUN.LISTEN) ──────────────────────────────────────
const IPC_PORT = 4001;

Bun.listen({
  hostname: "127.0.0.1",
  port: IPC_PORT,
  socket: {
    async data(socket, data) {
      try {
        const payload = JSON.parse(data.toString());
        if (payload.cmd === "query_rag" && payload.question) {
          const results = await queryRag(payload.question);
          socket.write(JSON.stringify({ success: true, results }) + "\n");
        } else if (payload.cmd === "health") {
          socket.write(JSON.stringify({ success: true, uptime: process.uptime(), metrics }) + "\n");
        } else {
          socket.write(JSON.stringify({ success: false, error: "Commande inconnue" }) + "\n");
        }
      } catch (err: any) {
        socket.write(JSON.stringify({ success: false, error: err.message }) + "\n");
      }
    }
  }
});

console.log(`🔌 Serveur TCP IPC local à l'écoute sur le port ${IPC_PORT}`);
console.log("💤 Le daemon est en cours d'exécution et écoute...");
