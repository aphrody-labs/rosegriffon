/**
 * Rappels de cast Achilléa (J-2 et H-2), comme le `CastReminders` de l'ancien bot.
 *
 * La logique vit dans l'API (`POST /v1/achillea/casts/reminders/dispatch`) : c'est
 * elle qui connaît les attributions, envoie les MP aux casters et le récapitulatif
 * au staff, et marque chaque rappel envoyé pour ne jamais le doubler. Cette tâche ne
 * fait que la déclencher à intervalle régulier, avec le secret interne partagé.
 */

export interface ResultatRappelsCasts {
  success: boolean;
  j2?: unknown;
  h2?: unknown;
  error?: string;
}

/** Origine de l'API unifiée : le port de `rg-core` en boucle locale par défaut. */
export function origineApiInterne(env: Record<string, string | undefined> = Bun.env): string {
  const explicite = (env.RG_API_INTERNAL_URL ?? "").trim();
  if (explicite !== "") return explicite.replace(/\/+$/, "");
  return `http://127.0.0.1:${env.RG_CORE_PORT ?? "8810"}`;
}

export async function runAchilleaCastReminders(
  env: Record<string, string | undefined> = Bun.env,
): Promise<ResultatRappelsCasts> {
  const secret = (env.RANKED_INTERNAL_SECRET ?? "").trim();
  if (secret === "") {
    return { success: false, error: "RANKED_INTERNAL_SECRET absent : l'API refuserait le déclenchement des rappels." };
  }
  try {
    const reponse = await fetch(`${origineApiInterne(env)}/v1/achillea/casts/reminders/dispatch`, {
      method: "POST",
      headers: { "x-internal-secret": secret },
      signal: AbortSignal.timeout(120_000),
    });
    if (!reponse.ok) {
      return { success: false, error: `API ${reponse.status} : ${(await reponse.text()).slice(0, 300)}` };
    }
    const rapport = (await reponse.json()) as { j2: unknown; h2: unknown };
    return { success: true, j2: rapport.j2, h2: rapport.h2 };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}
