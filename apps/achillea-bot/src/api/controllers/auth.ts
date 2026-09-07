import { Context, Controller, Get, HeaderParams, QueryParams, Res, UseBefore } from "@tsed/common";
import type { Response } from "express";

import { CookieAuthorize } from "@/api/middlewares";
import {
	configuredOAuthCallback,
	createOAuthState,
	OAUTH_STATE_COOKIE,
	oauthStateCookieOptions,
	verifyOAuthState,
} from "../security/oauth-state";
import { env } from "@/env";
import type { UserDTO } from "@/services";
import { OAuthService, UserService } from "@/services";
import { BaseController } from "@/utils/classes";
import { resolveDependencies } from "@/utils/functions";

// Note: jsonwebtoken importé dynamiquement dans /callback pour éviter le coût
// au boot pour les autres routes du controller.

type DiscordUser = {
	id: string;
	username: string;
	avatar: string;
};

function getDiscordRedirectURI(state: string) {
	const clientId = env.isDev
		? (env.DISCORD_CLIENT_ID_DEV ?? env.DISCORD_CLIENT_ID)
		: env.DISCORD_CLIENT_ID;

	if (!clientId)
		throw new Error("DISCORD_CLIENT_ID manquant dans .env (ou DISCORD_CLIENT_ID_DEV en dev)");

	const authorizeUrl = new URL("https://discord.com/oauth2/authorize");
	authorizeUrl.search = new URLSearchParams({
		client_id: clientId,
		response_type: "code",
		redirect_uri: configuredOAuthCallback(),
		scope: "identify",
		state,
	}).toString();
	return authorizeUrl.toString();
}

@Controller("/auth")
export class AuthController extends BaseController {
	private userService: UserService;
	private oAuthService: OAuthService;
	private readonly dependenciesReady: Promise<void>;

	constructor() {
		super();

		this.dependenciesReady = resolveDependencies([UserService, OAuthService]).then(
			([userService, oAuthService]) => {
				this.userService = userService;
				this.oAuthService = oAuthService;
			}
		);
	}

	@Get("/discord")
	discordLogin(@QueryParams("state") state: string, @Res() res: Response) {
		const oauthState = createOAuthState(state);
		res.cookie(OAUTH_STATE_COOKIE, oauthState.nonce, oauthStateCookieOptions);
		return res.redirect(getDiscordRedirectURI(oauthState.state));
	}

