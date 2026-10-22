/**
 * Copyright 2026 Rose Griffon
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * `achillea:interclans` — entretien des interclans, toutes les 15 minutes.
 *
 * L'API unifiée possède les règles (`apps/rg-bot/src/api/modules/achillea/interclans`) ;
 * cette tâche ne fait que lui demander l'entretien par sa route interne
 * `POST /interclans/internal/maintenance` (jeton `API_ADMIN_TOKEN`) :
 *
 *  - un défi resté 24 h sans réponse est annulé, le clan challenger prévenu
 *    (l'ancien bot affichait « Expire le » sans jamais rien expirer) ;
 *  - un vote de validation des scores arrivé à échéance est conclu « expiré » :
 *    l'interclan n'est pas pris en compte, comme dans l'ancien bot
 *    (`InterclanResultsValidationVoteHandler.handleExpiredProposal`).
 */
import { baseApiInterne } from "./achillea-tournois-phases.js";

export interface ResultatInterclans {
  success: true;
  defisExpires: number;
  votesExpires: number;
}

export async function runAchilleaInterclans(
  maintenant: Date = new Date(),
  env: Record<string, string | undefined> = Bun.env,
  fetcher: typeof fetch = fetch,
): Promise<ResultatInterclans> {
  const jeton = (env.API_ADMIN_TOKEN ?? "").trim();
  if (!jeton) throw new Error("API_ADMIN_TOKEN absent : l'entretien des interclans ne peut pas être demandé à l'API.");
  const reponse = await fetcher(`${baseApiInterne(env)}/interclans/internal/maintenance`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: `Bearer ${jeton}` },
    body: JSON.stringify({ now: maintenant.toISOString() }),
    signal: AbortSignal.timeout(60_000),
  });
  const corps = (await reponse.json().catch(() => null)) as {
    defisExpires?: number;
    votesExpires?: number;
    message?: string;
  } | null;
  if (!reponse.ok) throw new Error(corps?.message ?? `API des interclans : HTTP ${reponse.status}`);
  const resultat: ResultatInterclans = {
    success: true,
    defisExpires: Number(corps?.defisExpires ?? 0),
    votesExpires: Number(corps?.votesExpires ?? 0),
  };
  if (resultat.defisExpires > 0 || resultat.votesExpires > 0)
    console.info(
      `[achillea:interclans] ${resultat.defisExpires} défi(s) expiré(s), ${resultat.votesExpires} vote(s) de validation clos.`,
    );
  return resultat;
}
