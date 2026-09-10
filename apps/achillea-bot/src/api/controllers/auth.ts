import {
	Context,
	Controller,
	Get,
	HeaderParams,
	Post,
	QueryParams,
	Res,
	UseBefore,
} from "@tsed/common";
import type { Response } from "express";

import {
	discordAuthorizeUrl,
	exchangeDiscordCode,
	REALTIME_TTL_SECONDS,
	SESSION_COOKIE_NAME,
	sessionClearCookieOptions,
	sessionCookieOptions,
	signRealtimeToken,
	signSessionToken,
} from "@/auth";
import { CookieAuthorize } from "@/api/middlewares";
import {
	configuredOAuthCallback,
	createOAuthState,
	isSafeInternalRedirect,
	OAUTH_STATE_COOKIE,
	oauthStateCookieOptions,
	safeRedirectFromState,
	verifyOAuthState,
	withAuthNotice,
} from "../security/oauth-state";
import { env } from "@/env";
import { discordOAuthProfile } from "@/configs/discord-profile";
import type { UserDTO } from "@/services";
import { OAuthService, UserService } from "@/services";
import { BaseController } from "@/utils/classes";
import { resolveDependencies } from "@/utils/functions";

function discordClientId(): string {
	const clientId = discordOAuthProfile.clientId;
	if (!clientId)
		throw new Error(`DISCORD_CLIENT_ID manquant pour le profil ${discordOAuthProfile.name}`);
	return clientId;
}

function sessionIsSecure(): boolean {
	return new URL(env.OAUTH_CALLBACK_BASE_URL).protocol === "https:";
}

const TEST_SESSION_TTL_SECONDS = 24 * 60 * 60;

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
		return res.redirect(
			discordAuthorizeUrl(discordClientId(), configuredOAuthCallback(), oauthState.state)
		);
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
		const sessionToken = signSessionToken(
			{
				id: test.id,
				username: test.username,
				avatar: test.avatar,
			},
			TEST_SESSION_TTL_SECONDS
		);
		res.cookie(SESSION_COOKIE_NAME, sessionToken, {
			...sessionCookieOptions(sessionIsSecure()),
			maxAge: TEST_SESSION_TTL_SECONDS * 1000,
		});
		// Anti open-redirect : chemin interne à un seul slash (rejette //host et /\host).
		const safeState = isSafeInternalRedirect(state) ? state : "/ranked";
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
	async token(@Context() ctx: Context, @Res() res: Response) {
		const user = ctx.get("user") as UserDTO;
		const token = signRealtimeToken({
			id: user.id,
			username: user.username,
			avatar: user.avatar,
		});
		res.setHeader("Cache-Control", "no-store");
		return res.json({ token, expiresIn: REALTIME_TTL_SECONDS, userId: user.id });
	}

	// Callback Discord OAuth — alias canonique sur /api/auth/callback
	// (le code historique est dans oauth.ts sur /bot/OAuth/callback/discord ;
	// on délègue ici pour matcher le redirect_uri public.)
	@Get("/callback")
	async callback(
		@QueryParams("code") code: string,
		@QueryParams("state") state: string,
		@HeaderParams("cookie") cookieHeader: string,
		@Res() res: Response,
		@QueryParams("error") oauthError?: string,
		@QueryParams("error_description") oauthErrorDescription?: string
	) {
		if (oauthError) {
			console.info(
				`[auth/callback] autorisation refusée (${oauthError})`,
				oauthErrorDescription ?? ""
			);

			return res.redirect(
				withAuthNotice(
					safeRedirectFromState(state, cookieHeader),
					oauthError === "access_denied" ? "denied" : "error"
				)
			);
		}
		if (!code) {
			return res.redirect(withAuthNotice(safeRedirectFromState(state, cookieHeader), "error"));
		}
		await this.dependenciesReady;

		let safeState: string;
		try {
			safeState = verifyOAuthState(state, cookieHeader);
		} catch {
			return res.status(400).send("Invalid OAuth state");
		}
		// Ne pas émettre un second Set-Cookie ici. Le proxy HTTP Bun qui expose
		// `/api/*` ne relaie pas fiablement plusieurs Set-Cookie sur la même réponse
		// et perdait alors le cookie de session. Le nonce, HttpOnly et borné à 10 min,
		// expire naturellement ; le code Discord reste à usage unique.
		const redirectUri = configuredOAuthCallback();

		// Le secret DOIT venir du meme profil que le client ID envoye a /authorize,
		// sinon Discord repond invalid_client a l'echange du code.
		const clientId = discordClientId();
		const clientSecret = discordOAuthProfile.clientSecret;
		if (!clientId || !clientSecret) {
			return res
				.status(500)
				.send(`Identifiants OAuth Discord absents pour le profil ${discordOAuthProfile.name}`);
		}

		try {
			const me = await exchangeDiscordCode(code, { clientId, clientSecret, redirectUri });

			await this.userService.syncWebUser(me.id);

			const sessionToken = signSessionToken(me);
			res.cookie(SESSION_COOKIE_NAME, sessionToken, sessionCookieOptions(sessionIsSecure()));

			return res.redirect(safeState);
		} catch (error) {
			console.error("[auth/callback] failed", error instanceof Error ? error.message : "unknown");
			return res.redirect(withAuthNotice(safeState, "error"));
		}
	}
}
