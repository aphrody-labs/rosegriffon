import { Context, Controller, Get, Post, QueryParams, Req, Res, UseBefore } from "@tsed/common";
import type { Request, Response } from "express";

import {
	SESSION_COOKIE_NAME,
	sessionClearCookieOptions,
	sessionCookieOptions,
} from "@/auth";
import { CookieAuthorize } from "@/api/middlewares";
import { isSafeInternalPath } from "@rosegriffon/achillea-core";
import { env } from "@/env";
import { urlsConfig } from "@/configs";
import type { UserDTO } from "@/services";
import { OAuthService } from "@/services";
import { BaseController } from "@/utils/classes";
import { resolveDependencies } from "@/utils/functions";

/** L'identité du site est désormais exclusivement gérée par Better Auth/RG. */
function unifiedLoginUrl(returnUrl: string): string {
	const url = new URL("/login", urlsConfig.website);
	url.searchParams.set("redirect", isSafeInternalPath(returnUrl) ? returnUrl : "/achillea");
	return url.toString();
}

function sessionIsSecure(): boolean {
	return new URL(env.OAUTH_CALLBACK_BASE_URL).protocol === "https:";
}

@Controller("/auth")
export class AuthController extends BaseController {
	private oAuthService: OAuthService;
	private readonly dependenciesReady: Promise<void>;

	constructor() {
		super();

		this.dependenciesReady = resolveDependencies([OAuthService]).then(
			([oAuthService]) => {
				this.oAuthService = oAuthService;
			}
		);
	}

	@Get("/discord")
	discordLogin(@QueryParams("state") state: string, @Res() res: Response) {
		// Alias historique : aucun OAuth Discord n'est démarré par Achilléa.
		// On passe par la page RG afin que Better Auth soit l'unique propriétaire
		// de l'autorisation, de la session et du callback Discord.
		return res.redirect(unifiedLoginUrl(state));
	}

	@Get("/challonge")
	@UseBefore(CookieAuthorize) // On vérifie que l'user est connecté sur le site
	async getChallongeUrl(@Context("user") user: UserDTO, @Res() res: Response) {
		await this.dependenciesReady;
		const discordId = user.id;

		const url = await this.oAuthService.getChallongeOAuthUrl(discordId);

		res.redirect(url);
	}

	@Get("/twitch")
	@UseBefore(CookieAuthorize)
	async getTwitchUrl(@Context("user") user: UserDTO, @Res() res: Response) {
		await this.dependenciesReady;
		const discordId = user.id;

		const url = await this.oAuthService.getTwitchOAuthUrl(discordId);

		res.redirect(url);
	}

	// Authenticated user info endpoint
	@Get("/me")
	@UseBefore(CookieAuthorize)
	async me(@Context() ctx: Context, @Res() res: Response) {
		const user = ctx.get("user") as UserDTO;
		if (user.avatar && !user.avatar.startsWith("http")) {
			user.avatar = `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`;
		}

		res.setHeader("Cache-Control", "no-store");
		return res.json(user);
	}

	// POST est la route canonique. Le GET reste disponible pendant la migration des anciens clients.
	@Post("/logout")
	logout(@Res() res: Response) {
		res.clearCookie(SESSION_COOKIE_NAME, sessionClearCookieOptions(sessionIsSecure()));
		res.setHeader("Cache-Control", "no-store");
		res.json({ ok: true });
	}

	@Get("/logout")
	logoutLegacy(@Res() res: Response) {
		return this.logout(res);
	}

	// Token endpoint pour Colyseus client (cookie HttpOnly cross-domain WSS)
	@Get("/token")
	@UseBefore(CookieAuthorize)
	async token(@Req() req: Request, @Res() res: Response) {
		const headers: Record<string, string> = { accept: "application/json" };
		if (req.headers.cookie) headers.cookie = req.headers.cookie;
		if (req.headers.authorization) headers.authorization = req.headers.authorization;
		const upstream = await fetch(`${urlsConfig.unifiedApi}/v1/auth/realtime-token`, { headers });
		const text = await upstream.text();
		res.status(upstream.status).setHeader("Cache-Control", "no-store");
		res.type("application/json");
		return res.send(text);
	}

	// Callback historique conservé pour les liens déjà distribués. Il n'échange
	// plus jamais de code Discord : l'utilisateur repart vers l'OAuth unique RG.
	@Get("/callback")
	async callback(@Res() res: Response) {
		return res.redirect(unifiedLoginUrl("/achillea"));
	}
}
