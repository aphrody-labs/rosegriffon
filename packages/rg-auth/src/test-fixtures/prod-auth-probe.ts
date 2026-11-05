/**
 * Production-mode probe for rg-auth-flows.test.ts.
 *
 * `commonAuthOptions` reads NODE_ENV and the Google credentials when the module
 * loads, so the production cookie policy can only be observed in a fresh
 * process. The parent test passes generated secrets and an unreachable
 * DATABASE_URL; the Better Auth store is in memory. Prints one JSON line.
 */
import { memoryAdapter } from "better-auth/adapters/memory";
import { createRoseGriffonAuth, type RoseGriffonAuthOptions } from "../factory";

const ORIGIN = "https://rosegriffon.fr";
const tables: Record<string, unknown[]> = {};
for (const model of ["user", "session", "account", "verification", "jwks", "two_factor", "passkey"]) tables[model] = [];

let lastMail = "";
const auth = createRoseGriffonAuth({
  database: memoryAdapter(tables) as unknown as RoseGriffonAuthOptions["database"],
  baseURL: ORIGIN,
  sendEmail: async ({ html }) => {
    lastMail = html;
  },
});

let requests = 0;
const call = (path: string, body?: unknown, extra: { origin?: string; cookie?: string } = {}) =>
  auth.handler(
    new Request(`${ORIGIN}/api/auth${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        origin: extra.origin ?? ORIGIN,
        "x-forwarded-for": `203.0.113.${(requests += 1)}`,
        ...(extra.cookie ? { cookie: extra.cookie } : {}),
        ...(body === undefined ? {} : { "content-type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  );

const email = "probe@example.test";
const password = "probe password long enough";
await call("/sign-up/email", { email, password, name: "Probe" });
const link = new URL((/href="([^"]+)"/.exec(lastMail)?.[1] ?? "").replaceAll("&amp;", "&"));
await call(`/verify-email${link.search}`);
const signIn = await call("/sign-in/email", { email, password });
const sessionCookie = signIn.headers.getSetCookie().find(value => value.includes("session_token=")) ?? "";
const google = (await (await call("/sign-in/social", { provider: "google", callbackURL: "/" })).json()) as { url: string };
const cookie = sessionCookie.split(";")[0] ?? "";
const read = async () => ((await (await call("/get-session", undefined, { cookie })).json()) as { user?: unknown } | null)?.user !== undefined;
// CSRF: a cookie-carrying POST from an untrusted origin must be refused.
const forgedSignOut = (await call("/sign-out", {}, { cookie, origin: "https://evil.example" })).status;
const sessionAfterForgery = await read();
const openRedirect = (await call("/sign-in/social", { provider: "google", callbackURL: "https://evil.example/steal" })).status;
const signOut = await call("/sign-out", {}, { cookie, origin: "https://achillea.rosegriffon.fr" });
const achilleaOriginSignOut = signOut.status;
const achilleaCookieOnSignOut = signOut.headers.getSetCookie().find(value => value.startsWith("token=")) ?? "";
const sessionAfterSignOut = await read();

process.stdout.write(
  `${JSON.stringify({
    sessionCookie,
    trustedOrigins: auth.options.trustedOrigins,
    google: google.url,
    forgedSignOut,
    sessionAfterForgery,
    openRedirect,
    achilleaOriginSignOut,
    achilleaCookieOnSignOut,
    sessionAfterSignOut,
  })}\n`,
);
process.exit(0);
