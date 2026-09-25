import { Database } from "bun:sqlite";
import { RedisClient } from "bun";
import { mkdirSync } from "node:fs";
import { dirname, isAbsolute } from "node:path";
import type { Guild, GuildMember } from "discord.js";

// discord.js GatewayIntentBits.GuildMembers (bit 1); keep the mirror loadable
// without loading a second Discord runtime in cron or the legacy bot.
const GUILD_MEMBERS_INTENT = 1 << 1;

export interface DiscordSnapshotSource {
	sourceBotId: string;
	profile: string;
}

export interface DiscordGuildSnapshotReport {
	guildId: string;
	memberCount: number;
	roleCount: number;
	channelCount: number;
	emojiCount: number;
	eventCount: number;
	activeThreadCount: number;
	membersComplete: boolean;
	emojisComplete: boolean;
	eventsComplete: boolean;
	activeThreadsComplete: boolean;
	syncedAt: string;
}

/**
 * One shared bot mirror, explicitly configured by the operator. This is not an
 * identity store: OAuth credentials, message bodies and private user data are
 * deliberately outside its schema. PostgreSQL remains the application source.
 */
export function openDiscordSnapshot(path = Bun.env.RG_DISCORD_SYNC_SQLITE_PATH): Database | null {
	if (!path) return null;
	if (!isAbsolute(path)) throw new Error("RG_DISCORD_SYNC_SQLITE_PATH must be an absolute path shared by both bots");
	mkdirSync(dirname(path), { recursive: true });
	const db = new Database(path, { create: true, strict: true });
	db.exec("PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000; PRAGMA foreign_keys = ON;");
	db.exec(`
		CREATE TABLE IF NOT EXISTS rg_discord_guilds (
			source_bot_id TEXT NOT NULL, profile TEXT NOT NULL, guild_id TEXT NOT NULL,
			name TEXT NOT NULL, icon_url TEXT, description TEXT, member_count INTEGER,
			synced_at TEXT NOT NULL, PRIMARY KEY (source_bot_id, guild_id)
		);
		CREATE TABLE IF NOT EXISTS rg_discord_members (
			source_bot_id TEXT NOT NULL, guild_id TEXT NOT NULL, member_id TEXT NOT NULL,
			username TEXT NOT NULL, global_name TEXT, nickname TEXT, avatar_url TEXT,
			joined_at TEXT, premium_since TEXT, is_bot INTEGER NOT NULL,
			role_ids_json TEXT NOT NULL, synced_at TEXT NOT NULL,
			PRIMARY KEY (source_bot_id, guild_id, member_id)
		);
		CREATE TABLE IF NOT EXISTS rg_discord_roles (
			source_bot_id TEXT NOT NULL, guild_id TEXT NOT NULL, role_id TEXT NOT NULL,
			name TEXT NOT NULL, color INTEGER NOT NULL, position INTEGER NOT NULL,
			permissions TEXT NOT NULL, managed INTEGER NOT NULL, mentionable INTEGER NOT NULL,
			synced_at TEXT NOT NULL, PRIMARY KEY (source_bot_id, guild_id, role_id)
		);
		CREATE TABLE IF NOT EXISTS rg_discord_channels (
			source_bot_id TEXT NOT NULL, guild_id TEXT NOT NULL, channel_id TEXT NOT NULL,
			name TEXT NOT NULL, type INTEGER NOT NULL, parent_id TEXT, position INTEGER,
			synced_at TEXT NOT NULL, PRIMARY KEY (source_bot_id, guild_id, channel_id)
		);
		CREATE TABLE IF NOT EXISTS rg_discord_emojis (
			source_bot_id TEXT NOT NULL, guild_id TEXT NOT NULL, emoji_id TEXT NOT NULL,
			name TEXT, animated INTEGER NOT NULL, available INTEGER NOT NULL, url TEXT NOT NULL,
			synced_at TEXT NOT NULL, PRIMARY KEY (source_bot_id, guild_id, emoji_id)
		);
		CREATE TABLE IF NOT EXISTS rg_discord_events (
			source_bot_id TEXT NOT NULL, guild_id TEXT NOT NULL, event_id TEXT NOT NULL,
			name TEXT NOT NULL, description TEXT, status INTEGER NOT NULL, entity_type INTEGER NOT NULL,
			starts_at TEXT, ends_at TEXT, channel_id TEXT, location TEXT,
			synced_at TEXT NOT NULL, PRIMARY KEY (source_bot_id, guild_id, event_id)
		);
		CREATE TABLE IF NOT EXISTS rg_discord_sync_runs (
			source_bot_id TEXT NOT NULL, guild_id TEXT NOT NULL, profile TEXT NOT NULL,
			member_count INTEGER NOT NULL, role_count INTEGER NOT NULL,
			channel_count INTEGER NOT NULL, members_complete INTEGER NOT NULL,
			synced_at TEXT NOT NULL, PRIMARY KEY (source_bot_id, guild_id)
		);
		CREATE TABLE IF NOT EXISTS rg_discord_guild_presence (
			source_bot_id TEXT NOT NULL, guild_id TEXT NOT NULL, profile TEXT NOT NULL,
			present INTEGER NOT NULL, changed_at TEXT NOT NULL,
			PRIMARY KEY (source_bot_id, guild_id)
		);
	`);
	return db;
}

