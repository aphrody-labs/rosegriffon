import { Controller, Get, HeaderParams, QueryParams, Res } from "@tsed/common";
import axios from "axios";
import type { Response } from "express";

import {
	exchangeDiscordCode,
	SESSION_COOKIE_NAME,
	sessionCookieOptions,
	signSessionToken,
} from "@/auth";
import {
	configuredOAuthCallback,
	verifyOAuthState,
} from "../security/oauth-state";
import { parseProviderOAuthState } from "../security/provider-oauth-state";
import { urlsConfig } from "@/configs";
import { discordOAuthProfile } from "@/configs/discord-profile";
import { env } from "@/env";
import { UserService, Database } from "@/services";
import { BaseController } from "@/utils/classes";
import { Provider } from "@/utils/enums";
import { resolveDependenciesSync } from "@/utils/functions";

@Controller("/bot/OAuth/callback")
export class DiscordOAuthCallbackController extends BaseController {
	private userService: UserService;
	private db: Database;

	constructor() {
		super();
		[this.userService, this.db] = resolveDependenciesSync([UserService, Database]);
	}

	/**
	 * GET /bot/OAuth/callback/discord
	 * Échange le code Discord contre un access_token, fetch le profil,
	 * upsert le user en DB, signe un JWT, set le cookie et redirige.
	 */
	@Get("/discord")
	async discordCallback(
		@QueryParams("code") code: string,
		@QueryParams("state") state: string,
		@HeaderParams("cookie") cookieHeader: string,
		@Res() res: Response
	) {
		if (!code) return res.status(400).send("Missing code");
		let safeState: string;
		try {
			safeState = verifyOAuthState(state, cookieHeader);
		} catch {
			return res.status(400).send("Invalid OAuth state");
		}

		const clientId = discordOAuthProfile.clientId;
		const clientSecret = discordOAuthProfile.clientSecret;
		if (!clientId || !clientSecret) {
			return res.status(500).send("DISCORD_CLIENT_ID / DISCORD_CLIENT_SECRET non configurés");
		}

		// redirect_uri DOIT être identique à celui utilisé pour la requête initiale
		// (sinon Discord refuse l'échange avec invalid_grant).
		const redirectUri = configuredOAuthCallback("/bot/OAuth/callback/discord");

		try {
			const me = await exchangeDiscordCode(code, { clientId, clientSecret, redirectUri });

			// 3. Sync user en DB (crée si inexistant)
			await this.userService.syncWebUser(me.id);

			const token = signSessionToken({ ...me, sim: 0 });
			res.cookie(
				SESSION_COOKIE_NAME,
				token,
				sessionCookieOptions(new URL(redirectUri).protocol === "https:")
			);

			// 6. Redirect vers le state (path frontend) ou racine
			return res.redirect(safeState);
		} catch (err: any) {
			console.error("[OAuth callback discord] failed", err?.response?.status ?? "unknown");
			return res.status(500).send("OAuth Discord callback failed");
		}
	}

