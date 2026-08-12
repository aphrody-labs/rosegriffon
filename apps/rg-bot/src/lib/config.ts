// Fail-fast à l'initialisation du processus.
// Fallback DISCORD_GUILD_ID : Bun n'expand pas `GUILD_ID=$DISCORD_GUILD_ID`
// dans .env (passe la string littérale). On lit les 2 et on filtre les valeurs
// qui ressemblent à une référence shell non résolue ($VAR).
import { resolveGuildId } from "@rosegriffon/types/discord";

export const GUILD_ID = resolveGuildId(Bun.env as Record<string, string | undefined>);

export const SYNC_INTERVAL_MS = Number(Bun.env.SYNC_INTERVAL_MS ?? 30 * 60 * 1000);

/**
 * Partage des responsabilités avec `rg-cron.service`.
 *
 * Les deux démons ouvrent une passerelle Discord avec LE MÊME jeton, donc les
 * deux reçoivent tous les événements du serveur. Pour éviter les doublons
 * visibles par les membres et les doubles écritures en base, la répartition
 * est la suivante :
 *
 *   - `rg-cron` garde la synchronisation (membres, rôles, avatars du staff
 *     toutes les 30 min et sur `guildMemberAdd`/`Update`/`userUpdate`), la
 *     télémétrie (présences, salons vocaux), la veille des messages et le
 *     serveur HTTP d'annonces (`POST :3006/announce`).
 *   - `rg-bot` garde ce que le cron ne fait PAS : les interactions, c'est-à-dire
 *     l'enregistrement et l'exécution des slash commands.
 *
 * Ce drapeau ne sert qu'à rendre le partage réversible : le passer à `1`
 * redonne au bot la synchronisation automatique, à n'activer que si le cron
 * cesse de l'assurer (sinon chaque membre est écrit deux fois).
 */
export const BOT_SYNC_MEMBRES = Bun.env.BOT_SYNC_MEMBRES === "1";

export const REDIS_URL = Bun.env.REDIS_URL ?? "redis://127.0.0.1:6379/1";

export function requireEnv(key: string): string {
	const v = Bun.env[key];
	if (!v) {
		throw new Error(`[config] ${key} is required (see .env.example)`);
	}
	return v;
}

export const DISCORD_TOKEN = requireEnv(
	Bun.env.DISCORD_BOT_TOKEN ? "DISCORD_BOT_TOKEN" : "DISCORD_TOKEN"
);

export const RG_BRAND_HEX = "#a14b3f" as const;
export const RG_COLOR = Number.parseInt(RG_BRAND_HEX.slice(1), 16);
export const RG_FOOTER = "rosegriffon.fr";
export const RG_BASE_URL = Bun.env.WEBSITE_URL ?? "https://rosegriffon.fr";
