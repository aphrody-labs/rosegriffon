// Fail-fast à l'initialisation du processus
export const GUILD_ID = Bun.env.GUILD_ID; // optional — bot peut tourner sans guild

export const SYNC_INTERVAL_MS = Number(
	Bun.env.SYNC_INTERVAL_MS ?? 30 * 60 * 1000,
);

export const REDIS_URL =
	Bun.env.REDIS_URL ?? "redis://127.0.0.1:6379/1";

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
