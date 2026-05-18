import { genericOAuthClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

const getBaseURL = () => {
	if (typeof window !== "undefined") return window.location.origin;
	const url = process.env.BETTER_AUTH_URL;
	if (!url || url === "undefined" || url === "null" || !url.startsWith("http")) {
		return "https://rosegriffon.fr";
	}
	return url;
};

export const authClient = createAuthClient({
	baseURL: getBaseURL(),
	// genericOAuthClient expose authClient.signIn.oauth2() pour les providers
	// configurés via genericOAuth côté serveur (cf. src/lib/auth.ts → "patreon").
	plugins: [genericOAuthClient()],
});

export type ClientSession = typeof authClient.$Infer.Session;
