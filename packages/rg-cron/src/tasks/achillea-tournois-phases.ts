/**
 * Copyright 2026 Rose Griffon
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * `achillea:tournois-phases` — transitions de planning et avancement des phases.
 *
 * Remplace `PhaseTransitions` (`@Schedule("*\/5 * * * *")`) de l'ancien bot, en
 * trois temps, comme lui :
 *
 *  1. PLANNING — `POST /tournaments/internal/schedule-transitions` sur l'API
 *     unifiée (jeton `API_ADMIN_TOKEN`). L'API possède la sélection et les
 *     bascules Pending → Preregistering → Preparing (bracket compris) ; elle
 *     rend en plus les tournois `auto_start` dont l'heure est venue.
 *  2. DÉMARRAGE — ces candidats passent Preparing → Ongoing (même écriture que
 *     `PUT /tournaments/start/:id`, événement `TOURNAMENT_STARTED`), et si le
 *     tournoi a des phases, la première est activée et sa première ronde
 *     appariée (`TournamentsService.startTournament` → `SwissStageService.startSwiss`).
 *  3. PHASES — pour chaque tournoi en cours dont TOUS les lobbys de la phase
 *     active sont terminés (`phaseLobbiesAreFinished`) : ronde suivante, phase
 *     suivante, ou fin du tournoi (`shouldFinishTournament`).
 *
 * ── CE QUI EST CORRIGÉ PAR RAPPORT À L'ANCIEN BOT ──────────────────────────
 *  - Les lobbys créés portaient l'appariement… dans une variable jamais lue :
 *    ils naissaient VIDES (aucun `lobby_user`), donc injouables. Ici chaque
 *    lobby reçoit ses deux joueurs (équipe 1 / équipe 2), et une exemption
 *    (nombre impair) naît terminée avec son seul joueur.
 *  - Une phase suisse s'arrêtait après la PREMIÈRE ronde (`pairNextRound`
 *    n'était appelé nulle part). Le nombre de rondes est `config.rounds`, à
 *    défaut ⌈log2(joueurs)⌉ — la règle suisse usuelle.
 *  - Une phase à élimination directe s'arrêtait après son premier tour. Les
 *    tours s'enchaînent désormais jusqu'au vainqueur (le numéro de tour est
 *    porté par `lobby.swiss_round`, `null` valant 1 pour les lobbys historiques).
 */
import { sql } from "../lib/db.js";

// ─── Règles pures (testées sans base) ───────────────────────────────────────

export interface MatchSuisse {
  joueurA: string;
  joueurB: string | null;
  scoreA: number;
  scoreB: number;
  ronde: number;
  exempt: boolean;
}

export interface ClassementSuisse {
  userId: string;
  points: number;
  buchholz: number;
  sonnebornBerger: number;
  differentiel: number;
  victoires: number;
  defaites: number;
  nuls: number;
  exemptions: number;
}

/** Classement suisse (port exact de `computeSwissStandings`). */
export function classementSuisse(matchs: readonly MatchSuisse[], participants: readonly string[]): ClassementSuisse[] {
  const pts = new Map<string, number>();
  const v = new Map<string, number>();
  const d = new Map<string, number>();
  const n = new Map<string, number>();
  const ex = new Map<string, number>();
  const adversaires = new Map<string, string[]>();
  const gainsContre = new Map<string, Map<string, number>>();
  const plus = (m: Map<string, number>, k: string, x: number) => m.set(k, (m.get(k) ?? 0) + x);
  for (const p of participants) {
    adversaires.set(p, []);
    gainsContre.set(p, new Map());
  }
  for (const m of matchs) {
    if (m.exempt || m.joueurB === null) {
      plus(pts, m.joueurA, 1);
      plus(v, m.joueurA, 1);
      plus(ex, m.joueurA, 1);
      continue;
    }
    adversaires.get(m.joueurA)?.push(m.joueurB);
    adversaires.get(m.joueurB)?.push(m.joueurA);
    if (m.scoreA > m.scoreB) {
      plus(pts, m.joueurA, 1);
      plus(v, m.joueurA, 1);
      plus(d, m.joueurB, 1);
      const g = gainsContre.get(m.joueurA);
      if (g) plus(g, m.joueurB, 1);
    } else if (m.scoreB > m.scoreA) {
      plus(pts, m.joueurB, 1);
      plus(v, m.joueurB, 1);
      plus(d, m.joueurA, 1);
      const g = gainsContre.get(m.joueurB);
      if (g) plus(g, m.joueurA, 1);
    } else {
      plus(pts, m.joueurA, 0.5);
      plus(pts, m.joueurB, 0.5);
      plus(n, m.joueurA, 1);
      plus(n, m.joueurB, 1);
    }
  }
  const classement = participants.map(p => {
    const opp = adversaires.get(p) ?? [];
    return {
      userId: p,
      points: pts.get(p) ?? 0,
      buchholz: opp.reduce((s, o) => s + (pts.get(o) ?? 0), 0),
      sonnebornBerger: opp.reduce((s, o) => s + (gainsContre.get(p)?.get(o) ?? 0) * (pts.get(o) ?? 0), 0),
      differentiel: (v.get(p) ?? 0) - (d.get(p) ?? 0),
      victoires: v.get(p) ?? 0,
      defaites: d.get(p) ?? 0,
      nuls: n.get(p) ?? 0,
      exemptions: ex.get(p) ?? 0,
    };
  });
  return classement.sort(
    (a, b) =>
      b.points - a.points ||
      b.buchholz - a.buchholz ||
      b.sonnebornBerger - a.sonnebornBerger ||
      b.differentiel - a.differentiel,
  );
}

