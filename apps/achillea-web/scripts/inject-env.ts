#!/usr/bin/env bun
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

interface RuntimeConfig {
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

const appRoot = resolve(import.meta.dir, "..");
const outputDirectory = resolve(appRoot, ".angular/runtime");
const outputPath = resolve(outputDirectory, "achillea-config.js");

function value(name: string, fallback = ""): string {
	return process.env[name]?.trim() || fallback;
}

function validateUrl(
	name: keyof RuntimeConfig,
	input: string,
	protocols: readonly string[],
	allowRelative = false
): string {
	if (!input) return "";
	if (allowRelative && input.startsWith("/") && !input.startsWith("//"))
		return input.replace(/\/$/, "");

	let parsed: URL;
	try {
		parsed = new URL(input);
	} catch {
		throw new Error(
			`${name} must be an absolute URL${allowRelative ? " or a root-relative path" : ""}`
		);
	}
	if (!protocols.includes(parsed.protocol))
		throw new Error(`${name} uses unsupported protocol ${parsed.protocol}`);

	const hostname = parsed.hostname.toLowerCase();
	const isIpv4 = /^(?:\d{1,3}\.){3}\d{1,3}$/.test(hostname);
	const isIpv6 = hostname.startsWith("[") || hostname.includes(":");
	if (hostname === "localhost" || hostname.endsWith(".localhost") || isIpv4 || isIpv6) {
		throw new Error(`${name} must use a DNS hostname, not localhost or an IP literal`);
	}
	return input.replace(/\/$/, "");
}

const config: RuntimeConfig = {
	apiBaseUrl: validateUrl("apiBaseUrl", value("ACHILLEA_API_BASE_URL"), ["http:", "https:"], true),
	socketUrl: validateUrl(
		"socketUrl",
		value("ACHILLEA_SOCKET_URL"),
		["http:", "https:", "ws:", "wss:"],
		true
	),
	socketPath: value("ACHILLEA_SOCKET_PATH", "/socket.io"),
	colyseusUrl: validateUrl("colyseusUrl", value("ACHILLEA_COLYSEUS_URL"), ["ws:", "wss:"]),
	cdnBaseUrl: validateUrl("cdnBaseUrl", value("ACHILLEA_CDN_BASE_URL"), ["https:"]),
	supabaseUrl: validateUrl("supabaseUrl", value("SUPABASE_URL"), ["https:"]),
	supabasePublishableKey: value("SUPABASE_PUBLISHABLE_KEY"),
	supabaseJwksUrl: validateUrl("supabaseJwksUrl", value("SUPABASE_JWKS_URL"), ["https:"]),
	youtubeApiKey: value("ACHILLEA_YOUTUBE_API_KEY"),
	youtubeChannelId: value("ACHILLEA_YOUTUBE_CHANNEL_ID"),
};

if (!config.socketPath.startsWith("/")) throw new Error("socketPath must start with /");

await mkdir(outputDirectory, { recursive: true });
await Bun.write(
	outputPath,
	`// Generated public browser configuration. Replace this file at runtime when needed.\n` +
		`globalThis.__ACHILLEA_CONFIG__ = Object.freeze(${JSON.stringify(config, null, 2)});\n`
);
console.log(
	`[config] generated ${outputPath} (${Object.values(config).filter(Boolean).length} configured values)`
);
