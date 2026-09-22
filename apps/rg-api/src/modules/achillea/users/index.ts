import { Elysia, status, t } from "elysia";
import { dbPlugin } from "../../../plugins/db";
import { LeaderboardService } from "../leaderboard/service";
import { UsersModel } from "./model";
import { resolveAchilleaSession } from "../../auth/session";

/** Compatibility resource for the versioned client; the query lives in one service. */
export const usersController = new Elysia({ prefix: "/users" })
	.use(dbPlugin)
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
