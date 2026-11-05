/**
 * Achilléa authentication, end to end, offline (unified API, `/v1/auth/*`).
 *
 * FLOW UNDER TEST (apps/rg-bot/src/api/modules/auth)
 * Achilléa has no login screen of its own any more: its identity is the
 * Discord id, and the session is DERIVED from a Rose Griffon session.
 * 1. The website route `POST /api/achillea/session` (rg-website) reads the RG
 *    Better Auth session and calls `POST /v1/auth/session/exchange` with the
 *    internal bearer `API_ADMIN_TOKEN` and `{ betterAuthUserId }`.
 * 2. The exchange resolves the linked Discord account (`public.account`,
 *    provider_id = 'discord'), upserts `achillea."user"` (keyed by the Discord
 *    id) and signs an HS256 JWT with `JWT_SECRET_KEY`: iss "achillea", aud
 *    "achillea-web", tokenUse "session", 30 days. No Discord link -> 409.
 * 3. The website stores it in the cookie `token` (Domain=.rosegriffon.fr in
 *    production, HttpOnly, SameSite=Lax, Secure). Every protected Achilléa
 *    route resolves `Authorization: Bearer <jwt>` or that cookie
 *    (`resolveAchilleaSession`), e.g. `GET /v1/auth/me`.
 * 4. `GET /v1/auth/realtime-token` mints a 5-minute token (aud
 *    "achillea-realtime") that cannot stand in for the session, and back.
 * 5. `POST /v1/auth/logout` erases `token` with the same domain and path.
 * 6. Provider OAuth (Twitch, Challonge) LINKS a connection to an existing
 *    Achilléa user: `GET /v1/auth/oauth/:provider/start` stores a one-time CSRF
 *    token in `oauth_csrf` and returns the authorize URL (redirect_uri
 *    https://api.rosegriffon.fr/v1/auth/oauth/callback?provider=...,
 *    state = "<discordId>:<48 hex>"); `GET /v1/auth/oauth/callback` consumes
 *    the state (single use, 10 minutes), exchanges the code and stores
 *    `user_connection`, then redirects to the website profile.
 *
 * The database is a recording Kysely driver, provider endpoints answer from an
 * intercepted `fetch`, every secret is generated here.
 */
import "../../../../test/setup";
import { afterAll, beforeAll, beforeEach, describe, expect, mock, test } from "bun:test";
import { createHmac, randomBytes } from "node:crypto";
import {
  Kysely,
  PostgresAdapter,
  PostgresIntrospector,
  PostgresQueryCompiler,
  type CompiledQuery,
  type DatabaseConnection,
  type Driver,
  type QueryResult,
} from "kysely";
import type { Database } from "@rosegriffon/db/schema";
import {
  ACHILLEA_REALTIME_AUDIENCE,
  ACHILLEA_SESSION_AUDIENCE,
  verifyAchilleaRealtimeToken,
  verifyAchilleaSessionToken,
} from "@rosegriffon/achillea-core/auth";
import { signAchilleaRealtimeToken, signAchilleaSessionToken } from "@rosegriffon/auth/achillea-session";

type Row = Record<string, unknown>;
type Answer = { rows?: Row[]; numAffectedRows?: bigint } | undefined;
const journal: { sql: string; parameters: readonly unknown[] }[] = [];
let answer: (sql: string, parameters: readonly unknown[]) => Answer = () => undefined;

const connection: DatabaseConnection = {
  async executeQuery<R>(query: CompiledQuery): Promise<QueryResult<R>> {
    journal.push({ sql: query.sql, parameters: query.parameters });
    const result = answer(query.sql, query.parameters);
    return { rows: (result?.rows ?? []) as R[], ...(result?.numAffectedRows === undefined ? {} : { numAffectedRows: result.numAffectedRows }) };
  },
  streamQuery() {
    throw new Error("unused");
  },
};
const driver: Driver = {
  init: async () => {},
  acquireConnection: async () => connection,
  beginTransaction: async () => {},
  commitTransaction: async () => {},
  rollbackTransaction: async () => {},
  releaseConnection: async () => {},
  destroy: async () => {},
};
const fakeDb = new Kysely<Database>({
  dialect: {
    createAdapter: () => new PostgresAdapter(),
    createDriver: () => driver,
    createIntrospector: kysely => new PostgresIntrospector(kysely),
    createQueryCompiler: () => new PostgresQueryCompiler(),
  },
});
mock.module("../../plugins/db", () => {
  const { Elysia } = require("elysia") as typeof import("elysia");
  return { db: fakeDb, inagleDb: fakeDb, dbPlugin: new Elysia({ name: "db" }).decorate("db", fakeDb) };
});