	/**
	 * GET /bot/OAuth/callback
	 * Reçoit les callbacks de Twitch et Challonge, effectue l'échange de token,
	 * récupère les profils tiers, et associe la connexion au compte utilisateur.
	 */
	@Get("/")
	async handleOAuthCallback(
		@QueryParams("provider") provider: string,
		@QueryParams("code") code: string,
		@QueryParams("state") state: string,
		@Res() res: Response
	) {
		if (!code) return res.status(400).send("Code d'autorisation manquant");
		if (!provider) return res.status(400).send("Provider manquant");

		// 1. Validation CSRF via le state
		const parsedState = parseProviderOAuthState(state);
		if (!parsedState) {
			return res.status(400).send("State invalide");
		}
		const { discordId, token: csrfToken } = parsedState;
		try {
			const { User, UserConnection, OauthCsrf } = await import("@/entities");
			const consumed = await this.db.em.nativeDelete(OauthCsrf, {
				createdAt: { $gte: new Date(Date.now() - 10 * 60 * 1000) },
				discordId,
				token: csrfToken,
			});
			if (consumed !== 1) {
				return res.status(400).send("Validation CSRF échouée ou expirée");
			}

			const user = await this.db.em.findOne(User, { id: discordId });
			if (!user) {
				return res.status(404).send("Utilisateur Discord introuvable");
			}

			if (provider === Provider.TWITCH) {
				if (!env.TWITCH_CLIENT_ID || !env.TWITCH_SECRET) {
					return res.status(500).send("Identifiants API Twitch non configurés");
				}

				// Échange de code -> tokens Twitch
				const tokenRes = await axios.post(
					"https://id.twitch.tv/oauth2/token",
					new URLSearchParams({
						client_id: env.TWITCH_CLIENT_ID,
						client_secret: env.TWITCH_SECRET,
						grant_type: "authorization_code",
						code,
						redirect_uri: `${urlsConfig.oauthCallback}?provider=twitch`,
					}).toString(),
					{ headers: { "Content-Type": "application/x-www-form-urlencoded" } }
				);
				const { access_token, refresh_token } = tokenRes.data;

				// Profil Twitch
				const userRes = await axios.get("https://api.twitch.tv/helix/users", {
					headers: {
						"Client-ID": env.TWITCH_CLIENT_ID,
						Authorization: `Bearer ${access_token}`,
					},
				});
				const twitchUser = userRes.data.data[0];
				if (!twitchUser) {
					return res.status(500).send("Profil Twitch introuvable");
				}

				// Sauvegarde de la connexion
				let conn = await this.db.em.findOne(UserConnection, {
					user: discordId,
					provider: Provider.TWITCH,
				});
				if (!conn) {
					conn = new UserConnection();
					conn.user = user;
					conn.provider = Provider.TWITCH;
				}
				conn.externalId = twitchUser.id;
				conn.externalUsername = twitchUser.login;
				conn.accessToken = access_token;
				conn.refreshToken = refresh_token;

				await this.db.em.persist(conn).flush();

				return res.redirect(`${urlsConfig.website}/users/${discordId}`);
			} else if (provider === Provider.CHALLONGE) {
				const challongeClientId = env.isProd
					? env.CHALLONGE_CLIENT_ID
					: env.CHALLONGE_CLIENT_ID_TEST;
				const challongeClientSecret = env.isProd
					? env.CHALLONGE_API_KEY
					: env.CHALLONGE_API_KEY_TEST;

				if (!challongeClientId) {
					return res.status(500).send("Identifiants API Challonge non configurés");
				}

				// Échange de code -> tokens Challonge
				const tokenRes = await axios.post(
					"https://api.challonge.com/oauth/token",
					new URLSearchParams({
						client_id: challongeClientId,
						client_secret: challongeClientSecret ?? "",
						grant_type: "authorization_code",
						code,
						redirect_uri: `${urlsConfig.oauthCallback}?provider=challonge`,
					}).toString(),
					{ headers: { "Content-Type": "application/x-www-form-urlencoded" } }
				);
				const { access_token, refresh_token } = tokenRes.data;

				// Profil Challonge via l'endpoint v2 me.json
				const meRes = await axios.get("https://api.challonge.com/v2/me.json", {
					headers: {
						Accept: "application/json",
						"Content-Type": "application/vnd.api+json",
						Authorization: `Bearer ${access_token}`,
						"Authorization-Type": "v2",
					},
				});
				const meData = meRes.data;
				const externalId = String(meData.data?.id || meData.id || "");
				const externalUsername = String(
					meData.data?.attributes?.username ||
						meData.data?.attributes?.user_name ||
						meData.data?.username ||
						meData.username ||
						""
				);

				if (!externalId || !externalUsername) {
					return res.status(500).send("Profil Challonge introuvable ou mal formaté");
				}

				// Sauvegarde de la connexion
				let conn = await this.db.em.findOne(UserConnection, {
					user: discordId,
					provider: Provider.CHALLONGE,
				});
				if (!conn) {
					conn = new UserConnection();
					conn.user = user;
					conn.provider = Provider.CHALLONGE;
				}
				conn.externalId = externalId;
				conn.externalUsername = externalUsername;
				conn.accessToken = access_token;
				conn.refreshToken = refresh_token;

				await this.db.em.persist(conn).flush();

				return res.redirect(`${urlsConfig.website}/users/${discordId}`);
			} else {
				return res.status(400).send("Provider non supporté");
			}
		} catch (err: any) {
			console.error(`[OAuth callback ${provider}] failed`, err?.response?.status ?? "unknown");
			return res.status(500).send(`Échec de la connexion OAuth ${provider}`);
		}
	}
}
