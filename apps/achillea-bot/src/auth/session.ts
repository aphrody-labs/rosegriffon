import jwt, { type JwtPayload, type SignOptions } from "jsonwebtoken";

export const SESSION_COOKIE_NAME = "token";
export const AUTH_ISSUER = "achillea";
export const SESSION_AUDIENCE = "achillea-web";
export const REALTIME_AUDIENCE = "achillea-realtime";
export const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;
export const REALTIME_TTL_SECONDS = 5 * 60;

export type AuthTokenUse = "session" | "realtime";

export interface SessionIdentity {
	id: string;
	username?: string;
	avatar?: string;
	sim?: number;
}

type AuthPayload = JwtPayload &
	SessionIdentity & {
		tokenUse?: AuthTokenUse;
	};

function secret(): string {
	const value = process.env.JWT_SECRET_KEY;
	if (!value) throw new Error("JWT_SECRET_KEY missing");
	return value;
}

function audienceFor(use: AuthTokenUse): string {
	return use === "session" ? SESSION_AUDIENCE : REALTIME_AUDIENCE;
}

function signToken(
	identity: SessionIdentity,
	use: AuthTokenUse,
	expiresIn: SignOptions["expiresIn"]
): string {
	if (!identity.id) throw new Error("Cannot sign an auth token without a user id");

	return jwt.sign(
		{
			id: identity.id,
			...(identity.username ? { username: identity.username } : {}),
			...(identity.avatar !== undefined ? { avatar: identity.avatar } : {}),
			...(identity.sim !== undefined ? { sim: identity.sim } : {}),
			tokenUse: use,
		},
		secret(),
		{
			algorithm: "HS256",
			subject: identity.id,
			issuer: AUTH_ISSUER,
			audience: audienceFor(use),
			expiresIn,
		}
	);
}

export function signSessionToken(
	identity: SessionIdentity,
	expiresIn: SignOptions["expiresIn"] = SESSION_TTL_SECONDS
): string {
	return signToken(identity, "session", expiresIn);
}

export function signRealtimeToken(identity: SessionIdentity): string {
	return signToken(identity, "realtime", REALTIME_TTL_SECONDS);
}

function normalizeIdentity(payload: AuthPayload): SessionIdentity {
	const id = typeof payload.id === "string" && payload.id ? payload.id : payload.sub;
	if (typeof id !== "string" || !id) throw new Error("Token sans id");
	if (payload.id && payload.sub && payload.id !== payload.sub) {
		throw new Error("Token identity mismatch");
	}

	return {
		id,
		username: typeof payload.username === "string" ? payload.username : undefined,
		avatar: typeof payload.avatar === "string" ? payload.avatar : undefined,
		sim: typeof payload.sim === "number" ? payload.sim : undefined,
	};
}

/**
 * Verifies a signed Achillea token and enforces its intended use.
 *
 * Tokens issued before the centralized contract had no issuer/audience/tokenUse.
 * They remain accepted during the natural 30-day cookie rollover, but every new
 * token is purpose-bound and cannot be reused between the web and realtime tiers.
 */
export function verifyAuthToken(
	token: string,
	acceptedUse: AuthTokenUse,
	allowLegacy = true
): SessionIdentity {
	const decoded = jwt.verify(token, secret(), { algorithms: ["HS256"] });
	if (typeof decoded === "string") throw new Error("Invalid token payload");
	const payload = decoded as AuthPayload;

	if (payload.tokenUse === undefined) {
		if (!allowLegacy) throw new Error("Legacy token rejected");
		return normalizeIdentity(payload);
	}

	if (payload.tokenUse !== acceptedUse) throw new Error("Invalid token use");
	if (payload.iss !== AUTH_ISSUER) throw new Error("Invalid token issuer");
	const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
	if (!audiences.includes(audienceFor(acceptedUse))) throw new Error("Invalid token audience");

	return normalizeIdentity(payload);
}

export function verifySessionToken(token: string, allowLegacy = true): SessionIdentity {
	return verifyAuthToken(token, "session", allowLegacy);
}

export function verifyRealtimeToken(token: string, allowLegacy = true): SessionIdentity {
	return verifyAuthToken(token, "realtime", allowLegacy);
}

export function getCookieValue(header: string | null | undefined, name: string): string | null {
	if (!header) return null;

	for (const part of header.split(";")) {
		const [key, ...value] = part.trim().split("=");
		if (key !== name) continue;
		try {
			return decodeURIComponent(value.join("="));
		} catch {
			return null;
		}
	}

	return null;
}

export function sessionCookieOptions(secure: boolean) {
	return {
		httpOnly: true,
		secure,
		sameSite: "lax" as const,
		maxAge: SESSION_TTL_SECONDS * 1000,
		path: "/",
	};
}

export function sessionClearCookieOptions(secure: boolean) {
	const { maxAge: _maxAge, ...options } = sessionCookieOptions(secure);
	return options;
}
