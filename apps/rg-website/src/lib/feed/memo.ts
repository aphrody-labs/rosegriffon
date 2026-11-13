// SPDX-License-Identifier: Apache-2.0
// Cache mémoire court et dédoublonnage des appels simultanés, partagés par toutes les sources.
// Un appel identique pendant qu'un autre est en vol n'en fait qu'un ; en cas d'échec, une valeur
// légèrement périmée vaut mieux qu'une page vide.
//
// Périmée mais récente (moins de `PERIME_MAX_MS`), une valeur est rendue TOUT DE SUITE et relue
// en tâche de fond (stale-while-revalidate) : sans cela, chaque lecture après le TTL attendait la
// CLI X (12 à 52 s pour `/feed?reseau=x&compte=*`, audit du 5/11/2026). Le rythme des appels
// réels ne change pas : au plus une relecture par clé et par TTL.

const MAX_ENTREES = 256;
/** Au-delà, une valeur périmée n'est plus servie d'emblée (elle reste un repli en cas d'échec). */
export const PERIME_MAX_MS = 15 * 60_000;

const cache = new Map<string, { at: number; valeur: unknown }>();
const enCours = new Map<string, Promise<unknown>>();

function relire<T>(
  cle: string,
  produire: () => Promise<T>,
  repli?: { valeur: unknown },
): Promise<T> {
  const attente = enCours.get(cle);
  if (attente) return attente as Promise<T>;
  const p = produire()
    .then((valeur) => {
      cache.delete(cle);
      if (cache.size >= MAX_ENTREES)
        cache.delete(cache.keys().next().value as string);
      cache.set(cle, { at: Date.now(), valeur });
      return valeur;
    })
    .catch((erreur) => {
      if (repli) return repli.valeur as T;
      throw erreur;
    })
    .finally(() => enCours.delete(cle));
  enCours.set(cle, p);
  return p;
}

export async function memo<T>(
  cle: string,
  ttlMs: number,
  produire: () => Promise<T>,
): Promise<T> {
  const connue = cache.get(cle);
  const age = connue ? Date.now() - connue.at : Infinity;
  if (connue && age < ttlMs) return connue.valeur as T;
  if (connue && age < Math.max(ttlMs, PERIME_MAX_MS)) {
    // Relecture en tâche de fond ; son échec garde l'ancienne valeur.
    void relire(cle, produire, connue).catch(() => {});
    return connue.valeur as T;
  }
  return relire(cle, produire, connue);
}

/** Vide le cache (tests). */
export function viderMemo(): void {
  cache.clear();
  enCours.clear();
}

/** Borne la durée d'un appel : une source lente ne retient pas le fil entier. */
export function avecDelai<T>(
  promesse: Promise<T>,
  ms: number,
  etiquette: string,
): Promise<T> {
  let minuteur: ReturnType<typeof setTimeout>;
  const delai = new Promise<never>((_, rejeter) => {
    minuteur = setTimeout(
      () => rejeter(new Error(`${etiquette} : délai dépassé`)),
      ms,
    );
  });
  return Promise.race([promesse, delai]).finally(() => clearTimeout(minuteur));
}
