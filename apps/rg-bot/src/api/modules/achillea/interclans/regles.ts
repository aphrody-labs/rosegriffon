/**
 * Règles pures des interclans — sans base, sans réseau, sans horloge implicite.
 *
 * Port de l'entité `Interclan` (`isReady`, `canLockIn`, `canBeStarted`,
 * `areAllMatchesFinished`), du dépôt (`computeInterclanResult`, appariements
 * de `generateInterclanLobbies`) et des contrôles de la commande
 * `/interclan request` (`isValidFutureDate`, `checkInterclanConflict`) et du
 * gestionnaire de composition (`validateTuples`, `updateLineup`).
 *
 * Tout ce qui décide d'un refus vit ici, pour être couvert par `bun:test` sans
 * fixture Postgres. `service.ts` ne fait que lire, appeler ces règles et écrire.
 */

/** États d'un interclan (`InterclanState` du contrat, valeurs numériques stockées dans `event.state`). */
export const ETAT = {
  EN_ATTENTE: 0,
  ACCEPTE: 1,
  REFUSE: 2,
  PRET: 3,
  EN_COURS: 4,
  TERMINE: 5,
  ANNULE: 6,
  RESULTAT_VALIDE: 7,
  RESULTAT_CONTESTE: 8,
} as const;
export type EtatInterclan = (typeof ETAT)[keyof typeof ETAT];

export const LIBELLES_ETAT: Readonly<Record<number, string>> = Object.freeze({
  [ETAT.EN_ATTENTE]: "⏳ En attente de réponse",
  [ETAT.ACCEPTE]: "🟢 Accepté",
  [ETAT.REFUSE]: "⛔ Refusé",
  [ETAT.PRET]: "🔒 Compositions verrouillées",
  [ETAT.EN_COURS]: "⚽ En cours",
  [ETAT.TERMINE]: "🏁 Terminé",
  [ETAT.ANNULE]: "❌ Annulé",
  [ETAT.RESULTAT_VALIDE]: "✅ Résultat validé",
  [ETAT.RESULTAT_CONTESTE]: "⚠️ Résultat contesté",
});

/** Rôles de clan (`ClanMemberRole`). */
export const ROLE_CLAN = { ESSAI: 0, MEMBRE: 1, VICE_PRESIDENT: 2, PRESIDENT: 3 } as const;

/** Taille exacte d'une composition valide (legacy `isValidLineup`). */
export const TAILLE_COMPOSITION = 5;
/** Délai maximal entre la proposition et la rencontre. */
export const HORIZON_MS = 7 * 24 * 60 * 60 * 1000;
/** Deux interclans d'un même clan doivent être espacés d'au moins 8 h. */
export const ECART_MIN_MS = 8 * 60 * 60 * 1000;
/** Le défi expire 24 h après sa proposition (date affichée par le legacy). */
export const EXPIRATION_DEFI_MS = 24 * 60 * 60 * 1000;
/** Verrouillage possible dans l'heure qui précède la rencontre. */
export const FENETRE_VERROU_MS = 60 * 60 * 1000;
/** Lancement toléré jusqu'à 4 h après l'heure prévue. */
export const TOLERANCE_LANCEMENT_MS = 4 * 60 * 60 * 1000;
/** Durée du vote de validation des résultats. */
export const DUREE_VOTE_MS = 24 * 60 * 60 * 1000;
/** États qui occupent l'agenda d'un clan (legacy `checkInterclanConflict`). */
export const ETATS_ACTIFS: readonly number[] = [ETAT.ACCEPTE, ETAT.EN_ATTENTE, ETAT.EN_COURS, ETAT.PRET];
/** États où l'on peut encore annuler. */
export const ETATS_ANNULABLES: readonly number[] = [ETAT.ACCEPTE, ETAT.PRET];

export type Refus = { ok: false; statut: 400 | 403 | 404 | 409; message: string };
export type Verdict<T = true> = { ok: true; valeur: T } | Refus;

export const refuser = (statut: Refus["statut"], message: string): Refus => ({ ok: false, statut, message });
const accepter = <T>(valeur: T): Verdict<T> => ({ ok: true, valeur });

