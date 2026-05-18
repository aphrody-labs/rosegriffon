// Fail-fast à l'initialisation du processus.
// Fallback DISCORD_GUILD_ID : Bun n'expand pas `GUILD_ID=$DISCORD_GUILD_ID`
// dans .env (passe la string littérale). On lit les 2 et on filtre les valeurs
// qui ressemblent à une référence shell non résolue ($VAR).
import { resolveGuildId } from "@rg/types/discord";

export const GUILD_ID = resolveGuildId(Bun.env as Record<string, string | undefined>);

export const SYNC_INTERVAL_MS = Number(
	Bun.env.SYNC_INTERVAL_MS ?? 30 * 60 * 1000,
);

export const REDIS_URL = Bun.env.REDIS_URL ?? "redis://127.0.0.1:6379/1";

export function requireEnv(key: string): string {
	const v = Bun.env[key];
	if (!v) {
		throw new Error(`[config] ${key} is required (see .env.example)`);
	}
	return v;
}

export const DISCORD_TOKEN = requireEnv(
	Bun.env.DISCORD_BOT_TOKEN ? "DISCORD_BOT_TOKEN" : "DISCORD_TOKEN",
);
