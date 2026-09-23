const SITE_AUTH_URL = "https://rosegriffon.fr";

function isLoopback(hostname: string): boolean {
	return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

/** Resolve Better Auth's origin without allowing a production callback to point at a developer machine. */
export function resolveAuthBaseURL(input: {
	origin?: string | null;
	configured?: string | null;
	production: boolean;
}): string {
	const origin = input.origin?.trim();
	if (origin) {
		try {
			const parsed = new URL(origin);
			const rosegriffonHost = parsed.hostname === "rosegriffon.fr" || parsed.hostname.endsWith(".rosegriffon.fr");
			if (parsed.protocol === "https:" && rosegriffonHost) return SITE_AUTH_URL;
			if (!input.production && /^https?:$/.test(parsed.protocol) && isLoopback(parsed.hostname)) {
				return parsed.origin;
			}
		} catch {
			// Ignore a malformed browser origin and use the configured safe origin.
		}
	}

	const configured = input.configured?.trim();
	if (configured && configured !== "undefined" && configured !== "null") {
		try {
			const parsed = new URL(configured);
			if (/^https?:$/.test(parsed.protocol) && (!input.production || !isLoopback(parsed.hostname))) {
				return parsed.origin;
			}
		} catch {
			// Fall through to the canonical public site.
		}
	}
	return SITE_AUTH_URL;
}
