import { Controller, Get, QueryParams, Res } from "@tsed/common";
import type { Response } from "express";

import { isSafeInternalPath } from "@rosegriffon/achillea-core";
import { urlsConfig } from "@/configs";
import { BaseController } from "@/utils/classes";

/**
 * Relais de compatibilité uniquement.
 *
 * Les callbacks Discord appartiennent à Better Auth et les callbacks Twitch/
 * Challonge appartiennent désormais à `apps/api`. Le bot ne consomme ni code,
 * ni state, ni token OAuth.
 */
@Controller("/bot/OAuth/callback")
export class ProviderOAuthCallbackController extends BaseController {
	constructor() { super(); }

	@Get("/discord")
	discordCallback(@QueryParams("state") state: string, @Res() res: Response) {
		const login = new URL("/login", urlsConfig.website);
		login.searchParams.set("redirect", isSafeInternalPath(state) ? state : "/achillea");
		return res.redirect(login.toString());
	}

	@Get("/")
	providerCallback(
		@QueryParams("provider") provider: string,
		@QueryParams("code") code: string,
		@QueryParams("state") state: string,
		@Res() res: Response
	) {
		const target = new URL(urlsConfig.oauthCallback);
		if (provider) target.searchParams.set("provider", provider);
		if (code) target.searchParams.set("code", code);
		if (state) target.searchParams.set("state", state);
		return res.redirect(target.toString());
	}
}
