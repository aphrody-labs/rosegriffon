/**
 * The ONLY link between the two auth systems: `POST /api/achillea/session`.
 *
 * Rose Griffon (Better Auth, cookie `better-auth.session_token`, secret
 * BETTER_AUTH_SECRET) and Achilléa (HS256 JWT in cookie `token`, secret
 * JWT_SECRET_KEY held by the unified API) are separate systems. This route
 * turns an RG session into an Achilléa one by calling the API's internal
 * exchange with `API_ADMIN_TOKEN` and the RG user id; the API resolves the
 * linked Discord account. No RG session -> 401 and no call; RG account
 * without Discord -> 409 and the Achilléa cookie is erased. The website never
 * signs the Achilléa token itself.
 *
 * `next/headers` and the RG session reader are replaced; the API is an
 * intercepted `fetch`; secrets are generated here.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, mock, test } from "bun:test";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";

type CookieWrite = { name: string; value: string; options: Record<string, unknown> };
const writes: CookieWrite[] = [];
let rgSession: { user: { id: string } } | null = null;

mock.module("next/headers", () => ({
  cookies: async () => ({
    set: (name: string, value: string, options: Record<string, unknown>) => void writes.push({ name, value, options }),
  }),
  headers: async () => new Headers(),
}));
mock.module("@/lib/auth-helpers", () => ({ getServerSession: async () => rgSession }));

const ADMIN_TOKEN = randomBytes(24).toString("hex");
const previous: Record<string, string | undefined> = {};
const realFetch = globalThis.fetch;
const apiCalls: { url: string; init?: RequestInit }[] = [];
let apiResponse: () => Response = () => new Response(null, { status: 500 });
let route: typeof import("./route");

beforeAll(async () => {
  for (const key of ["API_ADMIN_TOKEN", "ACHILLEA_API_URL", "NEXT_PUBLIC_ACHILLEA_API_URL"]) previous[key] = process.env[key];
  process.env.API_ADMIN_TOKEN = ADMIN_TOKEN;
  process.env.ACHILLEA_API_URL = "https://api.test";
  delete process.env.NEXT_PUBLIC_ACHILLEA_API_URL;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    apiCalls.push({ url: String(input), init });
    return apiResponse();
  }) as typeof fetch;
  route = await import("./route");
});

afterAll(() => {
  globalThis.fetch = realFetch;
  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

beforeEach(() => {
  writes.length = 0;
  apiCalls.length = 0;
  rgSession = null;
});

describe("RG -> Achilléa bridge", () => {
  test("no RG session: 401, the API is never called, no Achilléa cookie", async () => {
    const response = await route.POST();
    expect(response.status).toBe(401);
    expect(apiCalls).toEqual([]);
    expect(writes).toEqual([]);
  });

  test("an RG session is exchanged by the API (internal bearer) and stored as the `token` cookie", async () => {
    rgSession = { user: { id: "rg-user-1" } };
    apiResponse = () => Response.json({ token: "achillea.jwt.fixture", expiresIn: 2_592_000, user: { id: "223344556677889900" } });
    const response = await route.POST();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ id: "223344556677889900" });
    expect(apiCalls).toHaveLength(1);
    expect(apiCalls[0]!.url).toBe("https://api.test/v1/auth/session/exchange");
    expect(new Headers(apiCalls[0]!.init?.headers).get("authorization")).toBe(`Bearer ${ADMIN_TOKEN}`);
    expect(JSON.parse(String(apiCalls[0]!.init?.body))).toEqual({ betterAuthUserId: "rg-user-1" });
    expect(writes).toEqual([
      {
        name: "token",
        value: "achillea.jwt.fixture",
        options: { domain: undefined, httpOnly: true, path: "/", sameSite: "lax", secure: false, maxAge: 2_592_000 },
      },
    ]);
  });

  test("an RG account without Discord: 409 and any stale Achilléa cookie is erased", async () => {
    rgSession = { user: { id: "rg-email-only" } };
    apiResponse = () => Response.json({ message: "Discord account is not linked" }, { status: 409 });
    const response = await route.POST();
    expect(response.status).toBe(409);
    expect(writes).toEqual([{ name: "token", value: "", options: expect.objectContaining({ maxAge: 0, path: "/" }) }]);
  });

  test("an API failure opens no Achilléa session", async () => {
    rgSession = { user: { id: "rg-user-1" } };
    apiResponse = () => new Response(null, { status: 500 });
    expect((await route.POST()).status).toBe(503);
    expect(writes).toEqual([]);
  });

  test("the bridge refuses to run without its internal credential", async () => {
    delete process.env.API_ADMIN_TOKEN;
    try {
      rgSession = { user: { id: "rg-user-1" } };
      expect((await route.POST()).status).toBe(503);
      expect(apiCalls).toEqual([]);
    } finally {
      process.env.API_ADMIN_TOKEN = ADMIN_TOKEN;
    }
  });

  test("DELETE erases only the Achilléa cookie", async () => {
    const response = await route.DELETE();
    expect(response.status).toBe(200);
    expect(writes.map(write => [write.name, write.value, write.options.maxAge])).toEqual([["token", "", 0]]);
  });
});

test("regression: the Patreon admin page advertises the callback Better Auth 1.7 really uses", () => {
  const page = readFileSync(new URL("../../../admin/patreon/page.tsx", import.meta.url), "utf8");
  expect(page).toContain('absoluteUrl("/api/auth/callback/patreon")');
  expect(page).not.toContain("/api/auth/oauth2/callback/patreon");
});
