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
import { BaseController } from "@/utils/classes";

/** L'identité du site est désormais exclusivement gérée par Better Auth/RG. */
function unifiedLoginUrl(returnUrl: string): string {
	const url = new URL("/login", urlsConfig.website);
	url.searchParams.set("redirect", isSafeInternalPath(returnUrl) ? returnUrl : "/achillea");
	return url.toString();
}

function sessionIsSecure(): boolean {
	return new URL(env.OAUTH_CALLBACK_BASE_URL).protocol === "https:";
}

/**
 * Provider OAuth belongs to the unified Elysia API.  This controller only
 * keeps the old browser URL alive long enough to forward an authenticated
 * user; it never creates state, exchanges a code, or stores a provider token.
 */
function unifiedProviderStart(provider: "twitch" | "challonge"): string {
	return `${urlsConfig.unifiedApi.replace(/\/+$/u, "")}/v1/auth/oauth/${provider}/start`;
}

@Controller("/auth")
export class AuthController extends BaseController {
	constructor() { super(); }

	@Get("/discord")
	discordLogin(@QueryParams("state") state: string, @Res() res: Response) {
		// Alias historique : aucun OAuth Discord n'est démarré par Achilléa.
		// On passe par la page RG afin que Better Auth soit l'unique propriétaire
		// de l'autorisation, de la session et du callback Discord.
		return res.redirect(unifiedLoginUrl(state));
	}

	@Get("/challonge")
	@UseBefore(CookieAuthorize)
	getChallongeUrl(@Res() res: Response) {
		return res.redirect(unifiedProviderStart("challonge"));
	}

	@Get("/twitch")
	@UseBefore(CookieAuthorize)
	getTwitchUrl(@Res() res: Response) {
		return res.redirect(unifiedProviderStart("twitch"));
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
