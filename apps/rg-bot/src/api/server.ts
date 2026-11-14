import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { swagger } from "@elysiajs/swagger";
import { achilleaModule } from "./modules/achillea";
import { wikiController } from "./modules/wiki";
import { communityController } from "./modules/community";
import { contentController } from "./modules/content";
import { billingController } from "./modules/billing";
import { inagleModule } from "./modules/inagle";
import { azaleeBridgeModule } from "./modules/azalee-bridge";
import { authController } from "./modules/auth";
import { dbPlugin } from "./plugins/db";
import { publicCache } from "./plugins/public-cache";
import { elysiaAuth } from "@rosegriffon/auth/elysia";
import { contractTrustedOrigins, STACK_CONTRACT } from "@rosegriffon/config/contract";
import { MONOREPO_OPENAPI } from "@rosegriffon/config/openapi";
import { handleAnnounceHttp, handleCronHttp } from "@rosegriffon/cron";

const allowedOrigins = new Set(
  [
    process.env.WEBSITE_URL,
    ...contractTrustedOrigins(process.env.NODE_ENV === "production"),
    ...(process.env.WEB_ALLOWED_ORIGINS ?? "").split(","),
  ]
    .map((origin) => origin?.trim().replace(/\/$/, ""))
    .filter((origin): origin is string => Boolean(origin)),
);

export const app = new Elysia()
  .use(dbPlugin)
  .use(
    cors({
      // Credentials and wildcard origins are incompatible. Reflect only the
      // explicitly configured first-party origins.
      origin: (request) => {
        const origin = request.headers.get("origin");
        return !origin || allowedOrigins.has(origin);
      },
      methods: [...STACK_CONTRACT.http.cors.methods],
      allowedHeaders: [...STACK_CONTRACT.http.cors.allowedHeaders],
      credentials: STACK_CONTRACT.http.cors.credentials,
    }),
  )
  // CDN caching of the anonymous public reads (free-tier guardrail).
  .use(publicCache)
  .use(
    swagger({
      path: STACK_CONTRACT.http.docsPath,
      documentation: {
        openapi: STACK_CONTRACT.openapi.version,
        info: {
          title: MONOREPO_OPENAPI.info.title,
          version: STACK_CONTRACT.project.version,
          description:
            "API unique du monorepo Rose Griffon (OpenAPI 3.2.1 · ElysiaJS + Kysely + Bun)",
        },
      },
    }),
  )
  .get(STACK_CONTRACT.http.openapiPath, () => MONOREPO_OPENAPI)
  // Better Auth sur SON préfixe (`basePath: "/v1/auth"`) et ses métadonnées `/.well-known`, pas
  // à la racine : monté sur `/`, il recevait toute URL inconnue et interrogeait la base pour
  // répondre — 500 au lieu de 404 dès que Postgres manquait. Les routes explicites de
  // `authController` (`/v1/auth/realtime-token`, `/v1/auth/logout`…) restent prioritaires.
  .all(`${STACK_CONTRACT.http.routes.authPrefix}/*`, ({ request }) => elysiaAuth.handler(request), {
    parse: "none",
  })
  .all(`${STACK_CONTRACT.http.routes.wellKnownPrefix}/*`, ({ request }) => elysiaAuth.handler(request), {
    parse: "none",
  })
  .get("/.well-known/agent-configuration", ({ request }) =>
    (
      elysiaAuth.api as unknown as {
        getAgentConfiguration: (input: {
          headers: Headers;
        }) => Promise<Response>;
      }
    ).getAgentConfiguration({ headers: request.headers }),
  )
  .get(STACK_CONTRACT.http.routes.health, () => ({
    status: "ok",
    service: "rg-api",
    uptime: process.uptime(),
    timestamp: Date.now(),
  }))
  // Tâches planifiées (appelées par pg_cron) et annonces Discord du site : Bearer, corps lu par le handler.
  // `?attendre=1` : pas d'`idleTimeout` (10 s) pendant que la tâche tourne (cf. `core.ts`).
  .all(
    `${STACK_CONTRACT.http.routes.cronPrefix}/*`,
    ({ request, server }) => {
      if (new URL(request.url).searchParams.get("attendre") === "1")
        server?.timeout(request, 0);
      return handleCronHttp(request);
    },
    { parse: "none" },
  )
  .post(STACK_CONTRACT.http.routes.discordAnnounce, ({ request }) => handleAnnounceHttp(request), {
    parse: "none",
  })
  .group(STACK_CONTRACT.http.apiPrefix, (v1) =>
    v1
      .use(achilleaModule)
      .use(wikiController)
      .use(communityController)
      .use(contentController)
      .use(billingController)
      .use(inagleModule)
      .use(azaleeBridgeModule)
      .use(authController)
      // Discord HTTP interactions forwarded by crates/aphrody-rg-server. Lazy:
      // the executor reads the bot token and loads the command modules.
      .post(
        "/discord/interactions/execute",
        async ({ request }) =>
          (await import("../interactions/executor")).executerInteractionDiscord(
            request,
          ),
        { parse: "none" },
      ),
  );

const PORT = Number(
  process.env.API_PORT ?? STACK_CONTRACT.http.defaultPorts.api,
);
const HOST = process.env.API_HOST ?? "0.0.0.0";

export function startApiServer(port = PORT, host = HOST) {
  return app.listen({ port, hostname: host }, () => {
    console.info(
      `[rg-api] Rose Griffon Unified API listening on http://${host}:${port}`,
    );
    console.info(
      `[rg-api] OpenAPI documentation available on http://${host}:${port}/docs`,
    );
  });
}

if (import.meta.main) {
  startApiServer();
}

export type App = typeof app;
