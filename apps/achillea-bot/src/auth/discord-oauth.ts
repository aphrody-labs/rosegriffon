const DISCORD_AUTHORIZE_URL = "https://discord.com/oauth2/authorize";
const DISCORD_TOKEN_URL = "https://discord.com/api/v10/oauth2/token";
const DISCORD_ME_URL = "https://discord.com/api/v10/users/@me";
const DISCORD_TIMEOUT_MS = 10_000;

export interface DiscordOAuthCredentials {
	clientId: string;
	clientSecret: string;
	redirectUri: string;
}

export interface DiscordIdentity {
	id: string;
	username: string;
	avatar: string;
}

export function discordAuthorizeUrl(clientId: string, redirectUri: string, state: string): string {
	if (!clientId) throw new Error("Discord client id missing");
	const url = new URL(DISCORD_AUTHORIZE_URL);
	url.search = new URLSearchParams({
		client_id: clientId,
		response_type: "code",
		redirect_uri: redirectUri,
		scope: "identify",
		state,
	}).toString();
	return url.toString();
}

async function discordFetch(url: string, init: RequestInit): Promise<Response> {
	return fetch(url, { ...init, signal: AbortSignal.timeout(DISCORD_TIMEOUT_MS) });
}

export async function exchangeDiscordCode(
	code: string,
	credentials: DiscordOAuthCredentials
): Promise<DiscordIdentity> {
	if (!code) throw new Error("Discord authorization code missing");

	const tokenResponse = await discordFetch(DISCORD_TOKEN_URL, {
		method: "POST",
		headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams({
			client_id: credentials.clientId,
			client_secret: credentials.clientSecret,
			grant_type: "authorization_code",
			code,
			redirect_uri: credentials.redirectUri,
		}),
	});
	if (!tokenResponse.ok) throw new Error(`Discord token exchange failed (${tokenResponse.status})`);

	const tokenBody = (await tokenResponse.json()) as { access_token?: unknown };
	if (typeof tokenBody.access_token !== "string" || !tokenBody.access_token) {
		throw new Error("Discord token response is malformed");
	}

	const meResponse = await discordFetch(DISCORD_ME_URL, {
		headers: { Accept: "application/json", Authorization: `Bearer ${tokenBody.access_token}` },
	});
	if (!meResponse.ok) throw new Error(`Discord profile request failed (${meResponse.status})`);

	const profile = (await meResponse.json()) as {
		id?: unknown;
		username?: unknown;
		avatar?: unknown;
	};
	if (typeof profile.id !== "string" || !profile.id || typeof profile.username !== "string") {
		throw new Error("Discord profile response is malformed");
	}

	return {
		id: profile.id,
		username: profile.username,
		avatar: typeof profile.avatar === "string" ? profile.avatar : "",
	};
}
