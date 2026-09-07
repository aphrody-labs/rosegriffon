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
import { Forbidden, NotFound, Unauthorized } from "@tsed/exceptions";
import { Default, Maximum, Minimum } from "@tsed/schema";
import type { Response } from "express";

import { CookieAuthorize } from "@/api/middlewares";
import type { Paginated } from "@/api/models/interfaces";
import { paginate } from "@/api/models/interfaces";
import { User } from "@/entities";
import type { UserDTO } from "@/services";
import { Database, UserService } from "@/services";
import { BaseController } from "@/utils/classes";
import { UserRole } from "@/utils/enums";
import { resolveDependenciesSync } from "@/utils/functions";

import { OrganizationService } from "../../services/OrganizationService";
import { OrganizationState } from "../../utils/enums/organizationState";
import type { NewOrganizationDTO, OrganizationDTO } from "../models/dtos/organizationDTO";

@Controller("/organizations")
export class OrganizationsController extends BaseController {
	private userService: UserService;
	private organizationService: OrganizationService;
	private db: Database;

	constructor() {
		super();

		[this.userService, this.organizationService, this.db] = resolveDependenciesSync([
			UserService,
			OrganizationService,
			Database,
		]);
	}

	/** Garde admin (rôle ≥ Administrator en base) — approbation/rejet réservés au staff. */
	private async assertAdmin(ctx: Context): Promise<void> {
		const u = ctx.get("user") as UserDTO | undefined;
		if (!u) throw new Unauthorized("Non authentifié");
		const em = this.db.em.fork();
		const row = await em.findOne(User, { id: u.id });
		if (!row || row.role < UserRole.Administrator) {
			throw new Forbidden("Réservé aux administrateurs");
		}
	}

	@Get("/")
	async getOrganizations(
		@Res() res: Response,
		@QueryParams("page")
		@Default(1)
		@Minimum(1)
		page: number,

		@QueryParams("pagination")
		@Default(25)
		@Minimum(1)
		@Maximum(50)
		pagination: number,

		@QueryParams("state")
		@Default(OrganizationState.Approved)
		state: OrganizationState
	): Promise<Paginated<OrganizationDTO>> {
		const [items, total] = await this.organizationService.getOrganizations(page, pagination, state);

		// Liste organisations : metadata stable. 60s + SWR 5min.
		res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");

		return paginate(items, total, pagination, page);
	}

	@Get("/:id")
	async getOrganization(@PathParams("id") id: number, @Res() res: Response) {
		try {
			const organizationDTO = await this.organizationService.getSingleOrganization(id);
			res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");

			return res.status(200).json({ success: true, data: organizationDTO });
		} catch (err: any) {
			console.error(err);

			return res.status(err.status || 400).json({ success: false, error: err.message });
		}
	}

	@Get("/me")
	@UseBefore(CookieAuthorize)
	async getUserOrganizations(@Context() ctx: Context, @Res() res: Response) {
		try {
			const user = ctx.get("user") as UserDTO;
			if (!user) throw new Unauthorized("Not authenticated");

			const userOrganizations = await this.organizationService.getUserOrganizations(user);
			if (userOrganizations.length === 0)
				throw new NotFound("Vous ne faites partie d'aucune organisation.");

			return res.status(200).json({ success: true, data: userOrganizations });
		} catch (error: any) {
			console.error("Erreur lors de la récupération des organisation de l'utilisateur :", error);

			return res.status(error.status || 400).json({
				success: false,
				error: error.message || "Impossible de récupérer la liste de vos organisations.",
			});
		}
	}

