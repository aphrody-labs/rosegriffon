import { Controller, Get, Res } from "@tsed/common";
import type { Response } from "express";

import { LeagueService } from "@/services/LeagueService";
import { BaseController } from "@/utils/classes";
import { resolveDependenciesSync } from "@/utils/functions";

/**
 * Championnats / ligues (format Premier League, distinct des coupes).
 * Asytral League S1 est exposée en lecture seule (données sheet officielles).
 */
@Controller("/leagues")
export class LeaguesController extends BaseController {
	private leagueService: LeagueService;

	constructor() {
		super();
		[this.leagueService] = resolveDependenciesSync([LeagueService]);
	}

	/** Liste des championnats connus (MVP : Astral S1). */
	@Get("/")
	async list(@Res() res: Response) {
		const astral = this.leagueService.getAstralSeason();
		res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=120");
		return res.json({
			items: [
				{
					id: astral.meta.id,
					name: astral.meta.name,
					season: astral.meta.season,
					format: astral.meta.format,
					description: astral.meta.description,
					champion: astral.meta.champion,
					teamCount: astral.meta.teamCount,
					matchdays: astral.meta.matchdays,
					aliases: astral.meta.aliases,
				},
			],
		});
	}

	/** Détail Astral League S1 : règlement, classement, résultats, play-offs. */
	@Get("/astral")
	@Get("/astral-s1")
	@Get("/asytral")
	@Get("/asytral-s1")
	async astral(@Res() res: Response) {
		const payload = this.leagueService.getAstralSeason();
		res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
		return res.json(payload);
	}
}
