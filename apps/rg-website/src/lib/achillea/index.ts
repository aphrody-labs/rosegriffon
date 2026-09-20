/**
 * Surface Achilléa exposée à `apps/website`.
 *
 * Preuve de portabilité autant que commodité : la même logique métier qui
 * alimente le front Angular alimente ici un front Next.js + Tailwind + shadcn,
 * sans duplication ni couche d'adaptation.
 */

export { achilleaApiUrl, createAchilleaClient } from "./client";
export { badgeVariant, toneClassName } from "./tone";
export type { BadgeVariant, Tone } from "./tone";

// Règles métier réutilisables telles quelles côté React.
export {
	castReadiness,
	eloToRankKey,
	formatAchCurrency,
	isClanRecruiting,
	isTournamentOrganizer,
	matchFormatLabel,
	participantStatusLabel,
	participantStatusTone,
	placementPrizeAp,
	rankImagePath,
	resolveDiscordAvatarUrl,
	sanctionTypeLabel,
	sanctionTypeTone,
	stageTypeLabel,
	tournamentStateLabel,
	tournamentStateTone,
	winRatePercent,
} from "@rosegriffon/achillea-core";

export type {
	CircuitLeaderboardEntry,
	ClanDTO,
	LeaderboardEntry,
	RankedProfile,
	Tournament,
	UserDTO,
} from "@rosegriffon/achillea-types";
