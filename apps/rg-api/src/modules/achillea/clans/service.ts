import type { Kysely } from "kysely";
import type { Database } from "@rosegriffon/db/schema";
import { normalizeNames } from "@rosegriffon/achillea-core";
import type { ClanDTO } from "./model";

type ClanUpdate = {
	name?: string; shortenedName?: string; clanBiography?: string; clanAvatarUrl?: string;
	xUrl?: string | null; instagramUrl?: string | null; tiktokUrl?: string | null;
	isRecruiting?: boolean; autoAcceptMembers?: boolean; isInactive?: boolean;
};

function socialUrl(value: string, platform: "x" | "instagram" | "tiktok"): string | null {
	try {
		const parsed = new URL(value);
		const host = parsed.hostname.replace(/^www\./, "");
		const parts = parsed.pathname.split("/").filter(Boolean);
		if (parts.length < 1) return null;
		let username = parts[0];
		const matches = platform === "x" ? host === "x.com" || host === "twitter.com"
			: host === `${platform}.com`;
		if (!matches) return null;
		if (platform === "tiktok") username = username.replace(/^@/, "");
		if (!/^[\w.-]{1,30}$/.test(username)) return null;
		return platform === "x" ? `https://x.com/${username}`
			: platform === "tiktok" ? `https://tiktok.com/@${username}`
			: `https://instagram.com/${username}`;
	} catch { return null; }
}

export abstract class ClanService {
	private static graphemeCount(value: string): number {
		return Array.from(new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(value)).length;
	}

	public static async validateName(db: Kysely<Database>, name: string) {
		const normalizedName = normalizeNames(name);
		if (this.graphemeCount(name) < 3 || this.graphemeCount(name) > 30 || !normalizedName) {
			return { valid: false as const, code: "INVALID_NAME" as const };
		}
		const duplicate = await db.selectFrom("clan").select("id").where("normalized_name", "=", normalizedName).executeTakeFirst();
		return duplicate ? { valid: false as const, code: "NAME_TAKEN" as const } : { valid: true as const };
	}

	public static async validateShortName(db: Kysely<Database>, shortName: string) {
		const normalizedShortName = normalizeNames(shortName);
		if (this.graphemeCount(shortName) < 2 || this.graphemeCount(shortName) > 3 || !normalizedShortName || !/^[^\s]+$/.test(normalizedShortName)) {
			return { valid: false as const, code: "INVALID_SHORTNAME" as const };
		}
		const duplicate = await db.selectFrom("clan").select("id").where("normalized_short_name", "=", normalizedShortName).executeTakeFirst();
		return duplicate ? { valid: false as const, code: "SHORTNAME_TAKEN" as const } : { valid: true as const };
	}

