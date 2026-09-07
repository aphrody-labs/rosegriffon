import {
	BodyParams,
	Context,
	Controller,
	Get,
	PathParams,
	Post,
	Put,
	QueryParams,
	Res,
	UseBefore,
} from "@tsed/common";
import { BadRequest, NotFound, Unauthorized } from "@tsed/exceptions";
import type { Response } from "express";

import { CookieAuthorize } from "@/api/middlewares";
import {
	Database,
	CustomImagesUpload,
	LeaderboardService,
	PlayerCardService,
	UserService,
} from "@/services";
import type { UserDTO } from "@/services";
import { BaseController } from "@/utils/classes";
import { MatchMode, UserRole } from "@/utils/enums";
import { resolveDependenciesSync } from "@/utils/functions";

@Controller("/users")
export class UsersController extends BaseController {
	private userService: UserService;
	private imageService: CustomImagesUpload;
	private cardService: PlayerCardService;
	private leaderboardService: LeaderboardService;
	private db: Database;

	constructor() {
		super();

		[this.userService, this.imageService, this.cardService, this.leaderboardService, this.db] =
			resolveDependenciesSync([
				UserService,
				CustomImagesUpload,
				PlayerCardService,
				LeaderboardService,
				Database,
			]);
	}

	// IMPORTANT : routes statiques AVANT @Get('/:id') sinon Express matche le wildcard.

	// Indexe / met en cache les avatars Discord de la cohorte (staff, joueurs actifs,
	// membres de clan) dans user.avatar → le ranked (ranked/db.ts), le leaderboard et les
	// membres de clan les lisent sans fetch Discord. Lancé en arrière-plan (~1-2 min). Admin.
	@Post("/resync-avatars")
	@UseBefore(CookieAuthorize)
	resyncAvatars(@Context() ctx: Context, @Res() res: Response) {
		const user = ctx.get("user") as UserDTO | undefined;
		if (!user || (user.role ?? 0) < UserRole.Administrator) {
			return res.status(403).json({ error: "Réservé au staff" });
		}
		void this.userService.resyncAvatars().catch((e) => console.error("[resync-avatars]", e));
		return res.json({ started: true });
	}

	@Get("/leaderboard")
	async leaderboard(
		@Res() res: Response,
		@QueryParams("mode") mode: number = 2,
		@QueryParams("season") seasonId: string | null = null,
		@QueryParams("limit") limit: number = 50,
		@QueryParams("offset") offset: number = 0
	) {
		const safeLimit = Math.max(1, Math.min(100, Number(limit) || 50));
		const safeOffset = Math.max(0, Number(offset) || 0);
		const safeMode: MatchMode = Number(mode) === 4 ? MatchMode.TWO_VS_TWO : MatchMode.ONE_VS_ONE;

		const page = await this.leaderboardService.getTop(
			seasonId || null,
			safeMode,
			safeLimit,
			safeOffset
		);

		// Enrichissement batch : 1 query IN au lieu de N+1 getUserDTO.
		// Avant : ~500ms pour 50 users (50 round-trips Mikro-ORM/Discord cache).
		// Apres : <50ms avec un seul SELECT IN sur la table user.
		const userIds = page.entries.map((e) => e.userId);
		const userMap = new Map<
			string,
			{ display_name: string | null; username: string | null; avatar: string | null }
		>();
		if (userIds.length > 0) {
			const conn = this.db.em.getConnection();
			const placeholders = userIds.map(() => "?").join(",");
			const userRows = await conn.execute(
				`SELECT id, display_name, username, avatar FROM "user" WHERE id IN (${placeholders})`,
				userIds
			);
			for (const u of userRows as Array<{
				id: string;
				display_name: string | null;
				username: string | null;
				avatar: string | null;
			}>) {
				userMap.set(u.id, { display_name: u.display_name, username: u.username, avatar: u.avatar });
			}
		}

		const enriched = page.entries.map((e) => {
			const u = userMap.get(e.userId);
			const display = u?.display_name ?? u?.username ?? e.userId;
			let avatar = "";
			if (u?.avatar) {
				avatar = u.avatar.startsWith("http")
					? u.avatar
					: `https://cdn.discordapp.com/avatars/${e.userId}/${u.avatar}.png`;
			} else {
				avatar = `https://cdn.discordapp.com/embed/avatars/${(BigInt(e.userId) >> 22n) % 6n}.png`;
			}
			return {
				rank: e.rank,
				userId: e.userId,
				displayName: display,
				avatar,
				elo: e.elo,
				peakRating: e.peakRating,
				gamesPlayed: e.gamesPlayed,
			};
		});

		// Cache CDN 30s + stale-while-revalidate 60s. Les ranks bougent peu
		// dans cette fenetre, et un SWR garantit que la donnee fraiche est servie
		// en arriere-plan apres expiration sans trou de service.
		res.setHeader("Cache-Control", "public, s-maxage=30, stale-while-revalidate=60");

		return { entries: enriched, total: page.total, mode: safeMode };
	}

