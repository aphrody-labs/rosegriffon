import type { Guild, GuildMember, User } from "discord.js";
import type { DiscordMember as MemberRow } from "@rose-griffon/types";

import { sql } from "../lib/db";

function resolveAvatarUrl(member: GuildMember): string | null {
	const guildAvatar = member.avatarURL({ size: 256, extension: "webp" });
	if (guildAvatar) return guildAvatar;
	const userAvatar = member.user.avatarURL({ size: 256, extension: "webp" });
	if (userAvatar) return userAvatar;
	return member.user.defaultAvatarURL ?? null;
}

function resolveUserAvatarUrl(user: User): string | null {
	return user.avatarURL({ size: 256, extension: "webp" }) ?? user.defaultAvatarURL ?? null;
}

export function memberToRow(member: GuildMember): MemberRow {
	const roleIds = [...member.roles.cache.keys()].filter((id) => id !== member.guild.id);
	return {
		discord_id: member.id,
		username: member.user.username,
		display_name: member.user.globalName ?? null,
		nickname: member.nickname ?? null,
		avatar_url: resolveAvatarUrl(member),
		joined_at: member.joinedAt?.toISOString() ?? null,
		premium_since: member.premiumSince?.toISOString() ?? null,
		roles: roleIds,
		is_bot: member.user.bot,
		updated_at: new Date().toISOString(),
	};
}

function toPgTextArray(values: string[]): string {
	return `{${values.map((v) => `"${v.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`).join(",")}}`;
}

async function upsertRow(row: MemberRow): Promise<void> {
	const rolesLiteral = toPgTextArray(row.roles || []);
	await sql`
    INSERT INTO discord_members (
      discord_id, username, display_name, nickname,
      avatar_url, joined_at, premium_since, roles, is_bot, updated_at
    ) VALUES (
      ${row.discord_id}, ${row.username}, ${row.display_name}, ${row.nickname},
      ${row.avatar_url}, ${row.joined_at}, ${row.premium_since}, ${rolesLiteral}::text[], ${row.is_bot}, NOW()
    )
    ON CONFLICT (discord_id) DO UPDATE SET
      username = EXCLUDED.username,
      display_name = EXCLUDED.display_name,
      nickname = EXCLUDED.nickname,
      avatar_url = EXCLUDED.avatar_url,
      joined_at = COALESCE(EXCLUDED.joined_at, discord_members.joined_at),
      premium_since = EXCLUDED.premium_since,
      roles = EXCLUDED.roles,
      is_bot = EXCLUDED.is_bot,
      updated_at = NOW()
  `;
}

async function syncUserImage(discordId: string, avatarUrl: string | null): Promise<void> {
	if (!avatarUrl) return;
	await sql`
    UPDATE "user" u
    SET image = ${avatarUrl}, updated_at = NOW()
    FROM account a
    WHERE a.user_id = u.id AND a.provider_id = 'discord' AND a.account_id = ${discordId}
  `;
}

export interface SyncReport {
	fetched: number;
	upserted: number;
	errors: { discordId: string; reason: string }[];
	durationMs: number;
}

export async function syncAllMembers(guild: Guild): Promise<SyncReport> {
	const start = Date.now();
	const members = await guild.members.fetch();
	const errors: SyncReport["errors"] = [];
	let upserted = 0;

	for (const member of members.values()) {
		try {
			const row = memberToRow(member);
			await upsertRow(row);
			await syncUserImage(row.discord_id, row.avatar_url);
			upserted++;
		} catch (err) {
			errors.push({
				discordId: member.id,
				reason: err instanceof Error ? err.message : String(err),
			});
		}
	}

	return {
		fetched: members.size,
		upserted,
		errors,
		durationMs: Date.now() - start,
	};
}

export async function syncOneMember(member: GuildMember): Promise<void> {
	const row = memberToRow(member);
	await upsertRow(row);
	await syncUserImage(row.discord_id, row.avatar_url);
}

export async function syncOneUser(user: User, guild: Guild): Promise<void> {
	const member =
		guild.members.cache.get(user.id) ?? (await guild.members.fetch(user.id).catch(() => null));
	if (member) {
		await syncOneMember(member);
		return;
	}
	await sql`
    UPDATE discord_members
    SET username = ${user.username},
        display_name = ${user.globalName ?? null},
        avatar_url = ${resolveUserAvatarUrl(user)},
        is_bot = ${user.bot},
        updated_at = NOW()
    WHERE discord_id = ${user.id}
  `;
	await syncUserImage(user.id, resolveUserAvatarUrl(user));
}