export interface Appariement {
  joueurA: string;
  joueurB: string | null;
}

const clePaire = (a: string, b: string) => [a, b].sort().join("|");

/**
 * Appariement Monrad (port exact de `pairMonrad`) : du mieux classé au moins
 * bien classé, en évitant une revanche quand c'est possible ; l'exemption va au
 * moins bien classé qui n'en a pas encore eu.
 */
export function apparierMonrad(classement: readonly Pick<ClassementSuisse, "userId" | "points" | "buchholz">[], joues: readonly MatchSuisse[]): Appariement[] {
  const tries = [...classement].sort((a, b) => b.points - a.points || b.buchholz - a.buchholz);
  const dejaJouees = new Set(joues.filter(m => !m.exempt && m.joueurB !== null).map(m => clePaire(m.joueurA, m.joueurB!)));
  const dejaExemptes = new Set(joues.filter(m => m.exempt).map(m => m.joueurA));
  const pool = tries.map(s => s.userId);
  const paires: Appariement[] = [];
  const pris = new Set<string>();
  if (pool.length % 2 !== 0) {
    let exempte: string | null = null;
    for (let i = pool.length - 1; i >= 0; i--) {
      if (!dejaExemptes.has(pool[i]!)) {
        exempte = pool[i]!;
        break;
      }
    }
    exempte ??= pool[pool.length - 1]!;
    pris.add(exempte);
    paires.push({ joueurA: exempte, joueurB: null });
  }
  for (let i = 0; i < pool.length; i++) {
    const a = pool[i]!;
    if (pris.has(a)) continue;
    let adversaire = pool.slice(i + 1).find(b => !pris.has(b) && !dejaJouees.has(clePaire(a, b)));
    adversaire ??= pool.slice(i + 1).find(b => !pris.has(b));
    if (adversaire) {
      paires.push({ joueurA: a, joueurB: adversaire });
      pris.add(a);
      pris.add(adversaire);
    }
  }
  return paires;
}

/** Tête de série haute contre basse (1-8, 2-7…) ; un nombre impair donne une exemption au premier. */
export function apparierElimination(qualifies: readonly string[]): Appariement[] {
  const liste = [...qualifies];
  const paires: Appariement[] = [];
  if (liste.length % 2 !== 0) paires.push({ joueurA: liste.shift()!, joueurB: null });
  const moitie = liste.length / 2;
  for (let i = 0; i < moitie; i++) paires.push({ joueurA: liste[i]!, joueurB: liste[liste.length - 1 - i]! });
  return paires;
}

/** Tour suivant d'une élimination directe : vainqueurs pris deux à deux dans l'ordre des lobbys. */
export function apparierTourSuivant(vainqueurs: readonly string[]): Appariement[] {
  const paires: Appariement[] = [];
  for (let i = 0; i < vainqueurs.length; i += 2) {
    paires.push({ joueurA: vainqueurs[i]!, joueurB: vainqueurs[i + 1] ?? null });
  }
  return paires;
}

