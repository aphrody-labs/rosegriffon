/**
 * Barème AP podium tournoi — miroir de `@achillea/core` (`placementPrizeAp` /
 * `prizeTableForTournamentSize`). Source de vérité côté bot/core ; ce helper
 * sert uniquement l'affichage dashboard / création de tournoi.
 */

export interface TournamentPlacementPrizeTable {
	first: number;
	second: number;
	semi: number;
}

export function prizeTableForTournamentSize(size: number): TournamentPlacementPrizeTable {
	const n = Number.isFinite(size) ? Math.max(0, Math.floor(size)) : 0;
	if (n <= 8) return { first: 25, second: 12, semi: 5 };
	if (n <= 16) return { first: 35, second: 18, semi: 8 };
	if (n <= 32) return { first: 50, second: 25, semi: 10 };
	if (n <= 64) return { first: 80, second: 40, semi: 15 };
	if (n <= 128) return { first: 120, second: 60, semi: 25 };
	return { first: 180, second: 90, semi: 35 };
}

export function placementPrizeAp(tournamentSize: number, rank: number): number {
	if (!Number.isFinite(rank) || rank < 1) return 0;
	const table = prizeTableForTournamentSize(tournamentSize);
	if (rank === 1) return table.first;
	if (rank === 2) return table.second;
	if (rank <= 4) return table.semi;
	return 0;
}

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

/** Formats éligibles au bonus podium (élimination). */
export function isPlacementPrizeEligible(tournamentType: string | undefined | null): boolean {
	return tournamentType === "single_elimination" || tournamentType === "double_elimination";
}

export function formatPrizeSummary(size: number): string {
	const t = prizeTableForTournamentSize(size);
	return `${t.first} / ${t.second} / ${t.semi} AP`;
}
