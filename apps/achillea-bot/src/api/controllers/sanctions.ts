import {
	BodyParams,
	Context,
	Controller,
	Get,
	PathParams,
	Post,
	QueryParams,
	Res,
	UseBefore,
} from "@tsed/common";
import { BadRequest, NotFound, Unauthorized } from "@tsed/exceptions";
import { Default, Maximum, Minimum } from "@tsed/schema";
import type { FilterQuery } from "@mikro-orm/core";
import type { Response } from "express";

import { CookieAuthorize } from "@/api/middlewares";
import { Sanction } from "@/entities";
import { Database, SanctionService } from "@/services";
import { BaseController } from "@/utils/classes";
import { SanctionIssuerType, SanctionType } from "@/utils/enums";
import { resolveDependenciesSync } from "@/utils/functions";

// =============================================================================
// Corps des requêtes
// =============================================================================

interface CreateSanctionBody {
	userId: string;
	guildId: string;
	type: SanctionType;
	reason?: string | null;
	durationSec?: number | null;
	evidence?: Record<string, unknown>[] | null;
}

interface RevokeSanctionBody {
	reason?: string;
}

interface AppealSanctionBody {
	message: string;
}

// =============================================================================
// Contrôleur
// =============================================================================

@Controller("/sanctions")
export class SanctionsController extends BaseController {
	private sanctionService: SanctionService;
	private db: Database;

	constructor() {
		super();
		[this.sanctionService, this.db] = resolveDependenciesSync([SanctionService, Database]);
	}

	/**
	 * GET /sanctions — liste paginée avec filtres optionnels
	 */
	@Get("/")
	@UseBefore(CookieAuthorize)
	async list(
		@QueryParams("userId") userId: string | undefined,
		@QueryParams("guildId") guildId: string | undefined,
		@QueryParams("type") type: SanctionType | undefined,
		@QueryParams("active") active: string | undefined,
		@QueryParams("page") @Default(1) @Minimum(1) page: number,
		@QueryParams("pageSize") @Default(50) @Minimum(1) @Maximum(100) pageSize: number,
		@Res() res: Response
	) {
		const em = this.db.em.fork();

		const where: FilterQuery<Sanction> = {};
		if (userId) where.userId = userId;
		if (guildId) where.guildId = guildId;
		if (type) where.type = type;
		if (active === "true") {
			where.revokedAt = null;
			where.$or = [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }];
		} else if (active === "false") {
			where.$or = [{ revokedAt: { $ne: null } }, { expiresAt: { $lte: new Date() } }];
		}

		const [items, total] = await em.findAndCount(Sanction, where as FilterQuery<Sanction>, {
			orderBy: { createdAt: "DESC" },
			limit: pageSize,
			offset: (page - 1) * pageSize,
		});

		return res.status(200).json({
			data: items,
			total,
			meta: {
				page,
				pageSize,
				pageCount: Math.ceil(total / pageSize),
			},
		});
	}

	/**
	 * POST /sanctions — créer une sanction (staff uniquement)
	 */
	@Post("/")
	@UseBefore(CookieAuthorize)
	async create(
		@BodyParams() body: CreateSanctionBody,
		@Context() ctx: Context,
		@Res() res: Response
	) {
		const issuer = ctx.get("user");
		if (!issuer) throw new Unauthorized("Non authentifié");

		if (!body.userId || !body.guildId || !body.type) {
			throw new BadRequest("userId, guildId et type sont requis");
		}

		if (!Object.values(SanctionType).includes(body.type)) {
			throw new BadRequest(`Type de sanction invalide : ${body.type}`);
		}

		const sanction = await this.sanctionService.issue({
			userId: body.userId,
			guildId: body.guildId,
			type: body.type,
			reason: body.reason ?? null,
			durationSec: body.durationSec ?? null,
			issuedBy: issuer.id,
			issuerType: SanctionIssuerType.Staff,
			evidence: body.evidence ?? null,
		});

		return res.status(201).json(sanction);
	}

	/**
	 * POST /sanctions/:id/revoke — révoquer une sanction existante
	 */
	@Post("/:id/revoke")
	@UseBefore(CookieAuthorize)
	async revoke(
		@PathParams("id") id: string,
		@BodyParams() body: RevokeSanctionBody,
		@Context() ctx: Context,
		@Res() res: Response
	) {
		const issuer = ctx.get("user");
		if (!issuer) throw new Unauthorized("Non authentifié");

		const em = this.db.em.fork();
		const existing = await em.findOne(Sanction, { id });
		if (!existing) throw new NotFound(`Sanction ${id} introuvable`);
		if (existing.revokedAt) {
			throw new BadRequest(`La sanction ${id} est déjà révoquée`);
		}

		const sanction = await this.sanctionService.revoke(id, issuer.id, body.reason);

		return res.status(200).json(sanction);
	}

	/**
	 * POST /sanctions/:id/appeal — ajouter un appel (journal uniquement, sans révocation)
	 */
	@Post("/:id/appeal")
	@UseBefore(CookieAuthorize)
	async appeal(
		@PathParams("id") id: string,
		@BodyParams() body: AppealSanctionBody,
		@Context() ctx: Context,
		@Res() res: Response
	) {
		const issuer = ctx.get("user");
		if (!issuer) throw new Unauthorized("Non authentifié");

		if (!body.message || body.message.trim().length < 3) {
			throw new BadRequest("Le message d'appel doit faire au moins 3 caractères");
		}

		const em = this.db.em.fork();
		const sanction = await em.findOne(Sanction, { id });
		if (!sanction) throw new NotFound(`Sanction ${id} introuvable`);

		const appealEntry: Record<string, unknown> = {
			type: "appeal",
			message: body.message.trim(),
			by: issuer.id,
			at: new Date().toISOString(),
		};

		sanction.evidence = [...(sanction.evidence ?? []), appealEntry];
		await em.flush();

		return res.status(200).json(sanction);
	}
}
