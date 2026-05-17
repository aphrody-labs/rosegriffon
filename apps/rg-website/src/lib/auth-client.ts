import { genericOAuthClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
	baseURL:
		typeof window !== "undefined"
			? window.location.origin
			: (process.env.BETTER_AUTH_URL ?? "https://rosegriffon.fr"),
	// genericOAuthClient expose authClient.signIn.oauth2() pour les providers
	// configurés via genericOAuth côté serveur (cf. src/lib/auth.ts → "patreon").
	plugins: [genericOAuthClient()],
});

export type ClientSession = typeof authClient.$Infer.Session;
