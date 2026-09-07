import { existsSync } from "node:fs";
import { join } from "node:path";

import { Context, Controller, Get, PathParams, Post, Res, UseBefore } from "@tsed/common";
import { BadRequest, Forbidden, NotFound, Unauthorized } from "@tsed/exceptions";
import type { Response } from "express";

import { CookieAuthorize } from "@/api/middlewares";
import { License, User } from "@/entities";
import { Database, LicenseService } from "@/services";
import { BaseController } from "@/utils/classes";
import { UserRole } from "@/utils/enums";
import { resolveDependenciesSync } from "@/utils/functions";

const STORAGE_ROOT = join(process.cwd(), "storage", "licenses");

/**
 * /licenses — emission, revocation, telechargement et verification publique.
 *
 * Endpoints :
 *   POST   /licenses/issue/:userId       (admin)  -> 201 + LicenseDTO
 *   POST   /licenses/:id/revoke          (admin)  -> 200 + LicenseDTO
 *   GET    /licenses/:id.pdf             (public) -> application/pdf stream
 *   GET    /licenses/verify/:qrSecret    (public) -> LicenseVerifyDTO (sanitise)
 */
@Controller("/licenses")
export class LicensesController extends BaseController {
	private licenseService: LicenseService;
	private db: Database;

	constructor() {
		super();
		[this.licenseService, this.db] = resolveDependenciesSync([LicenseService, Database]);
	}

	/** Garde admin (rôle ≥ Administrator en base) — issue/revoke réservés au staff. */
	private async assertAdmin(ctx: Context): Promise<void> {
		const u = ctx.get("user");
		if (!u) throw new Unauthorized("Non authentifié");
		const em = this.db.em.fork();
		const row = await em.findOne(User, { id: u.id });
		if (!row || row.role < UserRole.Administrator) {
			throw new Forbidden("Réservé aux administrateurs");
		}
	}

	/** Licence du joueur connecté (la plus récente), ou `{ license: null }`. */
	@Get("/me")
	@UseBefore(CookieAuthorize)
	async me(@Context() ctx: Context, @Res() res: Response) {
		const user = ctx.get("user");
		if (!user) throw new Unauthorized("Non authentifié");

		const em = this.db.em.fork();
		const license = await em.findOne(
			License,
			{ user: { id: user.id } },
			{ orderBy: { issuedAt: "DESC" } }
		);
		if (!license) return res.status(200).json({ license: null });

		return res.status(200).json({
			license: {
				id: license.id,
				userId: user.id,
				licenseNumber: license.licenseNumber,
				issuedAt: license.issuedAt,
				validUntil: license.validUntil,
				status: license.status,
				pdfUrl: license.pdfUrl,
				createdAt: license.createdAt,
				updatedAt: license.updatedAt,
			},
		});
	}

	/** Emet une licence pour un utilisateur (admin). */
	@Post("/issue/:userId")
	@UseBefore(CookieAuthorize)
	async issue(@PathParams("userId") userId: string, @Context() ctx: Context, @Res() res: Response) {
		await this.assertAdmin(ctx);

		if (!userId || userId.trim().length === 0) {
			throw new BadRequest("userId requis");
		}

		const license = await this.licenseService.issue(userId);
		return res.status(201).json({
			id: license.id,
			userId: license.user.id,
			licenseNumber: license.licenseNumber,
			issuedAt: license.issuedAt,
			validUntil: license.validUntil,
			status: license.status,
			pdfUrl: license.pdfUrl,
			createdAt: license.createdAt,
			updatedAt: license.updatedAt,
		});
	}

	/** Revoque une licence (admin). */
	@Post("/:id/revoke")
	@UseBefore(CookieAuthorize)
	async revoke(@PathParams("id") id: string, @Context() ctx: Context, @Res() res: Response) {
		await this.assertAdmin(ctx);
		const issuer = ctx.get("user");

		const em = this.db.em.fork();
		const existing = await em.findOne(License, { id });
		if (!existing) throw new NotFound(`Licence ${id} introuvable`);

		const license = await this.licenseService.revoke(id, issuer.id);
		return res.status(200).json({
			id: license.id,
			userId: license.user?.id ?? null,
			licenseNumber: license.licenseNumber,
			issuedAt: license.issuedAt,
			validUntil: license.validUntil,
			status: license.status,
			pdfUrl: license.pdfUrl,
			createdAt: license.createdAt,
			updatedAt: license.updatedAt,
		});
	}

	/**
	 * Streame le PDF stocke localement. Public : connaitre l'id ne donne pas
	 * d'information personnelle au-dela du PDF deja imprime/partage par le porteur.
	 * UUID v4 = ~122 bits d'entropie : pas enumerable.
	 */
	@Get("/:id.pdf")
	async download(@PathParams("id") id: string, @Res() res: Response) {
		if (!/^[0-9a-f-]{36}$/i.test(id)) {
			throw new BadRequest("Identifiant de licence invalide");
		}

		const path = join(STORAGE_ROOT, `${id}.pdf`);
		if (!existsSync(path)) {
			throw new NotFound("PDF introuvable");
		}

		const file = Bun.file(path);
		const buf = Buffer.from(await file.arrayBuffer());
		res.setHeader("Content-Type", "application/pdf");
		res.setHeader("Content-Length", buf.length);
		res.setHeader("Content-Disposition", `inline; filename="licence-${id}.pdf"`);
		return res.status(200).send(buf);
	}

	/**
	 * Verification publique — ne fuite ni `user_id`, ni `qrSecret`, ni l'entite
	 * License complete. Retour minimal : valid + holder + numero + validite.
	 */
	@Get("/verify/:qrSecret")
	async verify(@PathParams("qrSecret") qrSecret: string, @Res() res: Response) {
		if (!qrSecret || qrSecret.length < 32 || qrSecret.length > 64) {
			// Reponse uniforme : ne pas reveler la longueur attendue
			return res.status(200).json({ valid: false, reason: "not_found" });
		}

		const result = await this.licenseService.verify(qrSecret);
		return res.status(200).json(result);
	}
}
