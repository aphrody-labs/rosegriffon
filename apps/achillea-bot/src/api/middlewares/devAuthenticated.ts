import crypto from "node:crypto";

import type { PlatformContext } from "@tsed/common";
import { Context, Middleware } from "@tsed/common";
import { BadRequest, Unauthorized } from "@tsed/exceptions";
import DiscordOauth2 from "discord-oauth2";

import { env } from "@/env";
import { Store } from "@/services";
import { isDev, resolveDependency } from "@/utils/functions";

const discordOauth2 = new DiscordOauth2();

const timeout = 10 * 60 * 1000;

@Middleware()
export class DevAuthenticated {
	private readonly storePromise = resolveDependency(Store);

	async use(@Context() { request }: PlatformContext) {
		const store = await this.storePromise;
		// check if the request includes valid authorization header
		const authHeader = request.headers.authorization;
		if (!authHeader || !authHeader.startsWith("Bearer ")) throw new BadRequest("Missing token");

		// get the token from the authorization header
		const token = authHeader.split(" ")[1];
		if (!token) throw new BadRequest("Invalid token");

		// pass if the token is the admin token (comparaison timing-safe, anti-timing-attack)
		const adminToken = env.API_ADMIN_TOKEN;
		if (
			adminToken &&
			token.length === adminToken.length &&
			crypto.timingSafeEqual(Buffer.from(token), Buffer.from(adminToken))
		) {
			return;
		}

		// directly skip the middleware if the token is already in the store, which is used here as a "cache"
		const authorizedAPITokens = store.get("authorizedAPITokens");
		if (authorizedAPITokens.includes(token)) return;

		// we get the user's profile from the token using the `discord-oauth2` package
		try {
			const user = await discordOauth2.getUser(token);

			// check if logged user is a dev (= admin) of the bot
			if (isDev(user.id)) {
				// we add the token to the store and set a timeout to remove it after 10 minutes
				store.update("authorizedAPITokens", (authorizedAPITokens) => [
					...authorizedAPITokens,
					token,
				]);
				setTimeout(() => {
					store.update("authorizedAPITokens", (authorizedAPITokens) =>
						authorizedAPITokens.filter((t) => t !== token)
					);
				}, timeout);
			} else {
				throw new Unauthorized("Unauthorized");
			}
		} catch (err) {
			throw new BadRequest("Invalid discord token");
		}
	}
}
