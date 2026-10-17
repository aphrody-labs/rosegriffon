/**
 * Sondes HTTP bornées : code de réponse réel d'une liste d'URL.
 *
 * `executerBorne` est pur (testable sans réseau) ; `sonder` y ajoute le fetch,
 * un délai court et un cache mémoire de 60 s partagé entre les rendus.
 */

export interface ResultatSonde {
  url: string;
  /** `null` : aucune réponse (délai ou erreur réseau). */
  statut: number | null;
  dureeMs: number;
  erreur: string | null;
}

/** Applique `fn` à chaque élément avec au plus `limite` appels simultanés, ordre conservé. */
export async function executerBorne<T, R>(items: readonly T[], limite: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const resultats = new Array<R>(items.length);
  let suivant = 0;
  const ouvriers = Array.from({ length: Math.max(1, Math.min(limite, items.length)) }, async () => {
    while (true) {
      const indice = suivant++;
      if (indice >= items.length) return;
      resultats[indice] = await fn(items[indice]!);
    }
  });
  await Promise.all(ouvriers);
  return resultats;
}

const DUREE_CACHE_MS = 60_000;
const DELAI_MS = 4_000;
const cache = new Map<string, { instant: number; valeur: ResultatSonde }>();

async function sonderUne(url: string, init: RequestInit): Promise<ResultatSonde> {
  const debut = performance.now();
  try {
    const reponse = await fetch(url, {
      ...init,
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(DELAI_MS),
    });
    void reponse.body?.cancel();
    return { url, statut: reponse.status, dureeMs: Math.round(performance.now() - debut), erreur: null };
  } catch (erreur) {
    return {
      url,
      statut: null,
      dureeMs: Math.round(performance.now() - debut),
      erreur: erreur instanceof Error && erreur.name === "TimeoutError" ? `aucune réponse en ${DELAI_MS} ms` : "injoignable",
    };
  }
}

/** Sonde des URL (GET, redirections non suivies : un 301 est un 301), 4 en parallèle, cache 60 s. */
export async function sonder(urls: readonly string[], init: RequestInit = {}): Promise<ResultatSonde[]> {
  const maintenant = Date.now();
  return executerBorne(urls, 4, async url => {
    const memo = cache.get(url);
    if (memo && maintenant - memo.instant < DUREE_CACHE_MS) return memo.valeur;
    const valeur = await sonderUne(url, init);
    cache.set(url, { instant: Date.now(), valeur });
    return valeur;
  });
}

/** Une réponse de santé : 2xx. Les redirections et erreurs ne comptent pas. */
export function estSain(statut: number | null): boolean {
  return statut !== null && statut >= 200 && statut < 300;
}
