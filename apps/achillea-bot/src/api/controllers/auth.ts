import { Context, Controller, Get, Post, Req, Res, UseBefore } from "@tsed/common";
import type { Request, Response } from "express";

import {
	SESSION_COOKIE_NAME,
	sessionClearCookieOptions,
} from "@/auth";
import { CookieAuthorize } from "@/api/middlewares";
import { env } from "@/env";
import { urlsConfig } from "@/configs";
import type { UserDTO } from "@/services";
import { BaseController } from "@/utils/classes";

function sessionIsSecure(): boolean {
	return new URL(env.OAUTH_CALLBACK_BASE_URL).protocol === "https:";
}

/**
 * Provider OAuth belongs to the unified Elysia API. This controller forwards
 * authenticated provider linking without creating its own OAuth state.
 */
function unifiedProviderStart(provider: "twitch" | "challonge"): string {
	return `${urlsConfig.unifiedApi.replace(/\/+$/u, "")}/v1/auth/oauth/${provider}/start`;
}

@Controller("/auth")
export class AuthController extends BaseController {
	constructor() { super(); }

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

	@Post("/logout")
	logout(@Res() res: Response) {
		res.clearCookie(SESSION_COOKIE_NAME, sessionClearCookieOptions(sessionIsSecure()));
		res.setHeader("Cache-Control", "no-store");
		res.json({ ok: true });
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
}