async function cacheSummary(source: DiscordSnapshotSource, report: DiscordGuildSnapshotReport): Promise<void> {
	const url = Bun.env.RG_DISCORD_SYNC_REDIS_URL ?? Bun.env.REDIS_URL;
	if (!url) return;
	const redis = new RedisClient(url);
	try {
		await redis.set(`rg:discord-sync:${source.sourceBotId}:${report.guildId}`, JSON.stringify(report), "EX", 3600);
	} catch (error) {
		console.warn("[discord-sync] Redis summary unavailable:", error instanceof Error ? error.message : String(error));
	} finally {
		redis.close();
	}
}

/** A guild departure affects only the bot identity that observed it. */
export function markDiscordGuildLeft(source: DiscordSnapshotSource, guildId: string): void {
	const db = openDiscordSnapshot();
	if (!db) return;
	try {
		db.query(`INSERT INTO rg_discord_guild_presence VALUES (?, ?, ?, 0, ?)
			ON CONFLICT(source_bot_id,guild_id) DO UPDATE SET profile=excluded.profile,
			present=0,changed_at=excluded.changed_at`)
			.run(source.sourceBotId, guildId, source.profile, new Date().toISOString());
	} finally {
		db.close();
	}
}

function memberValues(member: GuildMember, sourceBotId: string, syncedAt: string) {
	return [sourceBotId, member.guild.id, member.id, member.user.username,
		member.user.globalName, member.nickname,
		member.avatarURL({ size: 256, extension: "webp" }) ?? member.user.avatarURL({ size: 256, extension: "webp" }),
		member.joinedAt?.toISOString() ?? null, member.premiumSince?.toISOString() ?? null,
		Number(member.user.bot), JSON.stringify([...member.roles.cache.keys()].filter((id) => id !== member.guild.id)), syncedAt] as const;
}