export const ETATS_TERMINES: ReadonlySet<string> = new Set(["Finished", "Forfeited"]);

/** `phaseLobbiesAreFinished` de `@rosegriffon/achillea-core`. */
export function lobbysTermines(etats: readonly string[]): boolean {
  return etats.length > 0 && etats.every(e => ETATS_TERMINES.has(e));
}

export interface LobbyPhase {
  id: number;
  state: string;
  ronde: number | null;
  joueurs: Array<{ userId: string; team: number; score: number; forfeit: boolean }>;
}

/** Lobby → match (équipe 1 = A). Une exemption a un seul joueur. */
export function versMatch(lobby: LobbyPhase): MatchSuisse | null {
  const tries = [...lobby.joueurs].sort((a, b) => a.team - b.team);
  const a = tries[0];
  if (!a) return null;
  const b = tries[1] ?? null;
  return {
    joueurA: a.userId,
    joueurB: b?.userId ?? null,
    scoreA: a.score,
    scoreB: b?.score ?? 0,
    ronde: lobby.ronde ?? 1,
    exempt: b === null,
  };
}

/** Vainqueur d'un lobby terminé ; `null` si indécidable (égalité sans forfait). */
export function vainqueur(lobby: LobbyPhase): string | null {
  const m = versMatch(lobby);
  if (!m) return null;
  if (m.exempt) return m.joueurA;
  const a = lobby.joueurs.find(j => j.userId === m.joueurA);
  const b = lobby.joueurs.find(j => j.userId === m.joueurB);
  if (a?.forfeit && !b?.forfeit) return m.joueurB;
  if (b?.forfeit && !a?.forfeit) return m.joueurA;
  if (m.scoreA === m.scoreB) return null;
  return m.scoreA > m.scoreB ? m.joueurA : m.joueurB;
}

export interface PhaseTournoi {
  id: string;
  index: number;
  kind: string;
  status: "Pending" | "Active" | "Completed" | string;
  config: { rounds?: number; seeded?: boolean } | null;
  qualifiersCount: number;
}

export const ELIMINATION: ReadonlySet<string> = new Set(["SingleElim", "Top8Bracket"]);

/** Nombre de rondes d'une phase suisse : `config.rounds`, à défaut ⌈log2(n)⌉ (au moins 1). */
export function rondesSuisses(phase: Pick<PhaseTournoi, "config">, joueurs: number): number {
  const configure = Number(phase.config?.rounds);
  if (Number.isInteger(configure) && configure > 0) return configure;
  return Math.max(1, Math.ceil(Math.log2(Math.max(2, joueurs))));
}

/** `shouldFinishTournament` de `@rosegriffon/achillea-core`. */
export function doitTerminer(phases: readonly Pick<PhaseTournoi, "id" | "status">[], phaseActive: string): boolean {
  return (
    phases.length > 0 &&
    phases.every(p => p.status === "Completed" || p.id === phaseActive) &&
    !phases.some(p => p.status === "Active" && p.id !== phaseActive)
  );
}

export type Plan =
  | { type: "attendre"; motif: string }
  | { type: "ronde"; phaseId: string; ronde: number; format: "bo1" | "bo3"; paires: Appariement[] }
  | {
      type: "avancer";
      phaseId: string;
      suivante: { id: string; format: "bo1" | "bo3"; ronde: number; paires: Appariement[] } | null;
      terminerTournoi: boolean;
    };

/**
 * Décision pour la phase active d'un tournoi en cours. Pure : tout l'état est
 * passé en paramètre, le résultat est une instruction que le dépôt exécute.
 */
