/**
 * Plugin Better Auth « steam » — login Steam OpenID 2.0 + vue compte IEVR.
 *
 * Modèle : calqué sur le plugin `siwe` du cœur Better Auth (sign-in custom sans OAuth :
 * vérifie une preuve d'identité externe, puis crée user + account + session via
 * `internalAdapter` et pose le cookie via `setSessionCookie`).
 *
 * Endpoints serveur exposés :
 * - GET  /sign-in/steam        → redirige l'utilisateur vers Steam (OpenID checkid_setup).
 * - GET  /steam/callback       → vérifie l'assertion OpenID (check_authentication), lie/crée
 *                                l'utilisateur (table user + colonne steam_id, table account
 *                                providerId="steam"), ouvre une session, pose le cookie.
 * - GET  /steam/account        → (authentifié) vue du compte Steam scopée IEVR via Web API.
 *
 * Anti-hallucination : aucune dépendance Steam SDK ; OpenID 2.0 vérifié côté Steam, Web API
 * via les vrais endpoints `api.steampowered.com` (cf. ./web-api.ts).
 */

import { APIError, createAuthEndpoint, sessionMiddleware } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import type { BetterAuthPlugin, User } from "better-auth";
import * as z from "zod";

import {
	IEVR_STEAM_APP_ID,
	STEAM_PROVIDER_ID,
} from "./constants";
import { buildSteamLoginUrl, verifySteamAssertion } from "./openid";
import { steamSchema } from "./schema";
import { SteamWebApiClient, SteamWebApiError } from "./web-api";

export interface SteamPluginOptions {
	/**
	 * Clé Steam Web API (https://steamcommunity.com/dev/apikey). Si absente, les endpoints
	 * de login fonctionnent quand même ; seule la vue compte (`/steam/account`) renverra
	 * une erreur « configuration manquante ». Défaut : `process.env.STEAM_WEB_API_KEY`.
	 */
	webApiKey?: string;
	/**
	 * App ID scopé pour la vue compte. Défaut : IEVR (2799860).
	 */
	appId?: number;
	/**
	 * Realm OpenID (origine de confiance). Défaut : `ctx.context.baseURL`'s origin.
	 * DOIT être l'origine sous laquelle vit le `return_to`.
	 */
	realm?: string;
	/** Langue des libellés de succès. Défaut : "french". */
	achievementsLanguage?: string;
	/** `fetch` injectable (tests). Défaut : global `fetch`. */
	fetchImpl?: typeof fetch;
}

const callbackQuerySchema = z
	.object({ callbackURL: z.string().optional() })
	.catchall(z.string());

