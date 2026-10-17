import { runtimeConfig } from "./runtime-config";

export const environment = {
	production: false,
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
	// Liens de marque / sociaux (contenu, pas d'infra) — source unique.
	links: {
		company: "https://www.rosegriffon.fr/",
		sister: "https://azalee.rosegriffon.fr/",
		discord: "https://discord.gg/rosegriffon",
		twitter: "https://x.com/Achillea_IE",
	},
};
