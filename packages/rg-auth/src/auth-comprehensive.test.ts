// SPDX-License-Identifier: Apache-2.0
import { describe, expect, test } from "bun:test";
import {
  verifyAchilleaRealtimeToken,
  verifyAchilleaSessionToken,
} from "@rosegriffon/achillea-core/auth";
import {
  achilleaSessionCookieAttributes,
  signAchilleaRealtimeToken,
  signAchilleaSessionToken,
} from "./achillea-session";
import { isAdmin, isStaff } from "./index";
import { safeReturnUrl } from "./redirect";

const SECRET = "rg-master-testing-secret-2026-super-secure";
const WRONG_SECRET = "rg-attacker-fake-secret-9999-unauthorized";

describe("Achillea Purpose-Bound Tokens - Cryptographic Integrity & Anti-Tampering", () => {
  test("jeton de session valide se vérifie avec succès et restitue l'identité", async () => {
    const now = 1770000000;
    const token = signAchilleaSessionToken(
      { id: "discord_user_123", username: "EndouMamoru", avatar: "avatar_hash_456" },
      SECRET,
      now,
      3600,
    );

    const verified = await verifyAchilleaSessionToken(token, SECRET, now + 10);
    expect(verified).not.toBeNull();
    expect(verified?.id).toBe("discord_user_123");
    expect(verified?.username).toBe("EndouMamoru");
    expect(verified?.avatar).toBe("avatar_hash_456");
    expect(verified?.expiresAt).toBe(now + 3600);
  });

  test("rejette un jeton altéré ou falsifié (signature invalide)", async () => {
    const now = 1770000000;
    const token = signAchilleaSessionToken({ id: "legit_user" }, SECRET, now);
    const [h, p, s] = token.split(".");

    // Alter signature
    const badSigToken = `${h}.${p}.${(s ?? "").slice(0, -2)}xx`;
    expect(await verifyAchilleaSessionToken(badSigToken, SECRET, now)).toBeNull();

    // Verify with incorrect secret
    expect(await verifyAchilleaSessionToken(token, WRONG_SECRET, now)).toBeNull();
  });

  test("rejette un jeton expiré (validation du temps exp)", async () => {
    const now = 1770000000;
    const ttl = 300; // 5 minutes
    const token = signAchilleaSessionToken({ id: "user_time" }, SECRET, now, ttl);

    // Right before expiry
    expect(await verifyAchilleaSessionToken(token, SECRET, now + 299)).not.toBeNull();
    // Exactly at or after expiry
    expect(await verifyAchilleaSessionToken(token, SECRET, now + 300)).toBeNull();
    expect(await verifyAchilleaSessionToken(token, SECRET, now + 5000)).toBeNull();
  });

  test("étanchéité stricte des usages (Confusion d'audience session vs realtime)", async () => {
    const now = 1770000000;
    const realtimeToken = signAchilleaRealtimeToken({ id: "player_colyseus" }, SECRET, now);
    const sessionToken = signAchilleaSessionToken({ id: "player_web" }, SECRET, now);

    // A realtime token MUST NOT be accepted as a web session token
    const asSession = await verifyAchilleaSessionToken(realtimeToken, SECRET, now);
    expect(asSession).toBeNull();

    // A session token MUST NOT be accepted as a realtime token
    const asRealtime = await verifyAchilleaRealtimeToken(sessionToken, SECRET, now);
    expect(asRealtime).toBeNull();
  });

  test("neutralise les attaques par substitution d'algorithme (alg: none ou HS512)", async () => {
    const now = 1770000000;
    const payload = Buffer.from(
      JSON.stringify({
        id: "evil_admin",
        sub: "evil_admin",
        tokenUse: "session",
        iss: "achillea",
        aud: "achillea-web",
        iat: now,
        exp: now + 3600,
      }),
    ).toString("base64url");

    // Attack 1: alg: none
    const headerNone = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
    const tokenNone = `${headerNone}.${payload}.`;
    expect(await verifyAchilleaSessionToken(tokenNone, SECRET, now)).toBeNull();

    // Attack 2: alg: HS512
    const header512 = Buffer.from(JSON.stringify({ alg: "HS512", typ: "JWT" })).toString("base64url");
    const token512 = `${header512}.${payload}.fakesignature`;
    expect(await verifyAchilleaSessionToken(token512, SECRET, now)).toBeNull();
  });

  test("exige la concordance stricte entre id et sub", async () => {
    const now = 1770000000;
    const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
    const payload = Buffer.from(
      JSON.stringify({
        id: "victim_user",
        sub: "attacker_user", // Mismatch
        tokenUse: "session",
        iss: "achillea",
        aud: "achillea-web",
        iat: now,
        exp: now + 3600,
      }),
    ).toString("base64url");
    const token = `${header}.${payload}.fakesig`;
    expect(await verifyAchilleaSessionToken(token, SECRET, now)).toBeNull();
  });
});