export const steam = (options: SteamPluginOptions = {}) => {
	const language = options.achievementsLanguage ?? "french";
	const appId = options.appId ?? IEVR_STEAM_APP_ID;
	const getApiKey = () => options.webApiKey ?? process.env.STEAM_WEB_API_KEY;

	return {
		id: STEAM_PROVIDER_ID,
		schema: steamSchema,
		endpoints: {
			/**
			 * Démarre le login Steam : construit l'URL OpenID 2.0 et redirige.
			 * Le `callbackURL` (où renvoyer l'app après login) est transporté dans le
			 * `return_to` en query param ; Steam le préserve et nous le rerenvoie.
			 */
			signInSteam: createAuthEndpoint(
				"/sign-in/steam",
				{ method: "GET", query: callbackQuerySchema },
				async (ctx) => {
					const baseURL = ctx.context.baseURL;
					const realm = options.realm ?? new URL(baseURL).origin;
					const callbackURL = ctx.query?.callbackURL ?? "/";

					const returnTo = new URL(`${baseURL}/steam/callback`);
					returnTo.searchParams.set("callbackURL", callbackURL);

					const loginUrl = buildSteamLoginUrl(returnTo.toString(), realm);
					throw ctx.redirect(loginUrl);
				},
			),

			/**
			 * Callback OpenID 2.0 : vérifie l'assertion auprès de Steam, lie/crée le user,
			 * ouvre la session.
			 */
			steamCallback: createAuthEndpoint(
				"/steam/callback",
				{ method: "GET", query: z.record(z.string(), z.string()) },
				async (ctx) => {
					const baseURL = ctx.context.baseURL;
					const callbackURL = ctx.query?.callbackURL ?? "/";
					const expectedReturnTo = `${baseURL}/steam/callback`;

					// Reconstruit l'URLSearchParams des params openid.* reçus.
					const query = new URLSearchParams();
					for (const [k, v] of Object.entries(ctx.query ?? {})) {
						query.set(k, v);
					}

					const steamId = await verifySteamAssertion(
						query,
						expectedReturnTo,
						options.fetchImpl ?? fetch,
					);
					if (!steamId) {
						throw new APIError("UNAUTHORIZED", {
							message: "Assertion OpenID Steam invalide ou expirée.",
						});
					}

					// 1) Compte existant lié à ce SteamID (table account, providerId=steam) ?
					let user: User | null = null;
					const account = await ctx.context.adapter.findOne<{ userId: string }>({
						model: "account",
						where: [
							{ field: "providerId", operator: "eq", value: STEAM_PROVIDER_ID },
							{ field: "accountId", operator: "eq", value: steamId },
						],
					});
					if (account) {
						user = await ctx.context.internalAdapter.findUserById(account.userId);
					}

					// 2) Sinon, un user portant déjà steam_id = ce SteamID (champ user) ?
					if (!user) {
						const existing = await ctx.context.adapter.findOne<{ id: string }>({
							model: "user",
							where: [{ field: "steamId", operator: "eq", value: steamId }],
						});
						if (existing) {
							user = await ctx.context.internalAdapter.findUserById(existing.id);
						}
					}

					// 3) Sinon : créer un nouvel utilisateur Steam + son account.
					if (!user) {
						const summary = await fetchSummarySafe(getApiKey(), appId, steamId, options.fetchImpl);
						const email = `steam-${steamId}@noemail.local`;
						const created = await ctx.context.internalAdapter.createUser({
							name: summary?.personaname ?? `Joueur Steam ${steamId}`,
							email,
							emailVerified: false,
							image: summary?.avatarfull ?? undefined,
							steamId,
						});
						user = created;
						await ctx.context.internalAdapter.createAccount({
							userId: created.id,
							providerId: STEAM_PROVIDER_ID,
							accountId: steamId,
							createdAt: new Date(),
							updatedAt: new Date(),
						});
					}

					if (!user) {
						throw new APIError("INTERNAL_SERVER_ERROR", {
							message: "Échec de création de l'utilisateur Steam.",
						});
					}

					const session = await ctx.context.internalAdapter.createSession(user.id);
					if (!session) {
						throw new APIError("INTERNAL_SERVER_ERROR", {
							message: "Échec de création de la session.",
						});
					}
					await setSessionCookie(ctx, { session, user });

					throw ctx.redirect(new URL(callbackURL, baseURL).toString());
				},
			),

			/**
			 * Vue du compte Steam de l'utilisateur connecté, scopée IEVR.
			 * Exige une session (sessionMiddleware) ET que le user ait un steam_id.
			 */
			steamAccount: createAuthEndpoint(
				"/steam/account",
				{ method: "GET", use: [sessionMiddleware] },
				async (ctx) => {
					const sessionUser = ctx.context.session.user as { steamId?: string | null };
					const steamId = sessionUser.steamId;
					if (!steamId) {
						throw new APIError("BAD_REQUEST", {
							message: "Aucun compte Steam lié à cet utilisateur.",
						});
					}

					const apiKey = getApiKey();
					if (!apiKey) {
						// Pas de 500 : la clé Web API est une config optionnelle.
						return ctx.json({
							steamId,
							configured: false,
							account: null,
							message:
								"STEAM_WEB_API_KEY non configurée — vue compte Steam indisponible.",
						});
					}

					try {
						const client = new SteamWebApiClient({
							apiKey,
							appId,
							fetchImpl: options.fetchImpl,
						});
						const account = await client.getIevrAccount(steamId, language);
						return ctx.json({ steamId, configured: true, appId, account });
					} catch (e) {
						if (e instanceof SteamWebApiError) {
							throw new APIError("BAD_GATEWAY", { message: e.message });
						}
						throw e;
					}
				},
			),
		},
	} satisfies BetterAuthPlugin;
};

/** Récupère le résumé de profil pour pré-remplir le nouvel utilisateur, sans casser si pas de clé. */
async function fetchSummarySafe(
	apiKey: string | undefined,
	appId: number,
	steamId: string,
	fetchImpl?: typeof fetch,
) {
	if (!apiKey) {
		return null;
	}
	try {
		const client = new SteamWebApiClient({ apiKey, appId, fetchImpl });
		return await client.getPlayerSummary(steamId);
	} catch {
		return null;
	}
}

export { buildSteamLoginUrl, verifySteamAssertion } from "./openid";
export {
	SteamWebApiClient,
	SteamWebApiError,
	enrichAchievements,
	getIevrOwnershipWithToken,
	type IevrPlayerAchievement,
	type SteamIevrAccount,
	type SteamOwnedGame,
	type SteamPlayerAchievement,
	type SteamPlayerSummary,
} from "./web-api";
export {
	IEVR_STEAM_APP_ID,
	IEVR_STEAM,
	IEVR_SHARED_DEPOTS,
	IEVR_STEAM_INTERFACES,
	IEVR_STEAM_FEATURES,
	IEVR_ACHIEVEMENT_API_NAME_FORMAT,
	IEVR_ACHIEVEMENT_API_NAME_PREFIX,
	IEVR_TROPHY_COUNT,
	IEVR_VISIBLE_ACHIEVEMENT_COUNT,
	STEAM_PROVIDER_ID,
	achievementApiName,
	achievementNumFromApiName,
	extractSteamId64,
} from "./constants";
export {
	IEVR_ACHIEVEMENTS,
	IEVR_ACHIEVEMENTS_COUNT,
	type AchievementLanguage,
	type IevrAchievementInfo,
	achievementDisplayDescription,
	achievementDisplayName,
	lookupAchievement,
} from "./achievements";
