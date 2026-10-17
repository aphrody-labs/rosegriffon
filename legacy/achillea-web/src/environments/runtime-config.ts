export interface AchilleaRuntimeConfig {
	apiBaseUrl: string;
	socketUrl: string;
	socketPath: string;
	colyseusUrl: string;
	cdnBaseUrl: string;
	supabaseUrl: string;
	supabasePublishableKey: string;
	supabaseJwksUrl: string;
	youtubeApiKey: string;
	youtubeChannelId: string;
}

type RuntimeGlobal = typeof globalThis & {
	__ACHILLEA_CONFIG__?: Partial<AchilleaRuntimeConfig>;
};

const injected = (globalThis as RuntimeGlobal).__ACHILLEA_CONFIG__ ?? {};

function text(key: keyof AchilleaRuntimeConfig, fallback = ""): string {
	const value = injected[key];
	return typeof value === "string" ? value.trim() : fallback;
}

/** Public browser configuration loaded synchronously by index.html before Angular boots. */
export const runtimeConfig: Readonly<AchilleaRuntimeConfig> = Object.freeze({
	apiBaseUrl: text("apiBaseUrl"),
	socketUrl: text("socketUrl"),
	socketPath: text("socketPath", "/socket.io"),
	colyseusUrl: text("colyseusUrl"),
	cdnBaseUrl: text("cdnBaseUrl"),
	supabaseUrl: text("supabaseUrl"),
	supabasePublishableKey: text("supabasePublishableKey"),
	supabaseJwksUrl: text("supabaseJwksUrl"),
	youtubeApiKey: text("youtubeApiKey"),
	youtubeChannelId: text("youtubeChannelId"),
});
