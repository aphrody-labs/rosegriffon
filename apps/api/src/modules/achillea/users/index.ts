import { Elysia, status, t } from "elysia";
import { dbPlugin } from "../../../plugins/db";
import { LeaderboardService } from "../leaderboard/service";
import { UsersModel } from "./model";
import { resolveAchilleaSession } from "../../auth/session";

/** Compatibility resource for the versioned client; the query lives in one service. */
export const usersController = new Elysia({ prefix: "/users" })
	.use(dbPlugin)
	.get("/me", async ({ db, headers }) => {
		const session = await resolveAchilleaSession(headers);
		if (!session) return status(401, { message: "Authentication required" as const });
		const user = await db.selectFrom("user")
			.select(["id", "username", "display_name", "avatar", "role"])
			.where("id", "=", session.id)
			.executeTakeFirst();
		if (!user) return status(404, { message: "User not found" as const });
		const clan = await db.selectFrom("clan_member").select("clan_id").where("user_id", "=", session.id).executeTakeFirst();
		const connection = await db.selectFrom("user_connection").select("user_id")
			.where("user_id", "=", session.id).where("provider", "=", "challonge").executeTakeFirst();
		const avatar = user.avatar
			? user.avatar.startsWith("http") ? user.avatar : `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`
			: `https://cdn.discordapp.com/embed/avatars/${(BigInt(user.id) >> 22n) % 6n}.png`;
		return {
			id: user.id, username: user.username ?? session.username ?? "", displayName: user.display_name ?? "",
			avatar, role: Number(user.role ?? 0), clanId: clan?.clan_id ?? null, hasChallonge: Boolean(connection),
		};
	}, {
		response: {
			200: UsersModel.enriched,
			401: t.Object({ message: t.Literal("Authentication required") }),
			404: t.Object({ message: t.Literal("User not found") }),
		},
	})
	.put("/me/profile", async ({ db, headers, body }) => {
		const session = await resolveAchilleaSession(headers);
		if (!session) return status(401, { message: "Authentication required" as const });
		const bio = body.bio?.trim() || null;
		const twitchUrl = body.twitchUrl?.trim() || null;
		if (bio && bio.length > 500) return status(400, { message: "Bio too long" as const });
		if (twitchUrl) {
			try {
				if (new URL(twitchUrl).hostname.replace(/^www\./, "") !== "twitch.tv") throw new Error();
			} catch {
				return status(400, { message: "Invalid Twitch URL" as const });
			}
		}
		const current = await db.selectFrom("user").select(["id", "username", "display_name", "avatar", "bio", "twitch_url"]).where("id", "=", session.id).executeTakeFirst();
		if (!current) return status(404, { message: "User not found" as const });
		const updated = await db.updateTable("user").set({ bio: body.bio === undefined ? current.bio : bio, twitch_url: body.twitchUrl === undefined ? current.twitch_url : twitchUrl }).where("id", "=", session.id).returning(["id", "username", "display_name", "avatar", "bio", "twitch_url"]).executeTakeFirstOrThrow();
		return { id: updated.id, username: updated.username, displayName: updated.display_name, avatar: updated.avatar, bio: updated.bio, twitchUrl: updated.twitch_url };
	}, {
		body: t.Object({ bio: t.Optional(t.Nullable(t.String({ maxLength: 2000 }))), twitchUrl: t.Optional(t.Nullable(t.String({ maxLength: 500 }))) }),
		response: { 200: UsersModel.profile, 400: t.Object({ message: t.String() }), 401: t.Object({ message: t.Literal("Authentication required") }), 404: t.Object({ message: t.Literal("User not found") }) },
	})
	.get("/leaderboard", async ({ db, query }) => {
		const mode = Number(query.mode ?? 2);
		const season = query.season?.trim() || null;
		const page = await LeaderboardService.findTop(db, mode, season, query.limit, query.offset);
		return { entries: page.data, total: page.count, mode };
	}, {
		query: t.Object({
			mode: t.Optional(t.Numeric()), season: t.Optional(t.String()),
			limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100 })),
			offset: t.Optional(t.Numeric({ minimum: 0 })),
		}),
		response: { 200: UsersModel.leaderboard },
	});
