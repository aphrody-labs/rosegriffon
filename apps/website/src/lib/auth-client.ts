import { passkeyClient } from "@better-auth/passkey/client";
import { twoFactorClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

const getBaseURL = () => {
	if (typeof window !== "undefined") {
		const origin = window.location.origin;
		if (origin?.startsWith("http") && origin.includes("rosegriffon.fr")) {
			return "https://rosegriffon.fr";
		}
		if (origin && /^https?:\/\//.test(origin)) return origin;
	}
	const url = process.env.BETTER_AUTH_URL;
	if (
		!url ||
		url === "undefined" ||
		url === "null" ||
		!url.startsWith("http")
	) {
		return "https://rosegriffon.fr";
	}
	return url;
};

export const authClient = createAuthClient({
	baseURL: getBaseURL(),
	plugins: [
		passkeyClient(),
		twoFactorClient({
			onTwoFactorRedirect() {
				if (typeof window !== "undefined") {
					window.location.href = "/2fa";
				}
			},
		}),
	],
});

export type ClientSession = typeof authClient.$Infer.Session;