// ─── Dates ──────────────────────────────────────────────────────────────────

/** Décalage (ms) de l'heure de Paris à l'instant donné : +1 h l'hiver, +2 h l'été. */
export function decalageParis(instant: number): number {
  const parties = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Paris",
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(instant));
  const valeur = (type: string) => Number(parties.find(p => p.type === type)?.value ?? 0);
  const commeUtc = Date.UTC(valeur("year"), valeur("month") - 1, valeur("day"), valeur("hour"), valeur("minute"), valeur("second"));
  return commeUtc - Math.floor(instant / 1000) * 1000;
}

/** Instant UTC d'une heure murale de Paris (heure d'été gérée). `null` si la date n'existe pas. */
export function instantParis(annee: number, mois: number, jour: number, heure: number, minute: number): number | null {
  if (mois < 1 || mois > 12 || jour < 1 || jour > 31 || heure > 23 || minute > 59) return null;
  const naif = Date.UTC(annee, mois - 1, jour, heure, minute);
  const verif = new Date(naif);
  if (verif.getUTCMonth() !== mois - 1 || verif.getUTCDate() !== jour) return null;
  // Deux passes : le décalage dépend de l'instant qu'on cherche.
  let instant = naif - decalageParis(naif);
  instant = naif - decalageParis(instant);
  return instant;
}

/**
 * Lit la date d'un défi : « JJ/MM HH:MM » en heure de Paris (la saisie
 * Discord historique) ou une date ISO 8601 (site, CLI).
 *
 * « JJ/MM » déjà passé dans l'année est reporté à l'année suivante (saisie
 * fin décembre pour janvier). Le résultat doit tomber dans les 7 jours.
 */
export function lireDateDefi(saisie: string, maintenant: number): Verdict<Date> {
  const texte = saisie.trim();
  let instant: number | null;
  const jjmm = /^(\d{1,2})\/(\d{1,2})\s+(\d{1,2})[:h](\d{2})$/u.exec(texte);
  if (jjmm) {
    const [, j, m, h, min] = jjmm.map(Number) as [number, number, number, number, number];
    const anneeParis = new Date(maintenant + decalageParis(maintenant)).getUTCFullYear();
    instant = instantParis(anneeParis, m, j, h, min);
    if (instant === null) return refuser(400, `La date ${texte} est invalide.`);
    if (instant < maintenant) instant = instantParis(anneeParis + 1, m, j, h, min);
    if (instant === null) return refuser(400, `La date ${texte} est invalide.`);
  } else if (/^\d{4}-\d{2}-\d{2}T/u.test(texte)) {
    instant = Date.parse(texte);
    if (Number.isNaN(instant)) return refuser(400, `La date ${texte} est invalide.`);
  } else {
    return refuser(400, `Le format de la date ${texte} est invalide (attendu : JJ/MM HH:MM).`);
  }
  if (instant <= maintenant || instant > maintenant + HORIZON_MS)
    return refuser(400, "La date doit être au plus 7 jours dans le futur.");
  return accepter(new Date(instant));
}

/** Interclan déjà prévu à moins de 8 h pour l'un des deux clans → l'identifiant du clan en conflit. */
export function clanEnConflit(
  clanA: number,
  clanB: number,
  voulu: Date,
  existants: ReadonlyArray<{ clanA: number; clanB: number; date: Date; etat: number }>,
): number | null {
  for (const ic of existants) {
    if (!ETATS_ACTIFS.includes(ic.etat)) continue;
    if (Math.abs(ic.date.getTime() - voulu.getTime()) >= ECART_MIN_MS) continue;
    if (ic.clanA === clanA || ic.clanB === clanA) return clanA;
    if (ic.clanA === clanB || ic.clanB === clanB) return clanB;
  }
  return null;
}

// ─── Fenêtres ───────────────────────────────────────────────────────────────

/** Verrouillage permis dans l'heure qui précède la rencontre (legacy `canLockIn`). */
export function peutVerrouiller(dateRencontre: Date, maintenant: number): boolean {
  const debut = dateRencontre.getTime();
  return maintenant >= debut - FENETRE_VERROU_MS && maintenant <= debut;
}

