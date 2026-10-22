/**
 * Copyright 2026 Rose Griffon
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * `achillea:votes` — clôture des votes Achilléa échus, toutes les 10 minutes.
 *
 * L'ancien bot n'évaluait une proposition qu'au clic suivant : un vote de
 * fondation que personne ne touchait restait « en attente » pour toujours,
 * avec son salon, son rôle et son émoji sur le serveur central. L'API possède
 * la règle (`apps/rg-bot/src/api/modules/achillea/clans/cycle-service.ts`,
 * `expirerVotes`) ; cette tâche ne fait que la déclencher par la route interne
 * `POST /clans/internal/votes/expire` (jeton `API_ADMIN_TOKEN`).
 *
 * Les votes de validation d'interclan n'en font pas partie : `achillea:interclans`
 * les conclut.
 */
import { baseApiInterne } from "./achillea-tournois-phases.js";

export interface ResultatVotes {
  success: true;
  closes: number;
}

export async function runAchilleaVotes(
  maintenant: Date = new Date(),
  env: Record<string, string | undefined> = Bun.env,
  fetcher: typeof fetch = fetch,
): Promise<ResultatVotes> {
  const jeton = (env.API_ADMIN_TOKEN ?? "").trim();
  if (!jeton) throw new Error("API_ADMIN_TOKEN absent : la clôture des votes ne peut pas être demandée à l'API.");
  const reponse = await fetcher(`${baseApiInterne(env)}/clans/internal/votes/expire`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: `Bearer ${jeton}` },
    body: JSON.stringify({ now: maintenant.toISOString() }),
    signal: AbortSignal.timeout(60_000),
  });
  const corps = (await reponse.json().catch(() => null)) as { closes?: number; message?: string } | null;
  if (!reponse.ok) throw new Error(corps?.message ?? `API des votes : HTTP ${reponse.status}`);
  const resultat: ResultatVotes = { success: true, closes: Number(corps?.closes ?? 0) };
  if (resultat.closes > 0) console.info(`[achillea:votes] ${resultat.closes} vote(s) échu(s) clos.`);
  return resultat;
}