describe("RG RBAC - Hiérarchie des Rôles et Permissions Unifiées", () => {
  test("isAdmin reconnaît exactement les rôles d'administration et d'édition", () => {
    expect(isAdmin("admin")).toBe(true);
    expect(isAdmin("superadmin")).toBe(true);
    expect(isAdmin("editor")).toBe(true);
    expect(isAdmin("moderator")).toBe(true);

    expect(isAdmin("user")).toBe(false);
    expect(isAdmin("member")).toBe(false);
    expect(isAdmin("guest")).toBe(false);
    expect(isAdmin(null)).toBe(false);
    expect(isAdmin(undefined)).toBe(false);
  });

  test("isStaff reconnaît les rôles opérationnels du staff", () => {
    expect(isStaff("admin")).toBe(true);
    expect(isStaff("staff")).toBe(true);
    expect(isStaff("superadmin")).toBe(false); // superadmin is explicitly handled via isAdmin
    expect(isStaff("user")).toBe(false);
    expect(isStaff(null)).toBe(false);
    expect(isStaff(undefined)).toBe(false);
  });
});

describe("Sécurité des Redirections (safeReturnUrl)", () => {
  test("autorise les chemins relatifs internes légitimes", () => {
    expect(safeReturnUrl("/")).toBe("/");
    expect(safeReturnUrl("/achillea/tournois")).toBe("/achillea/tournois");
    expect(safeReturnUrl("/wiki/characters?search=Gouenji#stats")).toBe("/wiki/characters?search=Gouenji#stats");
  });

  test("rejette les redirections ouvertes externes (Open Redirect Protection)", () => {
    expect(safeReturnUrl("https://evil.com")).toBe("/achillea");
    expect(safeReturnUrl("http://evil.com/phishing")).toBe("/achillea");
    expect(safeReturnUrl("//evil.com")).toBe("/achillea");
    expect(safeReturnUrl("///evil.com")).toBe("/achillea");
    expect(safeReturnUrl("/\\evil.com")).toBe("/achillea");
    expect(safeReturnUrl("\\evil.com")).toBe("/achillea");
  });

  test("rejette les protocoles dangereux (javascript:, data:, vbscript:)", () => {
    expect(safeReturnUrl("javascript:alert(1)")).toBe("/achillea");
    expect(safeReturnUrl("data:text/html,<script>alert(1)</script>")).toBe("/achillea");
  });

  test("rejette les caractères de contrôle et tentatives de saut de ligne (CRLF)", () => {
    expect(safeReturnUrl("/test\r\nSet-Cookie: evil=1")).toBe("/achillea");
    expect(safeReturnUrl("/test\0injected")).toBe("/achillea");
  });

  test("respecte le fallback personnalisé", () => {
    expect(safeReturnUrl("https://evil.com", "/fallback-destination")).toBe("/fallback-destination");
  });
});

describe("Attributs de Cookies de Session Achillea", () => {
  test("mode production impose SameSite=Lax, HttpOnly=true, Secure=true et domaine partagé", () => {
    const attrsProd = achilleaSessionCookieAttributes(true);
    expect(attrsProd.httpOnly).toBe(true);
    expect(attrsProd.secure).toBe(true);
    expect(attrsProd.sameSite).toBe("lax");
    expect(attrsProd.domain).toBe(".rosegriffon.fr");
    expect(attrsProd.path).toBe("/");
  });

  test("mode développement omet le domaine et secure pour autoriser localhost", () => {
    const attrsDev = achilleaSessionCookieAttributes(false);
    expect(attrsDev.httpOnly).toBe(true);
    expect(attrsDev.secure).toBe(false);
    expect(attrsDev.domain).toBeUndefined();
    expect(attrsDev.path).toBe("/");
  });
});
