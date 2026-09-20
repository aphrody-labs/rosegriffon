/**
 * `/auth` — session Discord, jeton temps réel, déconnexion.
 *
 * Les points d'entrée OAuth (`/auth/discord`, `/auth/challonge`, `/auth/twitch`,
 * `/auth/callback`) répondent par une redirection HTTP, pas par du JSON : le
 * client n'en expose que les URL à faire suivre au navigateur. Aucune de ces
 * méthodes ne touche `window` — la navigation reste à la charge de l'appelant.
 */

import { z } from "zod";

import type { SessionUserDTO } from "@rosegriffon/achillea-types/domain/user";

import { okResponseSchema, userDtoSchema } from "./common";
import { AchilleaResource, type AchilleaClientResult } from "./http";
import type { RealtimeTokenResponse } from "./pending-contracts";

export const sessionUserSchema = userDtoSchema satisfies z.ZodType<SessionUserDTO>;

export const realtimeTokenResponseSchema = z.object({
	token: z.string(),
	expiresIn: z.number(),
	userId: z.string(),
}) satisfies z.ZodType<RealtimeTokenResponse>;

/** 9 routes (4 JSON, 5 redirections dont on n'expose que l'URL). */
export class AuthResource extends AchilleaResource {
	/** `GET /auth/me` — utilisateur de la session courante. */
	me(): Promise<AchilleaClientResult<SessionUserDTO>> {
		return this.http.get("/auth/me", sessionUserSchema);
	}

	/** `GET /auth/token` — jeton court pour le client temps réel Colyseus. */
	realtimeToken(): Promise<AchilleaClientResult<RealtimeTokenResponse>> {
		return this.http.get("/auth/token", realtimeTokenResponseSchema);
	}

	/** `POST /auth/logout` — route canonique de déconnexion. */
	logout(): Promise<AchilleaClientResult<{ ok: boolean }>> {
		return this.http.post("/auth/logout", okResponseSchema);
	}

	/** `GET /auth/logout` — variante historique, conservée le temps de la migration. */
	logoutLegacy(): Promise<AchilleaClientResult<{ ok: boolean }>> {
		return this.http.get("/auth/logout", okResponseSchema);
	}

	/**
	 * URL de `GET /auth/discord` — démarre la connexion Discord.
	 * `state` porte le chemin interne de retour (`/ranked`, `/compte`…).
	 */
	discordLoginUrl(state?: string): string {
		return this.http.url("/auth/discord", { state });
	}

	/** URL de `GET /auth/callback` — `redirect_uri` public de l'OAuth Discord. */
	callbackUrl(): string {
		return this.http.url("/auth/callback");
	}

	/** URL de `GET /auth/challonge` — liaison du compte Challonge (session requise). */
	challongeLinkUrl(): string {
		return this.http.url("/auth/challonge");
	}

	/** URL de `GET /auth/twitch` — liaison du compte Twitch (session requise). */
	twitchLinkUrl(): string {
		return this.http.url("/auth/twitch");
	}

	/**
	 * URL de `GET /auth/test-login` — session de test anonyme.
	 * Hors production uniquement, et gardée par `TEST_LOGIN_SECRET` (404 sinon).
	 */
	testLoginUrl(key: string, state?: string): string {
		return this.http.url("/auth/test-login", { key, state });
	}
}
