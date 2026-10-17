// SPDX-License-Identifier: Apache-2.0
// Cache mémoire court et dédoublonnage des appels simultanés, partagés par toutes les sources.
// Un appel identique pendant qu'un autre est en vol n'en fait qu'un ; en cas d'échec, une valeur
// légèrement périmée vaut mieux qu'une page vide.

const MAX_ENTREES = 256;

const cache = new Map<string, { at: number; valeur: unknown }>();
const enCours = new Map<string, Promise<unknown>>();

export async function memo<T>(cle: string, ttlMs: number, produire: () => Promise<T>): Promise<T> {
  const frais = cache.get(cle);
  if (frais && Date.now() - frais.at < ttlMs) return frais.valeur as T;
  const attente = enCours.get(cle);
  if (attente) return attente as Promise<T>;
  const p = produire()
    .then(valeur => {
      if (cache.size >= MAX_ENTREES) cache.delete(cache.keys().next().value as string);
      cache.set(cle, { at: Date.now(), valeur });
      return valeur;
    })
    .catch(erreur => {
      if (frais) return frais.valeur as T;
      throw erreur;
    })
    .finally(() => enCours.delete(cle));
  enCours.set(cle, p);
  return p;
}

/** Borne la durée d'un appel : une source lente ne retient pas le fil entier. */
export function avecDelai<T>(promesse: Promise<T>, ms: number, etiquette: string): Promise<T> {
  let minuteur: ReturnType<typeof setTimeout>;
  const delai = new Promise<never>((_, rejeter) => {
    minuteur = setTimeout(() => rejeter(new Error(`${etiquette} : délai dépassé`)), ms);
  });
  return Promise.race([promesse, delai]).finally(() => clearTimeout(minuteur));
}
