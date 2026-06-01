import { createAuthClient } from "better-auth/react";
import { twoFactorClient } from "better-auth/client/plugins";

const getBaseURL = () => {
	if (typeof window !== "undefined") {
		return window.location.origin;
	}
	const url = process.env.BETTER_AUTH_URL;
	if (!url || url === "undefined" || url === "null" || !url.startsWith("http")) {
		return "https://azalee.rosegriffon.fr";
	}
	return url;
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
	],
});
