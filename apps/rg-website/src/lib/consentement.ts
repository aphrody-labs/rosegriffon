/**
 * Consentement aux traceurs (mesure d'audience GTM, publicité AdSense).
 *
 * Rien n'est chargé tant que le visiteur n'a pas choisi : sans choix enregistré,
 * les deux finalités valent « refusé ». Le choix est gardé 6 mois dans
 * `localStorage`, puis redemandé (recommandation CNIL). Le pied de page peut
 * rouvrir le bandeau à tout moment avec `ouvrirReglagesConsentement()`.
 */

export interface Consentement {
  mesure: boolean;
  pub: boolean;
  /** Date du choix, en millisecondes. */
  le: number;
}

const CLE = "rg-consentement";
const DUREE_MS = 182 * 24 * 60 * 60 * 1000;
export const EVENEMENT_CHANGE = "rg:consentement";
export const EVENEMENT_OUVRIR = "rg:consentement:ouvrir";

export function lireConsentement(maintenant = Date.now()): Consentement | null {
  try {
    const brut = localStorage.getItem(CLE);
    if (!brut) return null;
    const c = JSON.parse(brut) as Partial<Consentement>;
    if (
      typeof c.mesure !== "boolean" ||
      typeof c.pub !== "boolean" ||
      typeof c.le !== "number"
    )
      return null;
    if (maintenant - c.le > DUREE_MS) return null;
    return { mesure: c.mesure, pub: c.pub, le: c.le };
  } catch {
    return null;
  }
}

export function enregistrerConsentement(choix: {
  mesure: boolean;
  pub: boolean;
}): Consentement {
  const c = { ...choix, le: Date.now() };
  try {
    localStorage.setItem(CLE, JSON.stringify(c));
  } catch {
    // Stockage indisponible (navigation privée stricte) : le choix vaut pour la page.
  }
  dispatchEvent(new CustomEvent<Consentement>(EVENEMENT_CHANGE, { detail: c }));
  return c;
}

/**
 * Abonnement pour `useSyncExternalStore` : le choix change dans cet onglet
 * (événement maison) ou dans un autre (`storage`).
 */
export function abonnerConsentement(rappel: () => void) {
  addEventListener(EVENEMENT_CHANGE, rappel);
  addEventListener("storage", rappel);
  return () => {
    removeEventListener(EVENEMENT_CHANGE, rappel);
    removeEventListener("storage", rappel);
  };
}

let dernier: { brut: string | null; valeur: Consentement | null } | undefined;

/**
 * Instantané stable du consentement : même objet tant que la valeur stockée
 * ne change pas (exigence de `useSyncExternalStore`).
 */
export function instantaneConsentement(): Consentement | null {
  let brut: string | null = null;
  try {
    brut = localStorage.getItem(CLE);
  } catch {
    brut = null;
  }
  if (!dernier || dernier.brut !== brut)
    dernier = { brut, valeur: lireConsentement() };
  return dernier.valeur;
}

/** Côté serveur, le choix est inconnu : ni bandeau ni traceur au premier rendu. */
export const instantaneServeur = (): Consentement | null | undefined =>
  undefined;

export function ouvrirReglagesConsentement() {
  dispatchEvent(new Event(EVENEMENT_OUVRIR));
}

/** Signaux du mode consentement de Google (v2) pour un choix donné. */
export function signauxGoogle(c: Pick<Consentement, "mesure" | "pub"> | null) {
  const v = (ok: boolean | undefined) => (ok ? "granted" : "denied");
  return {
    analytics_storage: v(c?.mesure),
    ad_storage: v(c?.pub),
    ad_user_data: v(c?.pub),
    ad_personalization: v(c?.pub),
  } as const;
}
