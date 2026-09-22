import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { swagger } from "@elysiajs/swagger";
import { achilleaModule } from "./modules/achillea";
import { wikiController } from "./modules/wiki";
import { communityController } from "./modules/community";
import { contentController } from "./modules/content";
import { billingController } from "./modules/billing";
import { storageController } from "./modules/storage";
import { realtimeController } from "./modules/realtime";
import { inagleModule } from "./modules/inagle";
import { azaleeBridgeModule } from "./modules/azalee-bridge";
import { authController } from "./modules/auth";
import { dbPlugin } from "./plugins/db";

const allowedOrigins = new Set(
	[
		process.env.WEBSITE_URL,
		"https://rosegriffon.fr",
		"https://www.rosegriffon.fr",
		...(process.env.WEB_ALLOWED_ORIGINS ?? "").split(","),
	]
		.map((origin) => origin?.trim().replace(/\/$/, ""))
		.filter((origin): origin is string => Boolean(origin))
);

export const app = new Elysia()
	.use(dbPlugin)
	.use(cors({
		// Credentials and wildcard origins are incompatible. Reflect only the
		// explicitly configured first-party origins.
		origin: (request) => {
			const origin = request.headers.get("origin");
			return !origin || allowedOrigins.has(origin);
		},
		methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
		allowedHeaders: ["Content-Type", "Authorization", "X-Api-Key", "X-Internal-Secret"],
		credentials: true,
	}))
	.use(swagger({
		path: "/docs",
		documentation: {
			info: {
				title: "Rose Griffon Unified API",
				version: "3.0.0",
				description: "API unique du monorepo Rose Griffon (ElysiaJS + Kysely + Bun)"
			}
		}
	}))
	.get("/health", () => ({
		status: "ok",
		service: "rg-api",
		uptime: process.uptime(),
		timestamp: Date.now()
	}))
	.group("/v1", (v1) => v1
		.use(achilleaModule)
		.use(wikiController)
		.use(communityController)
		.use(contentController)
		.use(billingController)
		.use(storageController)
		.use(realtimeController)
		.use(inagleModule)
		.use(azaleeBridgeModule)
		.use(authController)
	);

const PORT = Number(process.env.API_PORT ?? 8800);
const HOST = process.env.API_HOST ?? "0.0.0.0";

if (import.meta.main) {
	app.listen({ port: PORT, hostname: HOST }, () => {
		console.info(`[rg-api] Rose Griffon Unified API listening on http://${HOST}:${PORT}`);
		console.info(`[rg-api] OpenAPI documentation available on http://${HOST}:${PORT}/docs`);
	});
}

export type App = typeof app;