const JWT_SECRET = process.env.JWT_SECRET_KEY!;
const ADMIN_TOKEN = randomBytes(24).toString("hex");
const RG_SECRET = randomBytes(32).toString("base64url");
const DISCORD_ID = "223344556677889900";
const RG_USER_ID = "4b0e7a52-6a35-4d0c-9b0f-0c4f6f2a9d11";
const ENV = { API_ADMIN_TOKEN: ADMIN_TOKEN, TWITCH_CLIENT_ID: "test-twitch-client", TWITCH_SECRET: randomBytes(12).toString("hex") };
const previous: Record<string, string | undefined> = {};
const realFetch = globalThis.fetch;
const providerCalls: { url: string; body?: string }[] = [];

let app: { handle: (request: Request) => Promise<Response> };

beforeAll(async () => {
  for (const [key, value] of Object.entries(ENV)) {
    previous[key] = process.env[key];
    process.env[key] = value;
  }
  for (const key of ["PUBLIC_API_URL", "WEBSITE_URL"]) {
    previous[key] = process.env[key];
    delete process.env[key];
  }
  const { Elysia } = await import("elysia");
  const { authController } = await import("./index");
  app = new Elysia().group("/v1", v1 => v1.use(authController));
});

afterAll(() => {
  globalThis.fetch = realFetch;
  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

beforeEach(() => {
  journal.length = 0;
  providerCalls.length = 0;
  answer = sql => {
    if (sql.includes('from public.account a') && sql.includes("provider_id = 'discord'") && sql.includes("join public.\"user\" u"))
      return { rows: [{ discord_id: DISCORD_ID, username: "Mark", avatar_url: null }] };
    if (sql.startsWith('select "id", "username", "avatar", "display_name"'))
      return { rows: [{ id: DISCORD_ID, username: "Mark", avatar: null, display_name: "Mark", role: 0, blacklist_id: null }] };
    if (sql.startsWith('select "id" from "user"')) return { rows: [{ id: DISCORD_ID }] };
    return undefined;
  };
});

const request = (path: string, init: { method?: string; headers?: Record<string, string>; body?: unknown } = {}) =>
  app.handle(
    new Request(`http://api.test/v1/auth${path}`, {
      method: init.method ?? (init.body === undefined ? "GET" : "POST"),
      headers: { ...(init.body === undefined ? {} : { "content-type": "application/json" }), ...init.headers },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    }),
  );

/** A Better Auth session cookie as rosegriffon.fr issues it: `<token>.<HMAC-SHA256 base64>`. */
function rgSessionCookie(secret = RG_SECRET) {
  const token = randomBytes(24).toString("base64url");
  const signature = createHmac("sha256", secret).update(token).digest("base64");
  return { token, value: encodeURIComponent(`${token}.${signature}`) };
}

async function exchange(body: Record<string, unknown> = { betterAuthUserId: RG_USER_ID }, bearer = ADMIN_TOKEN) {
  return request("/session/exchange", { body, headers: { authorization: `Bearer ${bearer}` } });
}

describe("Achilléa session issuance (RG -> Achilléa bridge)", () => {
  test("the exchange is internal only", async () => {
    expect((await request("/session/exchange", { body: { betterAuthUserId: RG_USER_ID } })).status).toBe(401);
    expect((await exchange(undefined, "not-the-internal-token")).status).toBe(401);
    // An RG session token is not the internal credential.
    expect((await exchange(undefined, rgSessionCookie().value)).status).toBe(401);
    expect(journal).toEqual([]);
  });

  test("a linked Discord account yields a purpose-bound session JWT keyed by the Discord id", async () => {
    const response = await exchange();
    expect(response.status).toBe(200);
    const payload = (await response.json()) as { token: string; expiresIn: number; user: { id: string } };
    expect(payload.user.id).toBe(DISCORD_ID);
    expect(payload.expiresIn).toBe(30 * 24 * 60 * 60);
    expect(await verifyAchilleaSessionToken(payload.token, JWT_SECRET)).toMatchObject({ id: DISCORD_ID, username: "Mark" });
    const claims = JSON.parse(Buffer.from(payload.token.split(".")[1]!, "base64url").toString());
    expect(claims).toMatchObject({ iss: "achillea", aud: ACHILLEA_SESSION_AUDIENCE, tokenUse: "session", sub: DISCORD_ID });
    // The RG user id is a lookup key, never the Achilléa identity.
    expect(JSON.stringify(claims)).not.toContain(RG_USER_ID);
    const lookup = journal.find(entry => entry.sql.includes("from public.account a"))!;
    expect(lookup.parameters).toEqual([RG_USER_ID]);
    expect(journal.some(entry => entry.sql.startsWith('insert into "user"') && entry.parameters.includes(DISCORD_ID))).toBe(true);
  });

  test("an RG account without Discord gets no Achilléa session (409, no user written)", async () => {
    answer = () => undefined;
    const response = await exchange();
    expect(response.status).toBe(409);
    expect(journal.some(entry => entry.sql.startsWith('insert into "user"'))).toBe(false);
  });

  test("no signing secret, no session", async () => {
    const secret = process.env.JWT_SECRET_KEY;
    delete process.env.JWT_SECRET_KEY;
    try {
      expect((await exchange()).status).toBe(503);
    } finally {
      process.env.JWT_SECRET_KEY = secret;
    }
  });
});

describe("Achilléa protected route (/v1/auth/me)", () => {
  const session = () => signAchilleaSessionToken({ id: DISCORD_ID, username: "Mark" }, JWT_SECRET);

  test("accepts the session JWT as bearer or as the `token` cookie", async () => {
    expect((await request("/me", { headers: { authorization: `Bearer ${session()}` } })).status).toBe(200);
    const response = await request("/me", { headers: { cookie: `theme=dark; token=${session()}` } });
    expect(response.status).toBe(200);
    expect(((await response.json()) as { user: { id: string } }).user.id).toBe(DISCORD_ID);
  });

  test("refuses everything else", async () => {
    const now = Math.floor(Date.now() / 1000);
    const refused = {
      anonymous: {},
      expired: { authorization: `Bearer ${signAchilleaSessionToken({ id: DISCORD_ID }, JWT_SECRET, now - 31 * 24 * 3600)}` },
      "wrong secret": { authorization: `Bearer ${signAchilleaSessionToken({ id: DISCORD_ID }, randomBytes(16).toString("hex"))}` },
      "realtime token": { authorization: `Bearer ${signAchilleaRealtimeToken({ id: DISCORD_ID }, JWT_SECRET)}` },
      tampered: { authorization: `Bearer ${session().replace(/\.[^.]+\./, `.${Buffer.from(JSON.stringify({ id: "1", sub: "1", tokenUse: "session", iss: "achillea", aud: "achillea-web", exp: now + 60 })).toString("base64url")}.`)}` },
      "alg none": { authorization: `Bearer ${Buffer.from('{"alg":"none"}').toString("base64url")}.${Buffer.from(JSON.stringify({ id: DISCORD_ID, sub: DISCORD_ID, tokenUse: "session", iss: "achillea", aud: "achillea-web", exp: now + 60 })).toString("base64url")}.` },
    } as Record<string, Record<string, string>>;
    for (const [label, headers] of Object.entries(refused)) {
      const response = await request("/me", { headers });
      expect({ label, status: response.status }).toEqual({ label, status: 401 });
    }
  });

  test("the session is refused once the player row is gone", async () => {
    answer = () => undefined;
    expect((await request("/me", { headers: { authorization: `Bearer ${session()}` } })).status).toBe(401);
  });
});

describe("Achilléa realtime token and logout", () => {
  test("realtime token is minted from a session, short lived, and is not a session", async () => {
    const session = signAchilleaSessionToken({ id: DISCORD_ID }, JWT_SECRET);
    expect((await request("/realtime-token")).status).toBe(401);
    const response = await request("/realtime-token", { headers: { cookie: `token=${session}` } });
    expect(response.status).toBe(200);
    const { token, expiresIn } = (await response.json()) as { token: string; expiresIn: number };
    expect(expiresIn).toBe(300);
    const claims = await verifyAchilleaRealtimeToken(token, JWT_SECRET);
    expect(claims?.id).toBe(DISCORD_ID);
    expect(claims!.expiresAt - Math.floor(Date.now() / 1000)).toBeLessThanOrEqual(300);
    expect(JSON.parse(Buffer.from(token.split(".")[1]!, "base64url").toString()).aud).toBe(ACHILLEA_REALTIME_AUDIENCE);
    expect(await verifyAchilleaSessionToken(token, JWT_SECRET)).toBeNull();
    // A realtime token cannot mint another realtime token either.
    expect((await request("/realtime-token", { headers: { authorization: `Bearer ${token}` } })).status).toBe(401);
  });

  test("logout erases the `token` cookie with the bridge's domain and path", async () => {
    const local = await request("/logout", { method: "POST" });
    expect(local.status).toBe(200);
    expect(local.headers.get("set-cookie")).toBe("token=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax");
    const production = await request("/logout", { method: "POST", headers: { origin: "https://ranked.rosegriffon.fr" } });
    expect(production.headers.get("set-cookie")).toContain("Domain=.rosegriffon.fr");
    expect(production.headers.get("set-cookie")).toContain("Secure");
    expect(production.headers.get("cache-control")).toBe("no-store");
  });
});

describe("Achilléa provider OAuth (Twitch / Challonge linking)", () => {
  const session = () => signAchilleaSessionToken({ id: DISCORD_ID }, JWT_SECRET);
  async function start(provider = "twitch") {
    const response = await request(`/oauth/${provider}/start`, { headers: { authorization: `Bearer ${session()}` } });
    return { response, url: response.ok ? new URL(((await response.json()) as { url: string }).url) : null };
  }

  test("start requires an Achilléa session (an RG session cookie is not one)", async () => {
    expect((await request("/oauth/twitch/start")).status).toBe(401);
    const rg = rgSessionCookie();
    expect((await request("/oauth/twitch/start", { headers: { cookie: `better-auth.session_token=${rg.value}` } })).status).toBe(401);
    expect((await request("/oauth/twitch/start", { headers: { cookie: `__Secure-better-auth.session_token=${rg.value}` } })).status).toBe(401);
    expect((await request("/oauth/github/start", { headers: { authorization: `Bearer ${session()}` } })).status).toBe(400);
  });

  test("start stores a one-time CSRF token and builds the Twitch URL on api.rosegriffon.fr", async () => {
    const { response, url } = await start();
    expect(response.status).toBe(200);
    expect(`${url!.origin}${url!.pathname}`).toBe("https://id.twitch.tv/oauth2/authorize");
    expect(url!.searchParams.get("client_id")).toBe("test-twitch-client");
    expect(url!.searchParams.get("redirect_uri")).toBe("https://api.rosegriffon.fr/v1/auth/oauth/callback?provider=twitch");
    expect(url!.searchParams.get("response_type")).toBe("code");
    const state = url!.searchParams.get("state")!;
    expect(state).toMatch(new RegExp(`^${DISCORD_ID}:[a-f0-9]{48}$`));
    const insert = journal.find(entry => entry.sql.startsWith('insert into "oauth_csrf"'))!;
    expect(insert.parameters).toEqual([state.split(":")[1], DISCORD_ID]);
    // Every start mints a fresh state.
    expect((await start()).url!.searchParams.get("state")).not.toBe(state);
  });

  test("callback refuses a malformed, unknown or expired state before calling the provider", async () => {
    globalThis.fetch = (async (input: Request | string | URL) => {
      providerCalls.push({ url: String(input) });
      return new Response("unexpected", { status: 500 });
    }) as typeof fetch;
    expect((await request("/oauth/callback?provider=twitch&code=c")).status).toBe(400);
    expect((await request(`/oauth/callback?provider=twitch&code=c&state=${DISCORD_ID}:nothex`)).status).toBe(400);
    // Well formed but not in oauth_csrf (deleted 0 rows): forged or replayed.
    answer = sql => (sql.startsWith('delete from "oauth_csrf"') ? { numAffectedRows: 0n } : undefined);
    expect((await request(`/oauth/callback?provider=twitch&code=c&state=${DISCORD_ID}:${"a".repeat(48)}`)).status).toBe(400);
    const consume = journal.find(entry => entry.sql.startsWith('delete from "oauth_csrf"'))!;
    expect(consume.sql).toContain('"created_at" >=');
    expect(providerCalls).toEqual([]);
  });

  test("callback consumes the state, exchanges the code with the same redirect_uri and links the connection", async () => {
    const csrf = "b".repeat(48);
    answer = sql => {
      if (sql.startsWith('delete from "oauth_csrf"')) return { numAffectedRows: 1n };
      if (sql.startsWith('select "id" from "user"')) return { rows: [{ id: DISCORD_ID }] };
      return undefined;
    };
    globalThis.fetch = (async (input: Request | string | URL, init?: RequestInit) => {
      const url = String(input);
      providerCalls.push({ url, body: init?.body ? String(init.body) : undefined });
      if (url === "https://id.twitch.tv/oauth2/token") return Response.json({ access_token: "twitch-access-fixture", refresh_token: "twitch-refresh-fixture" });
      if (url === "https://api.twitch.tv/helix/users") return Response.json({ data: [{ id: "tw-1", login: "streamer_fixture" }] });
      throw new Error(`unexpected network call ${url}`);
    }) as typeof fetch;
    const response = await request(`/oauth/callback?provider=twitch&code=twitch-code&state=${DISCORD_ID}:${csrf}`);
    // Regression: the 302 carries its Location (it used to be dropped).
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(`https://rosegriffon.fr/users/${DISCORD_ID}`);
    const form = new URLSearchParams(providerCalls[0]!.body);
    expect(form.get("grant_type")).toBe("authorization_code");
    expect(form.get("code")).toBe("twitch-code");
    expect(form.get("redirect_uri")).toBe("https://api.rosegriffon.fr/v1/auth/oauth/callback?provider=twitch");
    const consume = journal.find(entry => entry.sql.startsWith('delete from "oauth_csrf"'))!;
    expect(consume.parameters.slice(0, 2)).toEqual([DISCORD_ID, csrf]);
    const link = journal.find(entry => entry.sql.startsWith('insert into "user_connection"'))!;
    expect(link.parameters.slice(0, 4)).toEqual([DISCORD_ID, "twitch", "tw-1", "streamer_fixture"]);
  });
});

describe("Achilléa versus Rose Griffon credentials", () => {
  test("an RG Better Auth session cookie or bearer never authenticates an Achilléa route", async () => {
    const rg = rgSessionCookie();
    const attempts: Record<string, string>[] = [
      { cookie: `better-auth.session_token=${rg.value}` },
      { cookie: `__Secure-better-auth.session_token=${rg.value}` },
      { authorization: `Bearer ${rg.token}` },
      { authorization: `Bearer ${decodeURIComponent(rg.value)}` },
      // Even under the Achilléa cookie name, an RG session value is not a JWT.
      { cookie: `token=${rg.value}` },
    ];
    for (const headers of attempts) {
      expect((await request("/me", { headers })).status).toBe(401);
      expect((await request("/realtime-token", { headers })).status).toBe(401);
    }
  });

  test("an Achilléa-shaped JWT signed with the RG secret is refused: the secrets are distinct", async () => {
    expect(RG_SECRET).not.toBe(JWT_SECRET);
    const forged = signAchilleaSessionToken({ id: DISCORD_ID }, RG_SECRET);
    expect((await request("/me", { headers: { authorization: `Bearer ${forged}` } })).status).toBe(401);
  });
});
