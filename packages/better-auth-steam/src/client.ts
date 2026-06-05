/**
 * Plugin client Better Auth « steam ».
 *
 * Modèle : `anonymousClient` du cœur (un objet `{ id, $InferServerPlugin, pathMethods }`).
 * On déclare le type du plugin serveur via `$InferServerPlugin` pour que le client expose
 * les actions typées (`authClient.steam.*`). On ajoute aussi un helper d'ergonomie
 * `signIn.steam()` qui déclenche la redirection GET `/sign-in/steam`.
 */

import type { BetterAuthClientPlugin } from "better-auth/client";

import type { steam } from "./index";

export const steamClient = () => {
	return {
		id: "steam",
		$InferServerPlugin: {} as ReturnType<typeof steam>,
		pathMethods: {
			"/sign-in/steam": "GET",
			"/steam/callback": "GET",
			"/steam/account": "GET",
		},
		// `/sign-in/steam` est une navigation top-level (redirection OpenID), pas un fetch.
		// On expose une action côté client qui pose simplement `window.location`.
		getActions: ($fetch, _$store, options) => {
			const baseURL =
				(options?.baseURL as string | undefined) ??
				(typeof window !== "undefined" ? window.location.origin : "");
			return {
				signIn: {
					/**
					 * Démarre le login Steam : redirige le navigateur vers l'endpoint serveur
					 * `/sign-in/steam` (qui redirige à son tour vers Steam OpenID).
					 */
					steam: (opts?: { callbackURL?: string }) => {
						if (typeof window === "undefined") {
							return;
						}
						const url = new URL(`${baseURL}/api/auth/sign-in/steam`);
						if (opts?.callbackURL) {
							url.searchParams.set("callbackURL", opts.callbackURL);
						}
						window.location.href = url.toString();
					},
				},
			};
		},
	} satisfies BetterAuthClientPlugin;
};