	@Post("/create")
	@UseBefore(CookieAuthorize)
	async createOrganization(
		@BodyParams() dto: NewOrganizationDTO,
		@Context() ctx: Context,
		@Res() res: Response
	) {
		try {
			const user = ctx.get("user") as UserDTO;
			if (user.id !== dto.owner.id)
				throw new Unauthorized(
					"Vous ne pouvez pas créer une organisation pour un autre utilisateur."
				);
			const orgManagers = await Promise.all(
				dto.orgManagers.map(async (orgManager) => await this.userService.getUserDTO(orgManager.id))
			);
			await this.organizationService.validateOrgManagers([user, ...orgManagers]);
			await this.organizationService.validateName(dto.name, dto.normalizedName);
			await this.organizationService.validateSocials(dto.socialMedias, "social");
			await this.organizationService.validateSocials(dto.broadcastMedias, "broadcast");
			this.organizationService.validateOrigin(dto.origin);

			// We validated everything
			console.info(`All validations passed for new Organization ${dto.normalizedName}`);

			// Create new entity
			const newOrg = await this.organizationService.createOrganization(dto);
			const addResults = await this.organizationService.addOrgManagers(orgManagers, newOrg.id);

			// TO-DO: Notify on discord, validation process on the website
			await this.organizationService.logNewOrgSubmission(newOrg);

			return res.status(200).json({ success: true, data: addResults });
		} catch (error: any) {
			console.error("Erreur lors de la création d'une organisation :", error);

			return res.status(error.status || 400).json({
				success: false,
				error: error.message || "Impossible de créer cette organisation.",
			});
		}
	}

	@Post("/validate")
	@UseBefore(CookieAuthorize)
	async validateOrganization(
		@BodyParams() dto: NewOrganizationDTO,
		@Context() ctx: Context,
		@Res() res: Response
	) {
		try {
			const user = ctx.get("user") as UserDTO;
			if (user.id !== dto.owner.id)
				throw new Unauthorized(
					"Vous ne pouvez pas créer une organisation pour un autre utilisateur."
				);
			const orgManagers = await Promise.all(
				dto.orgManagers.map(async (orgManager) => await this.userService.getUserDTO(orgManager.id))
			);
			await this.organizationService.validateOrgManagers([user, ...orgManagers]);
			await this.organizationService.validateName(dto.name, dto.normalizedName);
			await this.organizationService.validateSocials(dto.socialMedias, "social");
			await this.organizationService.validateSocials(dto.broadcastMedias, "broadcast");
			this.organizationService.validateOrigin(dto.origin);

			// We validated everything
			console.info(`All validations passed for new Organization ${dto.normalizedName}`);

			// Create new entity
			const newOrg = await this.organizationService.createOrganization(dto);
			const addResults = await this.organizationService.addOrgManagers(orgManagers, newOrg.id);

			// TO-DO: Notify on discord, validation process on the website
			await this.organizationService.logNewOrgSubmission(newOrg);

			return res.status(200).json({ success: true, data: addResults });
		} catch (error: any) {
			console.error("Erreur lors de la création d'une organisation :", error);

			return res.status(error.status || 400).json({
				success: false,
				error: error.message || "Impossible de créer cette organisation.",
			});
		}
	}

	/** Approuve une organisation en attente (admin) → état Approved. */
	@Post("/:id/approve")
	@UseBefore(CookieAuthorize)
	async approveOrganization(
		@PathParams("id") id: number,
		@Context() ctx: Context,
		@Res() res: Response
	) {
		try {
			await this.assertAdmin(ctx);
			const data = await this.organizationService.setOrganizationState(
				id,
				OrganizationState.Approved
			);

			return res.status(200).json({ success: true, data });
		} catch (error: any) {
			console.error("Erreur lors de l'approbation d'une organisation :", error);

			return res.status(error.status || 400).json({
				success: false,
				error: error.message || "Impossible d'approuver cette organisation.",
			});
		}
	}

	/** Rejette une organisation en attente (admin) → état Rejected. */
	@Post("/:id/reject")
	@UseBefore(CookieAuthorize)
	async rejectOrganization(
		@PathParams("id") id: number,
		@Context() ctx: Context,
		@Res() res: Response
	) {
		try {
			await this.assertAdmin(ctx);
			const data = await this.organizationService.setOrganizationState(
				id,
				OrganizationState.Rejected
			);

			return res.status(200).json({ success: true, data });
		} catch (error: any) {
			console.error("Erreur lors du rejet d'une organisation :", error);

			return res.status(error.status || 400).json({
				success: false,
				error: error.message || "Impossible de rejeter cette organisation.",
			});
		}
	}
}
