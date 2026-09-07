import {
	BodyParams,
	Context,
	Controller,
	Delete,
	Get,
	PathParams,
	Post,
	Put,
	QueryParams,
	Res,
	UseBefore,
} from "@tsed/common";
import { BadRequest } from "@tsed/exceptions";
import { Default, Maximum, Minimum } from "@tsed/schema";
import type { Response } from "express";

import { CookieAuthorize } from "@/api/middlewares";
import type { UserDTO } from "@/services";
import { PlayerNoteService } from "@/services";
import { BaseController } from "@/utils/classes";
import { PlayerNoteCategory, PlayerNoteSeverity } from "@/utils/enums";
import { resolveDependenciesSync } from "@/utils/functions";

import { BlacklistedAuthorize } from "../middlewares/blacklistedAuthorize";

interface CreateNoteBody {
	targetId: string;
	tournamentId?: number | null;
	category?: PlayerNoteCategory;
	severity?: PlayerNoteSeverity;
	content: string;
}

interface UpdateNoteBody {
	content?: string;
	category?: PlayerNoteCategory;
	severity?: PlayerNoteSeverity;
}

/**
 * Notes du staff sur les joueurs — l'espace où les organisateurs consignent ce qu'ils
 * ont à dire d'un joueur pendant un tournoi, lisible des autres membres du staff.
 *
 * Aucune de ces routes n'est publique, et rien n'est jamais renvoyé au joueur
 * concerné : le service tranche à chaque appel entre « staff » (accès complet) et
 * « organisateur » (le périmètre de son tournoi).
 */
@Controller("/player-notes")
export class PlayerNotesController extends BaseController {
	private notes: PlayerNoteService;

	constructor() {
		super();
		[this.notes] = resolveDependenciesSync([PlayerNoteService]);
	}

	/**
	 * GET /player-notes — liste filtrée.
	 * Un organisateur non-staff doit passer `tournamentId` : c'est son seul périmètre.
	 */
	@Get("/")
	@UseBefore(CookieAuthorize)
	async list(
		@QueryParams("targetId") targetId: string | undefined,
		@QueryParams("tournamentId") tournamentId: number | undefined,
		@QueryParams("category") category: PlayerNoteCategory | undefined,
		@QueryParams("severity") severity: PlayerNoteSeverity | undefined,
		@QueryParams("resolved") resolved: string | undefined,
		@QueryParams("search") search: string | undefined,
		@QueryParams("page") @Default(1) @Minimum(1) page: number,
		@QueryParams("pageSize") @Default(50) @Minimum(1) @Maximum(100) pageSize: number,
		@Context("user") user: UserDTO,
		@Res() res: Response
	) {
		const { isStaff } = await this.notes.assertCanAccess(user.id, tournamentId ?? null);

		const { items, total } = await this.notes.list({
			targetId,
			// Un organisateur non-staff n'arrive ici qu'avec un `tournamentId` validé
			// par `assertCanAccess` : le filtre l'enferme donc dans son tournoi.
			tournamentId,
			category,
			severity,
			resolved: resolved === undefined ? undefined : resolved === "true",
			search,
			page,
			pageSize,
		});

		// Données de modération : jamais mises en cache par un intermédiaire.
		res.setHeader("Cache-Control", "private, no-store");

		return res.status(200).json({
			data: items.map((n) => this.notes.toDTO(n)),
			total,
			meta: { page, pageSize, pageCount: Math.ceil(total / pageSize), isStaff },
		});
	}

	/** GET /player-notes/summary/:userId — compteurs pour une fiche joueur (staff). */
	@Get("/summary/:userId")
	@UseBefore(CookieAuthorize)
	async summary(
		@PathParams("userId") userId: string,
		@Context("user") user: UserDTO,
		@Res() res: Response
	) {
		await this.notes.assertCanAccess(user.id, null);

		res.setHeader("Cache-Control", "private, no-store");

		return res.status(200).json(await this.notes.summaryForUser(userId));
	}

	@Post("/")
	@UseBefore(CookieAuthorize, BlacklistedAuthorize)
	async create(
		@BodyParams() body: CreateNoteBody,
		@Context("user") user: UserDTO,
		@Res() res: Response
	) {
		if (!body?.targetId) throw new BadRequest("Le joueur concerné est obligatoire.");

		await this.notes.assertCanAccess(user.id, body.tournamentId ?? null);

		const note = await this.notes.create({
			targetId: body.targetId,
			authorId: user.id,
			tournamentId: body.tournamentId ?? null,
			category: body.category,
			severity: body.severity,
			content: body.content,
		});

		return res.status(201).json(this.notes.toDTO(note));
	}

	@Put("/:id")
	@UseBefore(CookieAuthorize, BlacklistedAuthorize)
	async update(
		@PathParams("id") id: string,
		@BodyParams() body: UpdateNoteBody,
		@Context("user") user: UserDTO,
		@Res() res: Response
	) {
		await this.notes.assertCanAccess(user.id, null);

		const note = await this.notes.update(id, user.id, body ?? {});

		return res.status(200).json(this.notes.toDTO(note));
	}

	@Post("/:id/resolve")
	@UseBefore(CookieAuthorize, BlacklistedAuthorize)
	async resolve(
		@PathParams("id") id: string,
		@Context("user") user: UserDTO,
		@Res() res: Response
	) {
		await this.notes.assertCanAccess(user.id, null);

		return res.status(200).json(this.notes.toDTO(await this.notes.setResolved(id, user.id, true)));
	}

	@Post("/:id/reopen")
	@UseBefore(CookieAuthorize, BlacklistedAuthorize)
	async reopen(@PathParams("id") id: string, @Context("user") user: UserDTO, @Res() res: Response) {
		await this.notes.assertCanAccess(user.id, null);

		return res.status(200).json(this.notes.toDTO(await this.notes.setResolved(id, user.id, false)));
	}

	@Delete("/:id")
	@UseBefore(CookieAuthorize, BlacklistedAuthorize)
	async remove(@PathParams("id") id: string, @Context("user") user: UserDTO, @Res() res: Response) {
		await this.notes.assertCanAccess(user.id, null);

		await this.notes.remove(id, user.id);

		return res.status(200).json({ success: true });
	}
}