/** Lancement permis de l'heure prévue à +4 h (legacy `canBeStarted`). */
export function peutLancer(dateRencontre: Date, maintenant: number): boolean {
  const debut = dateRencontre.getTime();
  return maintenant >= debut && maintenant <= debut + TOLERANCE_LANCEMENT_MS;
}

/** Le défi a-t-il expiré sans réponse ? */
export function defiExpire(creeLe: Date, maintenant: number): boolean {
  return maintenant > creeLe.getTime() + EXPIRATION_DEFI_MS;
}

// ─── Compositions ───────────────────────────────────────────────────────────

export interface Placement {
  userId: string;
  position: number;
}

/**
 * Valide une composition saisie : au plus 5 joueurs, positions 1 à 5 uniques,
 * aucun doublon, tous membres du clan (legacy `validateTuples` + `updateLineup`).
 */
export function validerComposition(
  placements: readonly Placement[],
  membresDuClan: ReadonlySet<string>,
  verrouillee: boolean,
): Verdict<Placement[]> {
  if (verrouillee) return refuser(409, "Cette lineup est déjà verrouillée et immuable.");
  if (placements.length > TAILLE_COMPOSITION)
    return refuser(400, `La lineup ne peut contenir que ${TAILLE_COMPOSITION} joueurs au maximum.`);
  const ids = placements.map(p => p.userId.trim());
  const doublons = [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))];
  if (doublons.length > 0) return refuser(400, `Les joueurs suivants apparaissent plusieurs fois : ${doublons.join(", ")}`);
  const positions = placements.map(p => p.position);
  if (positions.some(p => !Number.isInteger(p) || p < 1 || p > TAILLE_COMPOSITION))
    return refuser(400, `Les positions vont de 1 à ${TAILLE_COMPOSITION}.`);
  if (new Set(positions).size !== positions.length) return refuser(400, "Deux joueurs occupent la même position.");
  const intrus = ids.filter(id => !membresDuClan.has(id));
  if (intrus.length > 0) return refuser(400, `Les IDs suivants ne sont pas des membres du clan : ${intrus.join(", ")}`);
  return accepter(placements.map(p => ({ userId: p.userId.trim(), position: p.position })).toSorted((a, b) => a.position - b.position));
}

/** Composition complète (exactement 5 joueurs, legacy `isValidLineup`). */
export function compositionValide(nombreJoueurs: number): boolean {
  return nombreJoueurs === TAILLE_COMPOSITION;
}

/** Les deux compositions sont valides ET verrouillées (legacy `isReady`). */
export function estPret(lineups: ReadonlyArray<{ verrouillee: boolean; joueurs: number }>): boolean {
  return lineups.length === 2 && lineups.every(l => l.verrouillee && compositionValide(l.joueurs));
}

/** Appariements position contre position (legacy `generateInterclanLobbies`). */
export function apparier(a: readonly Placement[], b: readonly Placement[]): Array<{ joueurA: string; joueurB: string }> {
  const triA = a.toSorted((x, y) => x.position - y.position);
  const triB = b.toSorted((x, y) => x.position - y.position);
  const n = Math.min(triA.length, triB.length);
  return Array.from({ length: n }, (_, i) => ({ joueurA: triA[i]!.userId, joueurB: triB[i]!.userId }));
}

// ─── Résultats ──────────────────────────────────────────────────────────────

/** Score d'un match saisi : deux entiers de 0 à 99. */
export function validerScore(scoreA: number, scoreB: number): Verdict<{ scoreA: number; scoreB: number }> {
  const ok = (s: number) => Number.isInteger(s) && s >= 0 && s <= 99;
  if (!ok(scoreA) || !ok(scoreB)) return refuser(400, "Les scores doivent être des nombres positifs.");
  return accepter({ scoreA, scoreB });
}

/**
 * Vainqueur d'après les matchs (legacy `computeInterclanResult`) : chaque match
 * gagné compte un point, un nul aucun. Égalité → `null` (le legacy levait :
 * l'API renvoie l'interclan en litige au lieu de planter).
 */
