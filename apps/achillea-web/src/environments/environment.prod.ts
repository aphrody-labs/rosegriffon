import { runtimeConfig } from "./runtime-config";

/** Production contains no endpoint or credential; public values come from achillea-config.js. */
export const environment = {
	production: true,
	apiBaseUrl: runtimeConfig.apiBaseUrl,
	socketUrl: runtimeConfig.socketUrl,
	socketPath: runtimeConfig.socketPath,
	colyseusUrl: runtimeConfig.colyseusUrl,
	cdnBaseUrl: runtimeConfig.cdnBaseUrl,
	supabaseUrl: runtimeConfig.supabaseUrl,
	supabaseKey: runtimeConfig.supabasePublishableKey,
	supabaseJwksUrl: runtimeConfig.supabaseJwksUrl,
	youtubeApiKey: runtimeConfig.youtubeApiKey,
	youtubeChannelId: runtimeConfig.youtubeChannelId,
	links: {
		company: "https://www.rosegriffon.fr/",
		sister: "https://azalee.rosegriffon.fr/",
		discord: "https://discord.gg/rosegriffon",
		twitter: "https://x.com/Achillea_IE",
	},
};