export function planifier(phases: readonly PhaseTournoi[], lobbys: readonly LobbyPhase[]): Plan {
  const active = phases.find(p => p.status === "Active");
  if (!active) return { type: "attendre", motif: "aucune phase active" };
  if (!lobbysTermines(lobbys.map(l => l.state))) return { type: "attendre", motif: "lobbys en cours" };

  const matchs = lobbys.map(versMatch).filter((m): m is MatchSuisse => m !== null);
  const participants = [...new Set(matchs.flatMap(m => (m.joueurB ? [m.joueurA, m.joueurB] : [m.joueurA])))];
  const derniereRonde = Math.max(1, ...lobbys.map(l => l.ronde ?? 1));

  if (active.kind === "Swiss" && derniereRonde < rondesSuisses(active, participants.length)) {
    const classement = classementSuisse(matchs, participants);
    return { type: "ronde", phaseId: active.id, ronde: derniereRonde + 1, format: "bo1", paires: apparierMonrad(classement, matchs) };
  }

  if (ELIMINATION.has(active.kind)) {
    const tour = lobbys.filter(l => (l.ronde ?? 1) === derniereRonde).sort((a, b) => a.id - b.id);
    const gagnants = tour.map(vainqueur);
    if (gagnants.some(g => g === null)) return { type: "attendre", motif: "lobby terminé sans vainqueur (égalité)" };
    if (gagnants.length > 1)
      return {
        type: "ronde",
        phaseId: active.id,
        ronde: derniereRonde + 1,
        format: "bo3",
        paires: apparierTourSuivant(gagnants as string[]),
      };
  }

  // Phase achevée : qualifiés pour la phase suivante, dans l'ordre du classement.
  const classement = classementSuisse(matchs, participants).map(c => c.userId);
  const qualifiesBruts = active.qualifiersCount > 0 ? classement.slice(0, active.qualifiersCount) : classement;
  const suivante = phases
    .filter(p => p.status === "Pending" && p.index > active.index)
    .sort((a, b) => a.index - b.index)[0];

  if (!suivante) return { type: "avancer", phaseId: active.id, suivante: null, terminerTournoi: doitTerminer(phases, active.id) };

  const taille = suivante.qualifiersCount > 0 ? suivante.qualifiersCount : qualifiesBruts.length;
  const qualifies = qualifiesBruts.slice(0, taille);
  if (ELIMINATION.has(suivante.kind))
    return {
      type: "avancer",
      phaseId: active.id,
      suivante: { id: suivante.id, format: "bo3", ronde: 1, paires: apparierElimination(qualifies) },
      terminerTournoi: false,
    };
  if (suivante.kind === "Swiss") {
    const depart = qualifies.map(userId => ({ userId, points: 0, buchholz: 0 }));
    return {
      type: "avancer",
      phaseId: active.id,
      suivante: { id: suivante.id, format: "bo1", ronde: 1, paires: apparierMonrad(depart, []) },
      terminerTournoi: false,
    };
  }
  // Autres formats (championnat, double élimination, poules) : activés, conduits par l'organisateur.
  return { type: "avancer", phaseId: active.id, suivante: { id: suivante.id, format: "bo3", ronde: 1, paires: [] }, terminerTournoi: false };
}

/** Mélange de Fisher-Yates (le `sort(() => Math.random() - 0.5)` de l'ancien bot est biaisé). */
export function melanger<T>(valeurs: readonly T[], aleatoire: () => number = Math.random): T[] {
  const copie = [...valeurs];
  for (let i = copie.length - 1; i > 0; i--) {
    const j = Math.floor(aleatoire() * (i + 1));
    [copie[i], copie[j]] = [copie[j]!, copie[i]!];
  }
  return copie;
}

// ─── Accès API et base ──────────────────────────────────────────────────────

export interface TransitionPlanning {
  tournamentId: number;
  from: string;
  to: string;
}

/** Base interne de l'API unifiée (même règle que le bot : `ACHILLEA_API_INTERNAL_URL`, sinon rg-core). */
export function baseApiInterne(env: Record<string, string | undefined> = Bun.env): string {
  const surcharge = (env.ACHILLEA_API_INTERNAL_URL ?? "").trim();
  if (surcharge && !surcharge.startsWith("$")) return surcharge.replace(/\/+$/u, "");
  const port = Number(env.RG_CORE_PORT ?? 8810);
  return `http://127.0.0.1:${Number.isInteger(port) && port > 0 ? port : 8810}/api`;
}

