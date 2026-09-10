import { randomBytes, timingSafeEqual } from "node:crypto";

import jwt from "jsonwebtoken";

import { getCookieValue } from "@/auth";
import { env } from "@/env";

export { getCookieValue } from "@/auth";

export const OAUTH_STATE_COOKIE = "achillea_oauth_state";

const OAUTH_STATE_PURPOSE = "discord-login";
const OAUTH_STATE_TTL_SECONDS = 10 * 60;

type OAuthStatePayload = jwt.JwtPayload & {
	purpose: typeof OAUTH_STATE_PURPOSE;
	nonce: string;
	redirect: string;
};

export function isSafeInternalRedirect(value: unknown): value is string {
	if (
		typeof value !== "string" ||
		value.length > 2_048 ||
		!value.startsWith("/") ||
		value.startsWith("//") ||
		value.includes("\\") ||
		/[\u0000-\u001f\u007f]/.test(value)
	) {
		return false;
	}

	try {
		return new URL(value, "https://achillea.invalid").origin === "https://achillea.invalid";
	} catch {
		return false;
	}
}

export function configuredOAuthCallback(path = "/api/auth/callback"): string {
	return new URL(path, env.OAUTH_CALLBACK_BASE_URL).toString();
}

export function createOAuthState(redirect: unknown): { nonce: string; state: string } {
	const nonce = randomBytes(32).toString("base64url");
	const state = jwt.sign(
		{
			purpose: OAUTH_STATE_PURPOSE,
			nonce,
			redirect: isSafeInternalRedirect(redirect) ? redirect : "/",
		},
		env.JWT_SECRET_KEY,
		{ algorithm: "HS256", expiresIn: OAUTH_STATE_TTL_SECONDS }
	);

	return { nonce, state };
}

export function verifyOAuthState(state: unknown, cookieHeader: string | undefined): string {
	if (typeof state !== "string" || !state) throw new Error("Missing OAuth state");

	const cookieNonce = getCookieValue(cookieHeader, OAUTH_STATE_COOKIE);
	if (!cookieNonce) throw new Error("Missing OAuth state cookie");

	const decoded = jwt.verify(state, env.JWT_SECRET_KEY, {
		algorithms: ["HS256"],
	}) as OAuthStatePayload;

	if (
		decoded.purpose !== OAUTH_STATE_PURPOSE ||
		typeof decoded.nonce !== "string" ||
		!isSafeInternalRedirect(decoded.redirect)
	) {
		throw new Error("Invalid OAuth state");
	}

	const actual = Buffer.from(decoded.nonce);
	const expected = Buffer.from(cookieNonce);
	if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
		throw new Error("Invalid OAuth state cookie");
	}

	return decoded.redirect;
}

export type AuthNotice = "denied" | "error";

/**
 * Discord renvoie `?error=access_denied` quand l'utilisateur refuse l'autorisation
 * (ou ferme la fenetre de consentement). On rebascule alors sur le site avec une
 * notice `?auth=…` que le front transforme en message, au lieu d'afficher une
 * page d'erreur brute a l'utilisateur.
 */
export function withAuthNotice(redirect: string, notice: AuthNotice): string {
	const url = new URL(isSafeInternalRedirect(redirect) ? redirect : "/", "https://achillea.invalid");
	url.searchParams.set("auth", notice);

	return `${url.pathname}${url.search}${url.hash}`;
}

/** Redirection interne portee par le state, ou la racine si le state est invalide. */
export function safeRedirectFromState(state: unknown, cookieHeader: string | undefined): string {
	try {
		return verifyOAuthState(state, cookieHeader);
	} catch {
		return "/";
	}
}

export const oauthStateCookieOptions = {
	httpOnly: true,
	secure: new URL(env.OAUTH_CALLBACK_BASE_URL).protocol === "https:",
	sameSite: "lax" as const,
	maxAge: OAUTH_STATE_TTL_SECONDS * 1000,
	path: "/",
};

// I have nothing but my burger and I want nothing more