export function calculerVainqueur(
  matchs: ReadonlyArray<{ scoreA: number; scoreB: number }>,
  clanA: number,
  clanB: number,
): { pointsA: number; pointsB: number; vainqueur: number | null } {
  let pointsA = 0;
  let pointsB = 0;
  for (const m of matchs) {
    if (m.scoreA > m.scoreB) pointsA++;
    else if (m.scoreB > m.scoreA) pointsB++;
  }
  return { pointsA, pointsB, vainqueur: pointsA === pointsB ? null : pointsA > pointsB ? clanA : clanB };
}

// ─── Machine d'états ────────────────────────────────────────────────────────

export type Action = "repondre" | "composer" | "verrouiller" | "annuler" | "lancer" | "saisir" | "conclure";

/** États depuis lesquels chaque action est permise. */
export const TRANSITIONS: Readonly<Record<Action, readonly number[]>> = Object.freeze({
  repondre: [ETAT.EN_ATTENTE],
  composer: [ETAT.ACCEPTE],
  verrouiller: [ETAT.ACCEPTE],
  annuler: ETATS_ANNULABLES,
  lancer: [ETAT.PRET],
  saisir: [ETAT.EN_COURS],
  conclure: [ETAT.TERMINE, ETAT.RESULTAT_CONTESTE],
});

const MOTIFS_ETAT: Readonly<Record<Action, string>> = Object.freeze({
  repondre: "Ce défi a déjà été traité.",
  composer: "Les compositions ne sont modifiables qu'entre l'acceptation et le verrouillage.",
  verrouiller: "Le verrouillage n'est possible qu'une fois le défi accepté.",
  annuler: "Cet interclan est déjà lancé, terminé ou annulé.",
  lancer: "L'interclan n'est pas encore prêt à être lancé.",
  saisir: "Les scores ne se saisissent que pendant l'interclan.",
  conclure: "Aucun résultat en attente de validation pour cet interclan.",
});

/** L'action est-elle permise dans cet état ? */
export function permis(action: Action, etat: number): Verdict {
  return TRANSITIONS[action].includes(etat) ? accepter(true) : refuser(409, MOTIFS_ETAT[action]);
}

// ─── Autorisations ──────────────────────────────────────────────────────────

export interface Acteur {
  /** Clan du joueur (actif), ou `null`. */
  clanId: number | null;
  /** Rôle dans ce clan (`ClanMemberRole`). */
  roleClan: number;
  /** Rôle Achilléa (`UserRole`) : ≥ 2 = administrateur. */
  roleUtilisateur: number;
}

export const ROLE_ADMIN = 2;

/** Vice-président (ou président) du clan donné. Les administrateurs passent outre. */
export function dirigeLeClan(acteur: Acteur, clanId: number, minimum: number = ROLE_CLAN.VICE_PRESIDENT): Verdict {
  if (acteur.roleUtilisateur >= ROLE_ADMIN) return accepter(true);
  if (acteur.clanId !== clanId) return refuser(403, "Seul le staff du clan concerné peut effectuer cette action.");
  if (acteur.roleClan < minimum)
    return refuser(
      403,
      minimum >= ROLE_CLAN.PRESIDENT
        ? "Seul le Président du clan peut effectuer cette action."
        : "Il faut être Vice-Président ou Président du clan.",
    );
  return accepter(true);
}

/** Dirigeant de l'un OU l'autre des deux clans. Rend l'identifiant du clan de l'acteur. */
export function dirigeUnDesClans(acteur: Acteur, clanA: number, clanB: number, minimum: number = ROLE_CLAN.VICE_PRESIDENT): Verdict<number> {
  if (acteur.roleUtilisateur >= ROLE_ADMIN) return accepter(acteur.clanId === clanB ? clanB : clanA);
  if (acteur.clanId !== clanA && acteur.clanId !== clanB)
    return refuser(403, "Seuls les membres des deux clans concernés peuvent effectuer cette action.");
  const verdict = dirigeLeClan(acteur, acteur.clanId, minimum);
  return verdict.ok ? accepter(acteur.clanId) : verdict;
}
