/**
 * @license
 * Copyright 2026 Rose Griffon
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Tâche `crawl` — veille des sources officielles Inazuma Eleven. MANUELLE.
 *
 * Pipeline historique rebranché sur les API natives du runtime : `Bun.WebView`
 * pour les sites rendus en JavaScript (zukan, inazuma.jp, LEVEL-5), `fetch` pour
 * les documents bruts. Les corpus vont sous `RG_CRON_SHARED_ROOT/ie-crawl`.
 *
 * Retirés de l'ancien pipeline, volontairement :
 *  - les récoltes X (timeline, radar, recherche) : elles consomment des quotas X
 *    qui ne se remboursent pas et ont leurs propres tâches (`x`, `x-search`,
 *    `x:campagnes`) ;
 *  - le tweet d'annonce de fin de crawl : une publication publique ne part pas
 *    d'une veille ;
 *  - la vectorisation RAG : son module (`rag-index`) n'existe plus.
 *
 * Le succès dépend des deux sources critiques, comme avant : l'ordre zukan
 * (qui écrit `inagle_characters`) et les actualités. Les autres étapes sont
 * consignées une par une sans faire échouer la veille.
 */

import { crawlCross } from "./cross";
import { crawlDiscord } from "./discord";
import { crawlExternalDocs } from "./external-docs";
import { crawlLevel5 } from "./level5";
import { crawlLevel5Blog } from "./level5-blog";
import { crawlNews } from "./news";
import { crawlRe } from "./re";
import { crawlReddit } from "./reddit";
import { crawlZukanOrder } from "./zukan";

interface ResultatEtape {
  success: boolean;
  error?: string;
  count?: number;
}

export interface ResultatCrawl {
  success: boolean;
  error?: string;
  stats: Record<string, string>;
}

/** Étapes dans l'ordre d'exécution ; `critique` décide du succès de la tâche. */
const ETAPES: readonly {
  nom: string;
  critique: boolean;
  lancer: () => Promise<ResultatEtape>;
}[] = [
  { nom: "zukan", critique: true, lancer: crawlZukanOrder },
  { nom: "news", critique: true, lancer: crawlNews },
  { nom: "re", critique: false, lancer: crawlRe },
  { nom: "cross", critique: false, lancer: crawlCross },
  { nom: "level5", critique: false, lancer: crawlLevel5 },
  { nom: "level5-blog", critique: false, lancer: crawlLevel5Blog },
  { nom: "external-docs", critique: false, lancer: crawlExternalDocs },
  { nom: "reddit", critique: false, lancer: crawlReddit },
  { nom: "discord", critique: false, lancer: crawlDiscord },
];

export async function runIeCrawl(): Promise<ResultatCrawl> {
  console.log("[ie-crawl] Démarrage de la veille des sources officielles.");
  const stats: Record<string, string> = {};
  const echecsCritiques: string[] = [];

  for (const etape of ETAPES) {
    let resultat: ResultatEtape;
    try {
      resultat = await etape.lancer();
    } catch (err) {
      resultat = {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
    const detail = resultat.success
      ? `ok${resultat.count === undefined ? "" : ` (${resultat.count})`}`
      : `échec : ${resultat.error ?? "inconnu"}`;
    stats[etape.nom] = detail;
    console.log(`[ie-crawl] ${etape.nom} : ${detail}`);
    if (!resultat.success && etape.critique) echecsCritiques.push(`${etape.nom} (${resultat.error ?? "inconnu"})`);
  }

  return echecsCritiques.length === 0
    ? { success: true, stats }
    : {
        success: false,
        error: `Étapes critiques en échec : ${echecsCritiques.join(", ")}`,
        stats,
      };
}
