/**
 * Constantes Discord partagées — IDs guild/rôles/channels.
 *
 * Les valeurs sensibles (secrets, tokens) restent en env vars.
 * Ce fichier centralise seulement les IDs publics-équivalent
 * (snowflakes Discord, pas des secrets cryptographiques).
 */

/**
 * Guild Rose Griffon (« Rose Griffon 🌹 - Inazuma Eleven FR »).
 *
 * Valeur vérifiée contre l'API (`GET /users/@me/guilds` avec le jeton du bot).
 * Elle valait `1252886898988192266`, qui n'est le serveur de personne : le repli
 * ne se voyait pas parce que `DISCORD_GUILD_ID` est toujours posé en production,
 * mais il aurait enregistré les commandes sur une guilde étrangère le jour où
 * l'env aurait manqué.
 */
export const RG_GUILD_ID = "1072991720268111892" as const;

/** Guild Azalée (« 𝓐𝔃𝓪𝓵𝓮́𝓮 🌸 »), second serveur servi par le même bot. */
export const AZALEE_GUILD_ID = "1349526851672080414" as const;

/**
 * Guild Achillea (« Achillea 💮 - Compétitif Inazuma Eleven FR »), qui a invité le
 * bot Azalée le 14/8/2026.
 *
 * Valeur relevée sur l'API (`GET /users/@me/guilds`), pas déduite d'un nom. Elle
 * n'ouvre aucun droit : depuis que le bot Azalée publie ses commandes
 * globalement, cet identifiant ne sert qu'au nettoyage des anciennes commandes de
 * guilde — un serveur n'a plus besoin d'être listé ici pour être servi.
 */
export const ACHILLEA_GUILD_ID = "1055585286320554055" as const;

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
export function resolveGuildId(env: Record<string, string | undefined>): string {
	const fromEnv = env.GUILD_ID || env.DISCORD_GUILD_ID;
	// Filtre les valeurs qui ressemblent à $VAR non-expanded (Bun .env piège)
	if (fromEnv && !fromEnv.startsWith("$")) return fromEnv;
	return RG_GUILD_ID;
}

/**
 * Résout TOUTES les guildes que le bot doit servir, la principale en tête.
 *
 * Pourquoi une liste : discordx n'enregistre les slash commands que sur les
 * guildes listées dans `botGuilds`. Tant que la liste ne contenait que Rose
 * Griffon, ajouter le bot ailleurs donnait un bot présent, en ligne, et
 * strictement muet — aucune commande n'apparaissait.
 *
 * `DISCORD_EXTRA_GUILD_IDS` accepte une liste séparée par des virgules ; Azalée
 * y est de toute façon ajoutée par défaut. Les doublons et les valeurs
 * non-numériques sont écartés (même piège `$VAR` non substitué que ci-dessus).
 */
export function resolveGuildIds(env: Record<string, string | undefined>): string[] {
	const principale = resolveGuildId(env);
	const supplementaires = (env.DISCORD_EXTRA_GUILD_IDS ?? "")
		.split(",")
		.map((v) => v.trim())
		.filter((v) => /^\d{15,25}$/.test(v));

	// Achillea rejoint la liste par défaut le 14/8/2026 : le bot Rose Griffon y est
	// réellement présent (`GET /users/@me/guilds`), et sans cette ligne il y était en
	// ligne et muet — exactement le symptôme décrit plus haut. Le poser ici plutôt que
	// dans `DISCORD_EXTRA_GUILD_IDS` le rend visible, testé et versionné : une variable
	// d'environnement posée à la main sur une seule machine se perd au redéploiement
	// suivant, et personne ne sait plus pourquoi les commandes ont disparu.
	//
	// Lister une guilde que le bot n'a pas rejointe reste sans danger : `src/index.ts`
	// intersecte cette liste avec les guildes réellement rejointes avant d'enregistrer
	// quoi que ce soit.
	return [...new Set([principale, AZALEE_GUILD_ID, ACHILLEA_GUILD_ID, ...supplementaires])];
}
