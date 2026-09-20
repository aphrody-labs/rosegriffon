/**
 * Barème AP podium — source unique `@rosegriffon/achillea-core` (le bot
 * applique le même). Ce module n'ajoute que les lignes de référence affichées
 * dans le dashboard et le formulaire de création de tournoi.
 */

import { prizeTableForTournamentSize } from "@rosegriffon/achillea-core";

export {
	isPlacementPrizeEligible,
	placementPrizeAp,
	prizeTableForTournamentSize,
} from "@rosegriffon/achillea-core";
export type { TournamentPlacementPrizeTable } from "@rosegriffon/achillea-core";

import type { TournamentPlacementPrizeTable } from "@rosegriffon/achillea-core";

/** Lignes de référence pour l'UI (tranches de taille). */
export const PLACEMENT_PRIZE_TIERS: ReadonlyArray<{
	label: string;
	maxSize: number;
	table: TournamentPlacementPrizeTable;
}> = [
	{ label: "≤ 8 joueurs", maxSize: 8, table: prizeTableForTournamentSize(8) },
	{ label: "≤ 16 joueurs", maxSize: 16, table: prizeTableForTournamentSize(16) },
	{ label: "≤ 32 joueurs (Evo…)", maxSize: 32, table: prizeTableForTournamentSize(32) },
	{ label: "≤ 64 joueurs", maxSize: 64, table: prizeTableForTournamentSize(64) },
	{ label: "≤ 128 joueurs", maxSize: 128, table: prizeTableForTournamentSize(128) },
	{ label: "> 128 joueurs", maxSize: 256, table: prizeTableForTournamentSize(256) },
];

export function formatPrizeSummary(size: number): string {
	const t = prizeTableForTournamentSize(size);
	return `${t.first} / ${t.second} / ${t.semi} AP`;
}
