// Vérifie le cookie session du frontend pour Colyseus onAuth + REST.
// Le bot signe avec process.env.JWT_SECRET_KEY ; le frontend doit utiliser
// la même clé et le même nom de cookie (`token`) — voir docs/ranking.md §6.

import jwt from "jsonwebtoken";

export interface SessionUser {
	id: string;
	username?: string;
	avatar?: string;
}

export function getCookie(cookieHeader: string | null, name: string): string | null {
	if (!cookieHeader) return null;
	for (const part of cookieHeader.split(";")) {
		const [k, ...v] = part.trim().split("=");
		if (k === name) return decodeURIComponent(v.join("="));
	}
	return null;
}

export function verifyToken(token: string): SessionUser {
	const secret = process.env.JWT_SECRET_KEY;
	if (!secret) throw new Error("JWT_SECRET_KEY missing");
	const payload = jwt.verify(token, secret, { algorithms: ["HS256"] }) as Record<string, unknown>;
	const id = typeof payload.id === "string" ? payload.id : String(payload.sub ?? "");
	if (!id) throw new Error("Token sans id");
	return {
		id,
		username: typeof payload.username === "string" ? payload.username : undefined,
		avatar: typeof payload.avatar === "string" ? payload.avatar : undefined,
	};
}

export function authFromCookieHeader(header: string | null): SessionUser | null {
	const token = getCookie(header, "token");
	if (!token) return null;
	try {
		return verifyToken(token);
	} catch {
		return null;
	}
}

export function authFromAuthorization(header: string | null): SessionUser | null {
	if (!header) return null;
	const m = /^Bearer\s+(.+)$/i.exec(header);
	if (!m) return null;
	try {
		return verifyToken(m[1]);
	} catch {
		return null;
	}
}

// Lit un en-tête quel que soit le support : objet plain (`{ cookie: "..." }`)
// ou instance Web `Headers` (transport Bun WebSockets → `headers.get(name)`).
function readHeader(headers: unknown, name: string): string | null {
	if (!headers) return null;
	if (typeof (headers as Headers).get === "function") {
		return (headers as Headers).get(name);
	}
	const v = (headers as Record<string, unknown>)[name];
	return typeof v === "string" ? v : null;
}

// Auth unifiée pour Colyseus `onAuth(client, options, context)`.
// Colyseus 0.17 (transport Bun) fournit un `context = { token, headers, ip }` :
//   - `context.token` = `_authToken` (query) ?? Bearer de l'en-tête Authorization,
//   - `context.headers` = instance `Headers` (donc accès via `.get()`).
// On tente, dans l'ordre : context.token → cookie `token` → Authorization → options.token.
export function authFromColyseus(options: any, context: any): SessionUser | null {
	const ctxToken = typeof context?.token === "string" ? context.token : null;
	if (ctxToken) {
		try {
			return verifyToken(ctxToken);
		} catch {
			/* on continue avec les autres sources */
		}
	}
	const cookieHeader = readHeader(context?.headers, "cookie");
	const fromCookie = authFromCookieHeader(cookieHeader);
	if (fromCookie) return fromCookie;
	const authHeader = readHeader(context?.headers, "authorization");
	const fromAuth = authFromAuthorization(authHeader);
	if (fromAuth) return fromAuth;
	if (typeof options?.token === "string") {
		try {
			return verifyToken(options.token);
		} catch {
			return null;
		}
	}
	return null;
}
