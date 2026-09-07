// Logique PURE de résolution d'un match ranked 1v1 — aucune dépendance Colyseus / DB /
// Discord, donc entièrement testable (cf. tests/unit/ranked-match-logic.test.ts).
//
// Modèle de score « double validation » : chaque joueur saisit le score COMPLET de son
// point de vue (mes buts + buts adverse). Le joueur 1 (index 0) joue à DOMICILE (team 1),
// le joueur 2 (index 1) à l'EXTÉRIEUR (team 2). Accord si les 2 scorelines concordent
// (domicile 3-1 ⇄ extérieur 1-3) → match validé. Désaccord → litige.
//
// La fin de match est ASYNCHRONE : chaque joueur confirme la fin et saisit son score
// indépendamment de l'autre (qui peut être déconnecté puis revenir via le code de salle).

import { TeamSide } from "../utils/enums";

/** Côté terrain du joueur selon son index dans le match (0 = domicile, 1 = extérieur). */
export function teamForIndex(index: number): TeamSide {
	return index === 0 ? TeamSide.TEAM_1 : TeamSide.TEAM_2;
}

/** true si le joueur joue à domicile (team 1). */
export function isHomeTeam(team: number): boolean {
	return team === TeamSide.TEAM_1;
}

/** Borne un score saisi dans [0, 99] (entier). Toute valeur non finie (NaN, ∞, texte non
 *  numérique) est ramenée à 0 — un score corrompu ne doit jamais polluer le résultat. */
export function clampScore(v: unknown): number {
	const n = Math.floor(Number(v ?? 0));
	if (!Number.isFinite(n)) return 0;
	return Math.max(0, Math.min(99, n));
}

/** Modes ranked supportés : 2 (1v1 / solo) et 4 (2v2 / duo). */
export const SUPPORTED_MODES = [2, 4] as const;

/** Normalise un `mode` reçu d'un client en mode valide (4 si exactement 4, sinon 2).
 *  Empêche un mode arbitraire (0, -1, 999, NaN) de produire des requêtes Elo incohérentes. */
export function parseMode(v: unknown): 2 | 4 {
	return Math.floor(Number(v)) === 4 ? 4 : 2;
}

/** Fenêtre élo dynamique : `base` élargi de 50 AP par tranche de 5 s d'attente. */
export function eloWindow(base: number, waitedMs: number): number {
	return base + Math.floor(Math.max(0, waitedMs) / 5000) * 50;
}

/** Candidat en file (vue minimale, pour la sélection pure de paire). */
export interface QueueCandidate {
	userId: string;
	elo: number;
	enqueuedAt: number;
}

/**
 * Choisit la 1re paire appariable dans une file TRIÉE PAR ELO CROISSANT. Renvoie les index
 * `[i, j]` (i < j) dans `sorted`, ou `null` si aucune paire n'est dans la fenêtre.
 *
 * Garantie CRITIQUE : ne retourne JAMAIS deux entrées du même `userId` (un joueur multi-onglets
 * ne doit pas s'apparier contre lui-même → la MatchRoom indexe par userId et collapse sinon).
 * Optimisation : la liste étant triée, dès que `b.elo - a.elo` dépasse la fenêtre, on arrête
 * d'explorer pour ce `a`.
 */
export function selectQueuePair(
	sorted: QueueCandidate[],
	now: number,
	baseWindow: number
): [number, number] | null {
	for (let i = 0; i < sorted.length - 1; i++) {
		const a = sorted[i];
		for (let j = i + 1; j < sorted.length; j++) {
			const b = sorted[j];
			if (a.userId === b.userId) continue; // jamais soi-même
			const waited = Math.max(now - a.enqueuedAt, now - b.enqueuedAt);
			const window = eloWindow(baseWindow, waited);
			if (Math.abs(a.elo - b.elo) <= window) return [i, j];
			if (b.elo - a.elo > window) break; // trié : tout j suivant est plus loin encore
		}
	}
	return null;
}

/** Saisie d'un joueur, du point de vue de CE joueur. */
export interface ScoreInput {
	userId: string;
	myScore: number; // mes buts
	oppScore: number; // buts que j'attribue à l'adversaire
	submitted: boolean;
}

/**
 * Accord : les 2 scorelines décrivent le MÊME résultat (domicile 3-1 ⇄ extérieur 1-3).
 * Exige que les DEUX joueurs aient saisi.
 */
export function scoresAgree(home: ScoreInput, away: ScoreInput): boolean {
	return (
		home.submitted &&
		away.submitted &&
		home.myScore === away.oppScore &&
		home.oppScore === away.myScore
	);
}

/** Résultat du point de vue d'un joueur, à partir de son score et de celui de l'adversaire. */
export function resultLabel(myScore: number, oppScore: number): "win" | "loss" | "draw" {
	if (myScore === oppScore) return "draw";
	return myScore > oppScore ? "win" : "loss";
}

/**
 * Décision de résolution d'un match (1v1) à partir des 2 saisies.
 * `home` = team 1 (domicile), `away` = team 2 (extérieur). Les scores renvoyés (`s1`/`s2`)
 * sont TOUJOURS exprimés côté domicile/extérieur (s1 = buts domicile, s2 = buts extérieur).
 *
 * - `wait`    : hors timeout, on attend que les 2 aient saisi.
 * - `agree`   : les 2 scorelines concordent → finaliser (s1, s2).
 * - `forfeit` : timeout avec un seul joueur ayant saisi → l'absent (`forfeitUserId`) est forfait.
 * - `dispute` : désaccord (ou timeout sans saisie exploitable) → litige + preuve.
 */
export type ScoreOutcome =
	| { kind: "wait" }
	| { kind: "agree"; s1: number; s2: number }
	| { kind: "forfeit"; s1: number; s2: number; forfeitUserId: string }
	| { kind: "dispute" };

export function resolveScores(home: ScoreInput, away: ScoreInput, forced: boolean): ScoreOutcome {
	// Hors timeout : on attend que les 2 aient saisi.
	if (!forced && (!home.submitted || !away.submitted)) {
		return { kind: "wait" };
	}

	if (scoresAgree(home, away)) {
		return { kind: "agree", s1: home.myScore, s2: away.myScore };
	}

	// Timeout avec un seul joueur ayant saisi → l'absent est forfait.
	if (forced && home.submitted && !away.submitted) {
		return { kind: "forfeit", s1: home.myScore, s2: home.oppScore, forfeitUserId: away.userId };
	}
	if (forced && away.submitted && !home.submitted) {
		return { kind: "forfeit", s1: away.oppScore, s2: away.myScore, forfeitUserId: home.userId };
	}

	// Désaccord (ou timeout sans saisie exploitable) → litige.
	return { kind: "dispute" };
}