export async function syncDiscordGuildSnapshot(
	guild: Guild,
	source: DiscordSnapshotSource,
	options: { members?: ReadonlyMap<string, GuildMember> } = {},
): Promise<DiscordGuildSnapshotReport | null> {
	const db = openDiscordSnapshot();
	if (!db) return null;
	try {
		const [roles, channels, emojiResult, eventResult, threadResult] = await Promise.all([
			guild.roles.fetch(), guild.channels.fetch(),
			guild.emojis.fetch().then((value) => ({ value, complete: true })).catch(() => ({ value: guild.emojis.cache, complete: false })),
			guild.scheduledEvents.fetch().then((value) => ({ value, complete: true })).catch(() => ({ value: guild.scheduledEvents.cache, complete: false })),
			guild.channels.fetchActiveThreads().then((value) => ({ value: value.threads, complete: true })).catch(() => ({ value: guild.channels.cache.filter((channel) => channel.isThread()), complete: false })),
		]);
		// A missing GuildMembers intent cannot be treated as a complete roster.
		const hasMembersIntent = guild.client.options.intents.has(GUILD_MEMBERS_INTENT);
		const members = options.members ?? (hasMembersIntent ? await guild.members.fetch() : guild.members.cache);
		const syncedAt = new Date().toISOString();
		const insertGuild = db.query(`INSERT INTO rg_discord_guilds VALUES (?, ?, ?, ?, ?, ?, ?, ?)
			ON CONFLICT(source_bot_id,guild_id) DO UPDATE SET profile=excluded.profile,name=excluded.name,
			icon_url=excluded.icon_url,description=excluded.description,member_count=excluded.member_count,synced_at=excluded.synced_at`);
		const insertMember = db.query(`INSERT INTO rg_discord_members VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			ON CONFLICT(source_bot_id,guild_id,member_id) DO UPDATE SET username=excluded.username,
			global_name=excluded.global_name,nickname=excluded.nickname,avatar_url=excluded.avatar_url,
			joined_at=excluded.joined_at,premium_since=excluded.premium_since,is_bot=excluded.is_bot,
			role_ids_json=excluded.role_ids_json,synced_at=excluded.synced_at`);
		const insertRole = db.query(`INSERT INTO rg_discord_roles VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			ON CONFLICT(source_bot_id,guild_id,role_id) DO UPDATE SET name=excluded.name,color=excluded.color,
			position=excluded.position,permissions=excluded.permissions,managed=excluded.managed,
			mentionable=excluded.mentionable,synced_at=excluded.synced_at`);
		const insertChannel = db.query(`INSERT INTO rg_discord_channels VALUES (?, ?, ?, ?, ?, ?, ?, ?)
			ON CONFLICT(source_bot_id,guild_id,channel_id) DO UPDATE SET name=excluded.name,type=excluded.type,
			parent_id=excluded.parent_id,position=excluded.position,synced_at=excluded.synced_at`);
		const insertEmoji = db.query(`INSERT INTO rg_discord_emojis VALUES (?, ?, ?, ?, ?, ?, ?, ?)
			ON CONFLICT(source_bot_id,guild_id,emoji_id) DO UPDATE SET name=excluded.name,
			animated=excluded.animated,available=excluded.available,url=excluded.url,synced_at=excluded.synced_at`);
		const insertEvent = db.query(`INSERT INTO rg_discord_events VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			ON CONFLICT(source_bot_id,guild_id,event_id) DO UPDATE SET name=excluded.name,
			description=excluded.description,status=excluded.status,entity_type=excluded.entity_type,
			starts_at=excluded.starts_at,ends_at=excluded.ends_at,channel_id=excluded.channel_id,
			location=excluded.location,synced_at=excluded.synced_at`);
		const insertRun = db.query(`INSERT INTO rg_discord_sync_runs VALUES (?, ?, ?, ?, ?, ?, ?, ?)
			ON CONFLICT(source_bot_id,guild_id) DO UPDATE SET profile=excluded.profile,member_count=excluded.member_count,
			role_count=excluded.role_count,channel_count=excluded.channel_count,
			members_complete=excluded.members_complete,synced_at=excluded.synced_at`);
		const insertPresence = db.query(`INSERT INTO rg_discord_guild_presence VALUES (?, ?, ?, 1, ?)
			ON CONFLICT(source_bot_id,guild_id) DO UPDATE SET profile=excluded.profile,
			present=1,changed_at=excluded.changed_at`);
		const report: DiscordGuildSnapshotReport = {
			guildId: guild.id, memberCount: members.size, roleCount: roles.size,
			channelCount: channels.size, emojiCount: emojiResult.value.size,
			eventCount: eventResult.value.size, activeThreadCount: threadResult.value.size,
			membersComplete: hasMembersIntent, emojisComplete: emojiResult.complete,
			eventsComplete: eventResult.complete, activeThreadsComplete: threadResult.complete, syncedAt,
		};
		db.transaction(() => {
			insertGuild.run(source.sourceBotId, source.profile, guild.id, guild.name, guild.iconURL(), guild.description, guild.memberCount, syncedAt);
			for (const member of members.values()) insertMember.run(...memberValues(member, source.sourceBotId, syncedAt));
			for (const role of roles.values()) insertRole.run(source.sourceBotId, guild.id, role.id, role.name, role.color, role.position, role.permissions.bitfield.toString(), Number(role.managed), Number(role.mentionable), syncedAt);
			for (const channel of channels.values()) if (channel) insertChannel.run(source.sourceBotId, guild.id, channel.id, channel.name, channel.type, channel.parentId, channel.position, syncedAt);
			for (const channel of threadResult.value.values()) if (channel) insertChannel.run(source.sourceBotId, guild.id, channel.id, channel.name, channel.type, channel.parentId, null, syncedAt);
			for (const emoji of emojiResult.value.values()) insertEmoji.run(source.sourceBotId, guild.id, emoji.id, emoji.name, Number(emoji.animated), Number(emoji.available), emoji.url, syncedAt);
			for (const event of eventResult.value.values()) insertEvent.run(source.sourceBotId, guild.id, event.id, event.name, event.description, event.status, event.entityType, event.scheduledStartAt?.toISOString() ?? null, event.scheduledEndAt?.toISOString() ?? null, event.channelId, event.entityMetadata?.location ?? null, syncedAt);
			insertRun.run(source.sourceBotId, guild.id, source.profile, report.memberCount, report.roleCount, report.channelCount, Number(report.membersComplete), syncedAt);
			insertPresence.run(source.sourceBotId, guild.id, source.profile, syncedAt);
		})();
		await cacheSummary(source, report);
		return report;
	} finally {
		db.close();
	}
}
