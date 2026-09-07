import axios from "axios";

import { Service } from "@/decorators";
import { UserConnection } from "@/entities";
import { env } from "@/env";

import { Provider } from "../utils/enums";
import { Database } from "./Database";
import { Store } from "./Store";

@Service()
export class TwitchService {
	constructor(
		private db: Database,
		private store: Store
	) {}

	async hasLinkedTwitch(userId: string) {
		return await this.db.em.findOne(UserConnection, { user: userId, provider: Provider.TWITCH });
	}

	private async getValidAppToken() {
		if (!env.TWITCH_CLIENT_ID || !env.TWITCH_SECRET) {
			return false;
		}

		const now = Date.now() / 1000; // current time in seconds
		const storeToken = this.store.get("twitchAppTokens");
		if (storeToken && this.store.get("twitchAppTokenExpiry") > now + 60) {
			// 60 sec buffer
			return storeToken;
		}

		const response = await axios.post(
			"https://id.twitch.tv/oauth2/token",
			new URLSearchParams({
				client_id: env.TWITCH_CLIENT_ID,
				client_secret: env.TWITCH_SECRET,
				grant_type: "client_credentials",
			}).toString(),
			{
				headers: { "Content-Type": "application/x-www-form-urlencoded" },
			}
		);
		const cachedAppToken = response.data.access_token;
		this.store.set("twitchAppTokens", cachedAppToken);
		const cachedAppTokenExpiresAt = now + response.data.expires_in;
		this.store.set("twitchAppTokenExpiry", cachedAppTokenExpiresAt);

		return cachedAppToken;
	}

	async isUserStreaming(userId: string) {
		const twitchDetails = await this.db.em.findOne(UserConnection, {
			user: userId,
			provider: Provider.TWITCH,
		});

		if (!twitchDetails) return false;

		const res = await axios.get("https://api.twitch.tv/helix/streams", {
			params: { user_id: twitchDetails.externalId },
			headers: {
				"Client-ID": env.TWITCH_CLIENT_ID,
				Authorization: `Bearer ${await this.getValidAppToken()}`, // This is your App Access Token, not the user's token
			},
		});

		return res.data.data.length > 0;
	}

	async areUsersStreaming(twitchIds: string[]): Promise<Set<string>> {
		const LIVE_BATCH_SIZE = 100;
		const liveTwitchIds = new Set<string>();

		for (let i = 0; i < twitchIds.length; i += LIVE_BATCH_SIZE) {
			const batch = twitchIds.slice(i, i + LIVE_BATCH_SIZE);

			const params = new URLSearchParams();
			for (const id of batch) params.append("user_id", id);

			const res = await axios.get(`https://api.twitch.tv/helix/streams?${params.toString()}`, {
				headers: {
					"Client-ID": env.TWITCH_CLIENT_ID,
					Authorization: `Bearer ${await this.getValidAppToken()}`,
				},
			});

			for (const stream of res.data.data) {
				liveTwitchIds.add(stream.user_id);
			}
		}

		return liveTwitchIds;
	}
}