	@Get("/me/ranked-history")
	@UseBefore(CookieAuthorize)
	async myRankedHistory(
		@Context("user") user: UserDTO,
		@QueryParams("mode") mode?: number,
		@QueryParams("limit") limit: number = 20,
		@QueryParams("offset") offset: number = 0
	) {
		const safeLimit = Math.max(1, Math.min(50, Number(limit) || 20));
		const safeOffset = Math.max(0, Number(offset) || 0);
		const safeMode = mode != null ? Number(mode) : null;

		return this.userService.getRankedMatchHistory(user.id, safeMode, safeLimit, safeOffset);
	}

	@Get("/me/ranked-trend")
	@UseBefore(CookieAuthorize)
	async myRankedTrend(
		@Context("user") user: UserDTO,
		@QueryParams("mode") mode?: number,
		@QueryParams("days") days: number = 7,
		@QueryParams("last") last: number = 20
	) {
		const safeMode = mode != null ? Number(mode) : null;
		const safeDays = Math.max(1, Math.min(90, Number(days) || 7));
		const safeLast = Math.max(1, Math.min(50, Number(last) || 20));

		return this.userService.getRankedTrend(user.id, safeMode, safeDays, safeLast);
	}

	/**
	 * Édite bio / lien Twitch — réservé au titulaire (userId vient de l'auth, jamais
	 * d'un path param, donc impossible d'éditer le profil de quelqu'un d'autre).
	 */
	@Put("/me/profile")
	@UseBefore(CookieAuthorize)
	async updateMyProfile(
		@Context("user") user: UserDTO,
		@BodyParams("bio") bio: string | undefined,
		@BodyParams("twitchUrl") twitchUrl: string | undefined
	) {
		return this.userService.updateOwnProfile(user.id, { bio, twitchUrl });
	}

	@Get("/:id")
	async getUser(@PathParams("id") id: string, @Res() res: Response) {
		const enrichedDTO = await this.userService.getEnrichedUserDTO(id);
		if (!enrichedDTO) throw new NotFound(`No user found for îd ${id}`);

		// Profil user enrichi : ELO/stats bougent par match, mais 30s reste OK
		// pour la perception. SWR 2min couvre les visites en rafale.
		res.setHeader("Cache-Control", "public, s-maxage=30, stale-while-revalidate=120");

		return enrichedDTO;
	}

	@Get("/:id/card.png")
	async getPlayerCard(@PathParams("id") id: string, @Res() res: Response) {
		try {
			const buf = await this.cardService.generateCard(id);
			res.setHeader("Content-Type", "image/png");
			res.setHeader("Content-Length", buf.length);
			res.setHeader("Cache-Control", "public, max-age=300");
			res.setHeader("Content-Disposition", `inline; filename="player-${id}-card.png"`);

			return res.status(200).send(buf);
		} catch (err: any) {
			if (err?.status === 404) throw err;

			throw new BadRequest(err?.message ?? "Erreur lors de la génération de la carte joueur");
		}
	}

	@Post("/:id/card/regenerate")
	@UseBefore(CookieAuthorize)
	async regeneratePlayerCard(
		@PathParams("id") id: string,
		@Context() ctx: Context,
		@Res() res: Response
	) {
		const executor = ctx.get("user");
		if (!executor) throw new Unauthorized("Non authentifié");

		try {
			const path = await this.cardService.generateAndSave(id);

			return res.status(200).json({ success: true, path });
		} catch (err: any) {
			if (err?.status === 404) throw err;

			return res
				.status(400)
				.json({ success: false, error: err?.message ?? "Génération impossible" });
		}
	}
}
