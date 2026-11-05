/**
 * UNE IMAGE DISTANTE EST-ELLE SERVIE EN CE MOMENT ?
 *
 * La une de `/news` pointait vers `cdn.rosegriffon.fr/dx11/...`, qui répond 502 :
 * le navigateur chargeait l'image, recevait l'erreur, puis `onError` ne posait le
 * visuel de repli qu'APRÈS l'hydratation de tout le JS de la page. L'élément LCP
 * naissait donc côté client, très tard (LCP mobile 14,5 à 52 s, audit du
 * 5/11/2026). Sondée au rendu, une image morte est remplacée dès le HTML.
 *
 * Contrairement à `sonderImage` (`dimensions.ts`), toute réponse non 2xx compte
 * ici, 5xx compris : pour choisir quoi peindre MAINTENANT, une panne passagère
 * vaut une absence. Elle n'est retenue que peu de temps, le succès plus longtemps.
 * Un délai dépassé laisse sa chance à l'image (on ne sait rien).
 */

/** Le sondage ne doit pas retenir le rendu. */
const DELAI_MS = 1500;
const DUREE_SUCCES_MS = 30 * 60_000;
const DUREE_ECHEC_MS = 2 * 60_000;
const MAX_ENTREES = 512;

const memoire = new Map<string, { servie: boolean; at: number }>();

type Recuperer = (url: string, init: RequestInit) => Promise<Response>;

export async function imageServie(
  url: string | null | undefined,
  { recuperer = fetch as Recuperer, delaiMs = DELAI_MS }: { recuperer?: Recuperer; delaiMs?: number } = {},
): Promise<boolean> {
  if (typeof url !== "string" || !/^https?:\/\//.test(url)) return true;
  const connue = memoire.get(url);
  if (connue && Date.now() - connue.at < (connue.servie ? DUREE_SUCCES_MS : DUREE_ECHEC_MS)) return connue.servie;

  let servie: boolean;
  try {
    const reponse = await recuperer(url, {
      headers: { Range: "bytes=0-0" },
      signal: AbortSignal.timeout(delaiMs),
    });
    servie = reponse.ok;
    void reponse.body?.cancel().catch(() => {});
  } catch {
    // Délai dépassé ou réseau : on ne conclut pas, et on ne mémorise pas.
    return true;
  }
  if (memoire.size >= MAX_ENTREES) memoire.delete(memoire.keys().next().value as string);
  memoire.set(url, { at: Date.now(), servie });
  return servie;
}

/** Remplace par `null` les URL d'image qui ne sont pas servies (sondées en parallèle). */
export async function sansImagesMortes<T extends { image?: string | null }>(elements: T[]): Promise<T[]> {
  const etats = await Promise.all(elements.map(e => imageServie(e.image)));
  return elements.map((e, i) => (etats[i] ? e : { ...e, image: null }));
}

/** Vide la mémoire (tests). */
export function viderDisponibilite(): void {
  memoire.clear();
}