	// Connexion de TEST anonyme — pour tester le ranked sans login Discord réel.
	// DÉSACTIVÉE EN PROD (jamais de backdoor de session côté prod) ; hors-prod uniquement et
	// gardée par la variable d'env TEST_LOGIN_SECRET (404 si absente/incorrecte). Chaque appel
	// crée un utilisateur de test éphémère + pose le cookie de session (1 j) puis redirige (chemin interne).
	@Get("/test-login")
	async testLogin(
		@QueryParams("key") key: string,
		@QueryParams("state") state: string,
		@Res() res: Response
	) {
		await this.dependenciesReady;
		const secret = process.env.TEST_LOGIN_SECRET;
		if (process.env.NODE_ENV === "production" || !secret || key !== secret) {
			return res.status(404).send("Not found");
		}

		const test = await this.userService.createTestUser();
		const jwt = await import("jsonwebtoken");
		const sessionToken = jwt.default.sign(
			{ id: test.id, username: test.username, avatar: test.avatar },
			env.JWT_SECRET_KEY,
			{ expiresIn: "1d" }
		);
		res.cookie("token", sessionToken, {
			httpOnly: true,
			secure: true,
			sameSite: "lax",
			maxAge: 24 * 60 * 60 * 1000,
			path: "/",
		});
		// Anti open-redirect : chemin interne à un seul slash (rejette //host et /\host).
		const safeState = /^\/(?![/\\])/.test(state ?? "") ? state : "/ranked";
		return res.redirect(safeState);
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
	async me(@Context() ctx: Context) {
		const user = ctx.get("user") as UserDTO;
		user.avatar = `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`;

		return user;
	}

	// Logout (clear cookie)
	@Get("/logout")
	logout(@Res() res: Response) {
		res.clearCookie("token");
		res.json({ ok: true });
	}

	// Token endpoint pour Colyseus client (cookie HttpOnly cross-domain WSS)
	@Get("/token")
	@UseBefore(CookieAuthorize)
	async token(@Context() ctx: Context, @Res() res: Response) {
		const user = ctx.get("user") as UserDTO;
		// Le cookie 'token' est ce JWT — on le retourne en JSON pour usage côté client.
		const cookieHeader = res.req.headers.cookie ?? "";
		const m = /(?:^|;\s*)token=([^;]+)/.exec(cookieHeader);
		const token = m ? decodeURIComponent(m[1]) : null;
		if (!token) return res.status(401).json({ error: "unauthenticated" });
		return res.json({ token, expiresIn: 30 * 24 * 60 * 60, userId: user.id });
	}

	// Callback Discord OAuth — alias canonique sur /api/auth/callback
	// (le code historique est dans oauth.ts sur /bot/OAuth/callback/discord ;
	// on délègue ici pour matcher le redirect_uri public.)
	@Get("/callback")
	async callback(
		@QueryParams("code") code: string,
		@QueryParams("state") state: string,
		@HeaderParams("cookie") cookieHeader: string,
		@Res() res: Response
	) {
		if (!code) return res.status(400).send("Missing code");
		await this.dependenciesReady;

		let safeState: string;
		try {
			safeState = verifyOAuthState(state, cookieHeader);
		} catch {
			return res.status(400).send("Invalid OAuth state");
		}
		res.clearCookie(OAUTH_STATE_COOKIE, oauthStateCookieOptions);
		const redirectUri = configuredOAuthCallback();

		const clientId = env.isDev
			? (env.DISCORD_CLIENT_ID_DEV ?? env.DISCORD_CLIENT_ID)
			: env.DISCORD_CLIENT_ID;
		const clientSecret = env.isDev
			? (env.DISCORD_CLIENT_SECRET_DEV ?? env.DISCORD_CLIENT_SECRET)
			: env.DISCORD_CLIENT_SECRET;
		if (!clientId || !clientSecret) {
			return res.status(500).send("DISCORD_CLIENT_ID / DISCORD_CLIENT_SECRET non configurés");
		}

		try {
			const tokenRes = await fetch("https://discord.com/api/v10/oauth2/token", {
				method: "POST",
				headers: { "Content-Type": "application/x-www-form-urlencoded" },
				body: new URLSearchParams({
					client_id: clientId,
					client_secret: clientSecret,
					grant_type: "authorization_code",
					code,
					redirect_uri: redirectUri,
				}),
			});
			if (!tokenRes.ok) {
				console.error("[auth/callback] token exchange failed:", tokenRes.status);
				return res.status(500).send("OAuth token exchange failed");
			}
			const tokenData = (await tokenRes.json()) as { access_token: string };

			const meRes = await fetch("https://discord.com/api/v10/users/@me", {
				headers: { Authorization: `Bearer ${tokenData.access_token}` },
			});
			if (!meRes.ok) {
				return res.status(500).send("Failed to fetch Discord profile");
			}
			const me = (await meRes.json()) as { id: string; avatar: string | null; username: string };

			await this.userService.syncWebUser(me.id);

			const jwt = await import("jsonwebtoken");
			const sessionToken = jwt.default.sign(
				{ id: me.id, username: me.username, avatar: me.avatar ?? "" },
				env.JWT_SECRET_KEY,
				{ expiresIn: "30d" }
			);

			res.cookie("token", sessionToken, {
				httpOnly: true,
				secure: new URL(redirectUri).protocol === "https:",
				sameSite: "lax",
				maxAge: 30 * 24 * 60 * 60 * 1000,
				path: "/",
			});

			return res.redirect(safeState);
		} catch {
			console.error("[auth/callback] failed");
			return res.status(500).send("OAuth callback failed");
		}
	}
}
