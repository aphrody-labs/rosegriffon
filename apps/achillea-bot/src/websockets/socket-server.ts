import http from "node:http";

import express from "express";
import jwt from "jsonwebtoken";
import type { DefaultEventsMap, ExtendedError, Socket } from "socket.io";
import { Server as SocketIOServer } from "socket.io";

import { urlsConfig } from "@/configs/urls";
import { env } from "@/env";

// Create an Express app (optional; you can use plain HTTP too)
const app = express();

// Create a bare HTTP server
const server = http.createServer(app);

// Create a Socket.IO server on top
export const io = new SocketIOServer(server, {
	cors: {
		// Allowlist d'origines (WEB_ALLOWED_ORIGINS) au lieu de refléter n'importe quelle origine.
		origin: [...urlsConfig.allowedOrigins],
		credentials: true,
	},
});

// ─── GLOBAL JWT AUTH MIDDLEWARE ─────────────────────────────────────────
function authMiddleware(
	socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
	next: (err?: ExtendedError) => void
) {
	try {
		// Le front cross-domain (achillea.* → ranked.*) ne peut PAS s'appuyer sur le cookie
		// `token` (il ne traverse pas le domaine, exactement comme pour Colyseus). On accepte
		// donc le JWT passé dans le handshake Socket.IO (`auth: { token }`), avec repli cookie
		// pour le same-origin (dev local).
		const authToken =
			typeof (socket.handshake.auth as { token?: unknown })?.token === "string"
				? (socket.handshake.auth as { token: string }).token
				: null;
		const rawCookie = socket.handshake.headers.cookie;
		const token = authToken ?? (rawCookie ? getCookieValue(rawCookie, "token") : null);
		if (!token) {
			console.warn("⚠ Token absent (ni handshake auth ni cookie)");

			return next(new Error("Authentication error"));
		}

		const payload = jwt.verify(token, env.JWT_SECRET_KEY, { algorithms: ["HS256"] });
		if (typeof payload === "string" || typeof payload.id !== "string" || !payload.id) {
			return next(new Error("Authentication error"));
		}
		(socket as any).user = payload;

		next();
	} catch (err) {
		next(new Error("Authentication error"));
	}
}

function getCookieValue(cookieHeader: string, name: string) {
	if (!cookieHeader) return null;

	const parts = cookieHeader.split(";");
	for (const part of parts) {
		const [key, ...vals] = part.trim().split("=");
		if (key === name) {
			return decodeURIComponent(vals.join("="));
		}
	}

	return null;
}

// ─── /notifications ─────────────────────────────────────────────────────
export const notificationsNs = io.of("/notifications");

notificationsNs.use(authMiddleware);

notificationsNs.on("connection", (socket) => {
	const user = (socket as any).user;
	console.info("📬 /notifications connected", socket.id, "user:", user);

	socket.join(`user:${user.id}`);

	socket.on("disconnect", () => {
		console.info("❌ /notifications disconnected", socket.id);
	});
});

export function emitToUsers(userIds: string[], event: string, payload: any) {
	if (userIds.length === 0) {
		return;
	}

	// You can pass an array of rooms directly
	notificationsNs.to(userIds.map((id) => `user:${id}`)).emit(event, payload);
}

export async function startSocketServer(port: number, host = "127.0.0.1"): Promise<void> {
	if (server.listening) return;

	await new Promise<void>((resolve, reject) => {
		const onError = (error: Error) => {
			server.off("listening", onListening);
			reject(error);
		};
		const onListening = () => {
			server.off("error", onError);
			console.info(`🟦 Socket.IO server listening on ${host}:${port}`);
			resolve();
		};

		server.once("error", onError);
		server.once("listening", onListening);
		server.listen(port, host);
	});
}

export async function stopSocketServer(): Promise<void> {
	if (!server.listening) return;

	await new Promise<void>((resolve) => {
		io.close(() => resolve());
	});
}
