import { createAuthClient } from "better-auth/react";
import { twoFactorClient } from "better-auth/client/plugins";
import { steamClient } from "@rose-griffon/better-auth-steam/client";
import { getPublicOrigin } from "@/lib/site-url";

const getBaseURL = () => {
	if (typeof window !== "undefined") {
		return window.location.origin;
	}
	// SSR / RSC : origin public canonique (jamais le host interne du self-host).
	return getPublicOrigin();
};

export const authClient = createAuthClient({
	baseURL: getBaseURL(),
	plugins: [
		twoFactorClient({
			onTwoFactorRedirect() {
				if (typeof window !== "undefined") {
					window.location.href = "/2fa";
				}
			},
		}),
		steamClient(),
	],
});