	public static async update(db: Kysely<Database>, clanId: number, actorId: string, patch: ClanUpdate) {
		const result = await db.transaction().execute(async (trx) => {
			const actor = await trx.selectFrom("user").select("role").where("id", "=", actorId).executeTakeFirst();
			if (!actor) return { ok: false as const, status: 401, message: "Authentication required" };
			const clan = await trx.selectFrom("clan").selectAll().where("id", "=", clanId).forUpdate().executeTakeFirst();
			if (!clan) return { ok: false as const, status: 404, message: "Clan not found" };
			const membership = await trx.selectFrom("clan_member").select("role").where("clan_id", "=", clanId).where("user_id", "=", actorId).executeTakeFirst();
			const isAdmin = Number(actor.role ?? 0) >= 2;
			if (!isAdmin && (!membership || Number(membership.role) < 3)) return { ok: false as const, status: 403, message: "Reserved for clan captain or administrator" };
			if (!isAdmin && patch.isInactive !== undefined) return { ok: false as const, status: 403, message: "Only administrators can change inactivity" };

			let name = clan.name;
			let normalizedName = clan.normalized_name;
			if (patch.name !== undefined && patch.name !== clan.name) {
				const validation = await this.validateName(trx, patch.name);
				if (!validation.valid) return { ok: false as const, status: 400, message: validation.code === "NAME_TAKEN" ? "Ce nom de clan est déjà pris." : "Nom invalide (3 à 30 caractères)." };
				name = patch.name; normalizedName = normalizeNames(patch.name);
			}
			let shortenedName = clan.shortened_name;
			let normalizedShortName = clan.normalized_short_name;
			if (patch.shortenedName !== undefined && patch.shortenedName !== clan.shortened_name) {
				const validation = await this.validateShortName(trx, patch.shortenedName);
				if (!validation.valid) return { ok: false as const, status: 400, message: validation.code === "SHORTNAME_TAKEN" ? "Ce tag de clan est déjà pris." : "Tag invalide (2 à 3 caractères, sans espace)." };
				shortenedName = patch.shortenedName; normalizedShortName = normalizeNames(patch.shortenedName);
			}
			if (patch.clanBiography !== undefined && patch.clanBiography.length > 1500) return { ok: false as const, status: 400, message: "Biographie trop longue (1500 caractères max)." };
			let avatarUrl = clan.clan_avatar_url;
			if (patch.clanAvatarUrl !== undefined && patch.clanAvatarUrl !== clan.clan_avatar_url) {
				if (!patch.clanAvatarUrl) return { ok: false as const, status: 400, message: "Logo invalide." };
				const duplicate = await trx.selectFrom("clan").select("id").where("clan_avatar_url", "=", patch.clanAvatarUrl).where("id", "!=", clanId).executeTakeFirst();
				if (duplicate) return { ok: false as const, status: 400, message: "Cette image est déjà utilisée par un autre clan." };
				avatarUrl = patch.clanAvatarUrl;
			}
			const social = (value: string | null | undefined, platform: "x" | "instagram" | "tiktok", current: string | null) => {
				if (value === undefined) return current;
				const input = value ?? "";
				if (!input.trim()) return null;
				const canonical = socialUrl(input, platform);
				if (!canonical) throw new Error(`Lien ${platform === "x" ? "X/Twitter" : platform} invalide.`);
				return canonical;
			};
			let xUrl: string | null; let instagramUrl: string | null; let tiktokUrl: string | null;
			try { xUrl = social(patch.xUrl, "x", clan.x_url); instagramUrl = social(patch.instagramUrl, "instagram", clan.instagram_url); tiktokUrl = social(patch.tiktokUrl, "tiktok", clan.tiktok_url); }
			catch (error) { return { ok: false as const, status: 400, message: error instanceof Error ? error.message : "Lien social invalide." }; }
			const updated = await trx.updateTable("clan").set({
				name, normalized_name: normalizedName, shortened_name: shortenedName, normalized_short_name: normalizedShortName,
				clan_biography: patch.clanBiography ?? clan.clan_biography, clan_avatar_url: avatarUrl,
				x_url: xUrl, instagram_url: instagramUrl, tiktok_url: tiktokUrl,
				is_recruiting: patch.isRecruiting ?? clan.is_recruiting, auto_accept_members: patch.autoAcceptMembers ?? clan.auto_accept_members,
				is_inactive: patch.isInactive ?? clan.is_inactive, updated_at: new Date(),
			}).where("id", "=", clanId).returningAll().executeTakeFirstOrThrow();
			return { ok: true as const, previousName: clan.name, roleId: clan.role_id, clan: {
				id: updated.id, name: updated.name, shortName: updated.shortened_name, avatarUrl: updated.clan_avatar_url,
				biography: updated.clan_biography, fame: updated.clan_fame, isRecruiting: Boolean(updated.is_recruiting), membersLimit: Boolean(updated.under_member_limit),
			} };
		});
		return result;
	}

	public static async findAll(db: Kysely<Database>, page = 1, pageSize = 50): Promise<{ data: ClanDTO[]; count: number }> {
		const base = db
			.selectFrom("clan")
			.selectAll()
			.where("is_disbanded", "=", false);
		const [rows, countRow] = await Promise.all([
			base.orderBy("clan_fame", "desc").limit(pageSize).offset((page - 1) * pageSize).execute(),
			db.selectFrom("clan").select(({ fn }) => fn.countAll<number>().as("count")).where("is_disbanded", "=", false).executeTakeFirst(),
		]);

		const data: ClanDTO[] = rows.map((r) => ({
			id: r.id,
			name: r.name,
			shortName: r.shortened_name,
			avatarUrl: r.clan_avatar_url,
			biography: r.clan_biography,
			fame: r.clan_fame,
			isRecruiting: Boolean(r.is_recruiting),
			membersLimit: Boolean(r.under_member_limit)
		}));

		return { data, count: Number(countRow?.count ?? data.length) };
	}

	public static async findById(db: Kysely<Database>, id: number): Promise<ClanDTO | null> {
		const r = await db
			.selectFrom("clan")
			.selectAll()
			.where("id", "=", id)
			.executeTakeFirst();

		if (!r) return null;

		return {
			id: r.id,
			name: r.name,
			shortName: r.shortened_name,
			avatarUrl: r.clan_avatar_url,
			biography: r.clan_biography,
			fame: r.clan_fame,
			isRecruiting: Boolean(r.is_recruiting),
			membersLimit: Boolean(r.under_member_limit)
		};
	}
}