export async function transitionsPlanning(
  maintenant: Date,
  env: Record<string, string | undefined> = Bun.env,
  fetcher: typeof fetch = fetch,
): Promise<{ transitions: TransitionPlanning[]; aDemarrer: number[] }> {
  const jeton = (env.API_ADMIN_TOKEN ?? "").trim();
  if (!jeton) throw new Error("API_ADMIN_TOKEN absent : les transitions de planning ne peuvent pas être demandées à l'API.");
  const reponse = await fetcher(`${baseApiInterne(env)}/tournaments/internal/schedule-transitions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: `Bearer ${jeton}` },
    body: JSON.stringify({ now: maintenant.toISOString() }),
    signal: AbortSignal.timeout(60_000),
  });
  const corps = (await reponse.json().catch(() => null)) as {
    transitions?: TransitionPlanning[];
    startCandidates?: number[];
    message?: string;
  } | null;
  if (!reponse.ok) throw new Error(corps?.message ?? `API des transitions : HTTP ${reponse.status}`);
  return { transitions: corps?.transitions ?? [], aDemarrer: corps?.startCandidates ?? [] };
}

export interface DepotTournois {
  /** Passe le tournoi en cours s'il est encore en préparation ; rend ses joueurs actifs (ordre de tête de série) ou `null`. */
  demarrer(tournoiId: number, maintenant: Date): Promise<string[] | null>;
  tournoisEnCours(): Promise<number[]>;
  phases(tournoiId: number): Promise<PhaseTournoi[]>;
  lobbys(phaseId: string): Promise<LobbyPhase[]>;
  /** Crée une ronde si elle n'existe pas déjà (idempotent). Active la phase si demandé. */
  creerRonde(input: {
    tournoiId: number;
    phaseId: string;
    ronde: number;
    format: "bo1" | "bo3";
    paires: readonly Appariement[];
    activerPhase: boolean;
  }): Promise<boolean>;
  /** Clôt la phase (`Completed`) et consigne `PHASE_ADVANCED`. */
  completerPhase(tournoiId: number, phaseId: string, suivanteId: string | null): Promise<boolean>;
  terminerTournoi(tournoiId: number): Promise<boolean>;
}

type Tx = typeof sql;

async function insererRonde(
  tx: Tx,
  input: { tournoiId: number; phaseId: string; ronde: number; format: string; paires: readonly Appariement[] },
): Promise<void> {
  for (const paire of input.paires) {
    const exempt = paire.joueurB === null;
    const etat = exempt ? "Finished" : "Fresh";
    const [lobby] = await tx<Array<{ id: number }>>`
      INSERT INTO achillea.lobby
             (created_at, updated_at, event_type, event_id, mode, state, bracket_match_id, channel_id, host_user_id,
              is_repool, phase_id, swiss_round, match_format, custom_format_child_count, ranked_elo_applied)
      VALUES (now(), now(), 'TOURNAMENT', ${input.tournoiId}, 2, ${etat}, NULL, NULL, NULL,
              false, ${input.phaseId}, ${input.ronde}, ${input.format}, NULL, false)
      RETURNING id`;
    const joueurs = exempt ? [{ id: paire.joueurA, team: 1 }] : [{ id: paire.joueurA, team: 1 }, { id: paire.joueurB!, team: 2 }];
    for (const joueur of joueurs) {
      await tx`
        INSERT INTO achillea.lobby_user
               (created_at, updated_at, user_id, lobby_id, team, score, forfeit, elo_variation, validated_result,
                claimed_opponent_score, screenshot_url, state)
        VALUES (now(), now(), ${joueur.id}, ${lobby!.id}, ${joueur.team}, 0, false, 0, ${exempt}, NULL, NULL,
                ${exempt ? "Finished" : "Pending"})`;
    }
  }
}

export const depotTournois: DepotTournois = {
  async demarrer(tournoiId, maintenant) {
    return sql.begin(async tx => {
      await tx`SET LOCAL ROLE service_role`;
      const [tournoi] = await tx<Array<{ internal_state: string | null }>>`
        SELECT internal_state FROM achillea.event WHERE id = ${tournoiId} AND type = 'TOURNAMENT' FOR UPDATE`;
      if (tournoi?.internal_state !== "Preparing") return null;
      const joueurs = await tx<Array<{ user_id: string }>>`
        SELECT user_id FROM achillea.tournament_participant
         WHERE tournament_id = ${tournoiId} AND status = 'Active'
         ORDER BY seed NULLS LAST, id`;
      await tx`UPDATE achillea.event SET internal_state = 'Ongoing', updated_at = ${maintenant} WHERE id = ${tournoiId}`;
      await tx`
        INSERT INTO achillea.tournament_event (tournament_id, type, actor_id, target_id, payload, reason, created_at)
        VALUES (${tournoiId}, 'TOURNAMENT_STARTED', NULL, NULL,
                ${JSON.stringify({ automatic: true, participants: joueurs.length })}::jsonb, NULL, ${maintenant})`;
      return joueurs.map(j => j.user_id);
    });
  },
  async tournoisEnCours() {
    const lignes = await sql<Array<{ id: number }>>`
      SELECT id FROM achillea.event WHERE type = 'TOURNAMENT' AND internal_state = 'Ongoing' ORDER BY id LIMIT 100`;
    return lignes.map(l => l.id);
  },
  async phases(tournoiId) {
    const lignes = await sql<
      Array<{ id: string; index: number; kind: string; status: string; config: PhaseTournoi["config"]; qualifiers_count: number }>
    >`
      SELECT id, index, kind, status, config, qualifiers_count
        FROM achillea.tournament_phase WHERE tournament_id = ${tournoiId} ORDER BY index`;
    return lignes.map(l => ({
      id: String(l.id),
      index: Number(l.index),
      kind: l.kind,
      status: l.status,
      config: l.config,
      qualifiersCount: Number(l.qualifiers_count ?? 0),
    }));
  },
  async lobbys(phaseId) {
    const lignes = await sql<
      Array<{ id: number; state: string; swiss_round: number | null; user_id: string | null; team: number | null; score: number | null; forfeit: boolean | null }>
    >`
      SELECT l.id, l.state, l.swiss_round, lu.user_id, lu.team, lu.score, lu.forfeit
        FROM achillea.lobby l
        LEFT JOIN achillea.lobby_user lu ON lu.lobby_id = l.id
       WHERE l.phase_id = ${phaseId}
       ORDER BY l.id, lu.team`;
    const parId = new Map<number, LobbyPhase>();
    for (const l of lignes) {
      const lobby = parId.get(l.id) ?? { id: l.id, state: l.state, ronde: l.swiss_round, joueurs: [] };
      if (l.user_id)
        lobby.joueurs.push({ userId: l.user_id, team: Number(l.team ?? 1), score: Number(l.score ?? 0), forfeit: Boolean(l.forfeit) });
      parId.set(l.id, lobby);
    }
    return [...parId.values()];
  },
  async creerRonde(input) {
    return sql.begin(async tx => {
      await tx`SET LOCAL ROLE service_role`;
      const [phase] = await tx<Array<{ status: string }>>`
        SELECT status FROM achillea.tournament_phase WHERE id = ${input.phaseId} FOR UPDATE`;
      if (!phase || phase.status === "Completed") return false;
      const [existe] = await tx<Array<{ n: number }>>`
        SELECT count(*)::int AS n FROM achillea.lobby WHERE phase_id = ${input.phaseId} AND COALESCE(swiss_round, 1) = ${input.ronde}`;
      if (Number(existe?.n ?? 0) > 0) return false;
      if (input.activerPhase)
        await tx`UPDATE achillea.tournament_phase SET status = 'Active', started_at = now(), updated_at = now() WHERE id = ${input.phaseId}`;
      await insererRonde(tx as unknown as Tx, input);
      return true;
    });
  },
  async completerPhase(tournoiId, phaseId, suivanteId) {
    return sql.begin(async tx => {
      await tx`SET LOCAL ROLE service_role`;
      const lignes = await tx`
        UPDATE achillea.tournament_phase SET status = 'Completed', ended_at = now(), updated_at = now()
         WHERE id = ${phaseId} AND status <> 'Completed' RETURNING id`;
      if (lignes.length === 0) return false;
      await tx`
        INSERT INTO achillea.tournament_event (tournament_id, type, actor_id, target_id, payload, reason, created_at)
        VALUES (${tournoiId}, 'PHASE_ADVANCED', NULL, NULL,
                ${JSON.stringify({ automatic: true, from: phaseId, to: suivanteId })}::jsonb, NULL, now())`;
      return true;
    });
  },
  async terminerTournoi(tournoiId) {
    return sql.begin(async tx => {
      await tx`SET LOCAL ROLE service_role`;
      const lignes = await tx`
        UPDATE achillea.event SET internal_state = 'Finished', updated_at = now()
         WHERE id = ${tournoiId} AND internal_state = 'Ongoing' RETURNING id`;
      return lignes.length > 0;
    });
  },
};

export interface ResultatTournoisPhases {
  success: true;
  transitions: TransitionPlanning[];
  /** Erreur de l'étape de planning (l'avancement des phases a tourné quand même). */
  erreurPlanning?: string;
  demarres: number[];
  rondesCreees: Array<{ tournoi: number; phase: string; ronde: number }>;
  phasesAvancees: Array<{ tournoi: number; phase: string; suivante: string | null }>;
  termines: number[];
  enAttente: Array<{ tournoi: number; motif: string }>;
}

export async function runAchilleaTournoisPhases(
  depot: DepotTournois = depotTournois,
  planning: (maintenant: Date) => Promise<{ transitions: TransitionPlanning[]; aDemarrer: number[] }> = m =>
    transitionsPlanning(m),
  maintenant: Date = new Date(),
  aleatoire: () => number = Math.random,
): Promise<ResultatTournoisPhases> {
  const resultat: ResultatTournoisPhases = {
    success: true,
    transitions: [],
    demarres: [],
    rondesCreees: [],
    phasesAvancees: [],
    termines: [],
    enAttente: [],
  };

  // 1. Planning — une panne ici ne doit pas bloquer l'avancement des tournois en cours.
  let aDemarrer: number[] = [];
  try {
    const reponse = await planning(maintenant);
    resultat.transitions = reponse.transitions;
    aDemarrer = reponse.aDemarrer;
  } catch (err) {
    resultat.erreurPlanning = err instanceof Error ? err.message : String(err);
    console.warn(`[achillea:tournois-phases] transitions de planning : ${resultat.erreurPlanning}`);
  }

  // 2. Démarrages automatiques.
  for (const tournoiId of aDemarrer) {
    const joueurs = await depot.demarrer(tournoiId, maintenant);
    if (!joueurs) continue;
    resultat.demarres.push(tournoiId);
    const premiere = (await depot.phases(tournoiId)).find(p => p.status === "Pending");
    if (!premiere) continue;
    const ordre = premiere.config?.seeded ? joueurs : melanger(joueurs, aleatoire);
    const paires = ELIMINATION.has(premiere.kind)
      ? apparierElimination(premiere.qualifiersCount > 0 ? ordre.slice(0, premiere.qualifiersCount) : ordre)
      : apparierMonrad(ordre.map(userId => ({ userId, points: 0, buchholz: 0 })), []);
    const format = ELIMINATION.has(premiere.kind) ? "bo3" : "bo1";
    if (await depot.creerRonde({ tournoiId, phaseId: premiere.id, ronde: 1, format, paires, activerPhase: true }))
      resultat.rondesCreees.push({ tournoi: tournoiId, phase: premiere.id, ronde: 1 });
  }

  // 3. Avancement des phases. Une erreur sur un tournoi n'arrête pas les autres.
  for (const tournoiId of await depot.tournoisEnCours()) {
    try {
      const phases = await depot.phases(tournoiId);
      const active = phases.find(p => p.status === "Active");
      if (!active) continue;
      const plan = planifier(phases, await depot.lobbys(active.id));
      if (plan.type === "attendre") {
        if (plan.motif !== "lobbys en cours") resultat.enAttente.push({ tournoi: tournoiId, motif: plan.motif });
        continue;
      }
      if (plan.type === "ronde") {
        if (await depot.creerRonde({ tournoiId, ...plan, activerPhase: false }))
          resultat.rondesCreees.push({ tournoi: tournoiId, phase: plan.phaseId, ronde: plan.ronde });
        continue;
      }
      if (!(await depot.completerPhase(tournoiId, plan.phaseId, plan.suivante?.id ?? null))) continue;
      resultat.phasesAvancees.push({ tournoi: tournoiId, phase: plan.phaseId, suivante: plan.suivante?.id ?? null });
      if (plan.suivante) {
        await depot.creerRonde({
          tournoiId,
          phaseId: plan.suivante.id,
          ronde: plan.suivante.ronde,
          format: plan.suivante.format,
          paires: plan.suivante.paires,
          activerPhase: true,
        });
      } else if (plan.terminerTournoi && (await depot.terminerTournoi(tournoiId))) {
        resultat.termines.push(tournoiId);
      }
    } catch (err) {
      resultat.enAttente.push({ tournoi: tournoiId, motif: err instanceof Error ? err.message : String(err) });
    }
  }

  for (const t of resultat.transitions) console.info(`[achillea:tournois-phases] tournoi ${t.tournamentId} : ${t.from} → ${t.to}`);
  return resultat;
}
