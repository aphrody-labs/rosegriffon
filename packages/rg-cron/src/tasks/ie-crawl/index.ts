/**
 * @license
 * Copyright 2026 Rose Griffon
 * SPDX-License-Identifier: Apache-2.0
 */

import { crawlZukanOrder } from "./zukan";
import { crawlNews } from "./news";
import { runRagSync } from "./rag";

export async function runIeCrawl(): Promise<{ success: boolean; error?: string }> {
  console.log("==================================================================");
  console.log("🏃 Démarrage du pipeline de Crawl Inazuma Eleven (ie-crawl)");
  console.log("==================================================================");

  try {
    // 1. Crawl de l'ordre officiel des personnages Zukan
    const zukanRes = await crawlZukanOrder();
    if (!zukanRes.success) {
      console.error("[ie-crawl] Échec du crawl Zukan :", zukanRes.error);
    } else {
      console.log(`[ie-crawl] Crawl Zukan complété : ${zukanRes.count} personnages analysés.`);
    }

    // 2. Crawl des actualités (Topics FR & Patch Notes EN)
    const newsRes = await crawlNews();
    if (!newsRes.success) {
      console.error("[ie-crawl] Échec du crawl des actualités :", newsRes.error);
    } else {
      console.log("[ie-crawl] Crawl des actualités complété.");
    }

    // 3. Synchronisation sémantique / vectorisation pour le RAG
    let ragSuccess = true;
    if (newsRes.success) {
      const ragRes = await runRagSync();
      ragSuccess = ragRes.success;
      if (!ragRes.success) {
        console.error("[ie-crawl] Échec de la synchronisation vectorielle RAG.");
      } else {
        console.log(`[ie-crawl] RAG Sync complété : ${ragRes.processed} nouveaux documents indexés.`);
      }
    }

    const success = (zukanRes.success && newsRes.success && ragSuccess);
    return {
      success,
      error: success ? undefined : "Certaines tâches de crawl ou RAG ont échoué."
    };
  } catch (err: any) {
    console.error("[ie-crawl] Erreur critique lors de l'exécution du crawl :", err);
    return { success: false, error: err.message || String(err) };
  }
}

