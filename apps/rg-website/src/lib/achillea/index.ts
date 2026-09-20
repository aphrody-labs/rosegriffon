/**
 * Surface Achilléa exposée à `apps/website`.
 *
 * Preuve de portabilité autant que commodité : la même logique métier qui
 * alimente le front Angular alimente ici un front Next.js + Tailwind + shadcn,
 * sans duplication ni couche d'adaptation.
 */

export { achilleaApiUrl, createAchilleaClient } from "./client";
export { safeReturnUrl } from "./auth-session";
export { badgeVariant, toneClassName } from "./tone";
export type { BadgeVariant, Tone } from "./tone";
export { AchilleaAuthProvider, useAchilleaAuth } from "./auth-context";
export type { AchilleaAuthContextType, AchilleaAuthStatus } from "./auth-context";
export {
	clampParallax,
	canSpawnFx,
	createBurstParticles,
	stepParticles,
	capParticles,
	lerp,
	isHeroUiTarget,
	HERO_UI_HIT_SELECTOR,
	HERO_PARTICLE_COLORS_DARK,
	HERO_PARTICLE_COLORS_LIGHT,
} from "./hero-bg-fx";
export type { HeroParticle, Rgb } from "./hero-bg-fx";

// Règles métier réutilisables telles quelles côté React.
export {
	castReadiness,
	eloToRankKey,
	formatAchCurrency,
	isClanRecruiting,
	isTournamentOrganizer,
	licenseStatusLabel,
	licenseStatusTone,
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

