/**
 * Constantes Discord partagées — IDs guild/rôles/channels.
 *
 * Les valeurs sensibles (secrets, tokens) restent en env vars.
 * Ce fichier centralise seulement les IDs publics-équivalent
 * (snowflakes Discord, pas des secrets cryptographiques).
 */

/** Guild Rose Griffon (Rose Griffon 🌹 - Inazuma Eleven FR). */
export const RG_GUILD_ID = "1252886898988192266" as const;

/**
 * Discord role IDs publics/utilitaires.
 */
export const DISCORD_ROLES = {
	ADMIN: "1072993826400124958",
	VICE_ADMIN: "1371547071362105374",
	MOD_RESP: "1267847004919300096",
	MEDAILLE_AZALEE: "1364903623783612498",
	NIVEAU_ROY: "1371177169216077864",
	NIVEAU_GAELLE: "1371176894791159819",
	NIVEAU_EVANS: "1371176241213870131",
	STAFF_RG: "1072991720268111892", // Souvent lié au STAFF_ROLE_ID env
} as const;

/**
 * Discord channel IDs (salons) importants.
 */
export const DISCORD_CHANNELS = {
	NEWS: "1252886898988192266", // DISCORD_NEWS_CHANNEL_ID
	LOGS_BOT: "1252886898988192266",
	BIENVENUE: "1252886898988192266",
	ANNONCES: "1252886898988192266",
} as const;

/** Backward compat */
export const MEDAILLE_AZALEE_ROLE_ID = DISCORD_ROLES.MEDAILLE_AZALEE;

/** Helper : résout le guild ID depuis env avec fallback constant. */
export function resolveGuildId(
	env: Record<string, string | undefined>,
): string {
	const fromEnv = env.GUILD_ID || env.DISCORD_GUILD_ID;
	// Filtre les valeurs qui ressemblent à $VAR non-expanded (Bun .env piège)
	if (fromEnv && !fromEnv.startsWith("$")) return fromEnv;
	return RG_GUILD_ID;
}
