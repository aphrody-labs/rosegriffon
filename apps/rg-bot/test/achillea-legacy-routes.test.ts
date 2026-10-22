import "./setup";
import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { signAchilleaSessionToken } from "@rosegriffon/auth/achillea-session";
import { ClanMemberDistinction, ClanMemberRole } from "@rosegriffon/achillea-core/enums";
import {
  canManageMember,
  canonicalSocial,
  isClanMemberRole,
  memberLimitExceeded,
  normalizeClanMemberLimits,
  parseDistinctions,
  roleChangeError,
} from "../src/api/modules/achillea/clans/management";
import * as discord from "../src/api/modules/achillea/clans/discord";
import { achilleaSessionClearCookie } from "../src/api/modules/auth/logout";
import { likePattern, normalizeQuery, similarity } from "../src/api/modules/achillea/misc/service";

// Ces requêtes s'arrêtent à l'authentification ou à la validation : aucune connexion SQL.
const { app } = await import("../src/api/server");

const token = signAchilleaSessionToken(
  { id: "100000000000000001", username: "contract-test", avatar: null },
  process.env.JWT_SECRET_KEY!,
);

function post(path: string, body: unknown, headers: Record<string, string> = {}) {
  return app.handle(
    new Request(`http://localhost/v1${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
    }),
  );
}

const invite = { id: 7, user: { id: "2", username: "x" }, inviter: { clanRole: 2, user: { id: "1", username: "y" } } };

const VALID_BODIES: Array<[string, unknown]> = [
  [
    "/achillea/clans/create",
    {
      founders: [{ id: "2" }, { id: "3" }, { id: "4" }, { id: "5" }],
      logo: "https://rosegriffon.fr/achillea/achillea.png",
      name: "Raimon",
      normalizedName: "raimon",
      shortName: "RMN",
      normalizedShortName: "RMN",
      description: "Clan de test",
      twitter: "https://x.com/raimon",
      origin: { code: "fr", language: "Français", name: "France", flag: "flags/flag_fr.svg" },
      languages: [{ code: "fr", language: "Français", name: "France", flag: "flags/flag_fr.svg" }],
    },
  ],
  ["/achillea/clans/applications/create", { clanId: 1, distinctions: [ClanMemberDistinction.Player] }],
  ["/achillea/clans/applications/accept", { id: 3, user: { id: "2" }, distinctions: [] }],
  ["/achillea/clans/applications/reject", { id: 3, user: { id: "2" }, distinctions: [] }],
  ["/achillea/clans/invites/create", { userId: "2", distinctions: [ClanMemberDistinction.Player] }],
  ["/achillea/clans/invites/notify", invite],
  ["/achillea/clans/invites/revoke", invite],
  ["/achillea/clans/kick/2", { reason: "Inactivité prolongée" }],
  [
    "/achillea/clans/updateMember",
    { clanRole: ClanMemberRole.Member, distinctions: [ClanMemberDistinction.Player], user: { id: "2", username: "x" } },
  ],
];

describe("mutations de clan — authentification et validation", () => {
  it("rejette chaque mutation sans session Achilléa (401)", async () => {
    for (const [path, body] of VALID_BODIES) {
      const response = await post(path, body);
      expect({ path, status: response.status }).toEqual({ path, status: 401 });
      const payload = (await response.json()) as { success: boolean; error: string };
      expect(payload.success).toBe(false);
    }
  });

  it("valide la forme des corps avant toute écriture", async () => {
    const auth = { authorization: `Bearer ${token}` };
    const cases: Array<[string, unknown]> = [
      ["/achillea/clans/invites/create", { distinctions: [] }],
      ["/achillea/clans/applications/create", { clanId: "abc", distinctions: [] }],
      ["/achillea/clans/applications/accept", {}],
      ["/achillea/clans/updateMember", { clanRole: 1, distinctions: [] }],
      ["/achillea/clans/create", { name: "Sans fondateurs" }],
    ];
    for (const [path, body] of cases) {
      const response = await post(path, body, auth);
      expect({ path, status: response.status }).toEqual({ path, status: 422 });
    }
  });

  it("refuse distinctions et rôles inconnus (400), ce que le legacy laissait passer", async () => {
    const auth = { authorization: `Bearer ${token}` };
    const distinction = await post("/achillea/clans/invites/create", { userId: "2", distinctions: ["Gardien"] }, auth);
    expect(distinction.status).toBe(400);
    const role = await post(
      "/achillea/clans/updateMember",
      { clanRole: 9, distinctions: [], user: { id: "2" } },
      auth,
    );
    expect(role.status).toBe(400);
    expect(((await role.json()) as { error: string }).error).toBe("Rôle invalide.");
    const badDistinction = await post(
      "/achillea/clans/updateMember",
      { clanRole: 1, distinctions: ["Gardien"], user: { id: "2" } },
      auth,
    );
    expect(((await badDistinction.json()) as { error: string }).error).toBe("Distinction invalide.");
  });
});

describe("mutations de clan — base de test", () => {
  it.skipIf(!process.env.RG_TEST_DATABASE_URL)("refuse invitations et candidatures à un membre sous vice-président", async () => {
    const { db } = await import("../src/api/plugins/db");
    const member = await db
      .selectFrom("clan_member")
      .select("user_id")
      .where("role", "<", ClanMemberRole.SubCaptain)
      .limit(1)
      .executeTakeFirst();
    expect(member).toBeDefined();
    if (!member) return;
    const auth = {
      authorization: `Bearer ${signAchilleaSessionToken({ id: member.user_id, username: "t", avatar: null }, process.env.JWT_SECRET_KEY!)}`,
    };
    const inviteResponse = await post("/achillea/clans/invites/create", { userId: "2", distinctions: [] }, auth);
    expect(inviteResponse.status).toBe(403);
    const acceptResponse = await post("/achillea/clans/applications/accept", { id: 1 }, auth);
    expect(acceptResponse.status).toBe(403);
  });
});

describe("règles de clan", () => {
  it("hiérarchie : vice-président minimum, rôle strictement supérieur, président souverain", () => {
    expect(canManageMember(ClanMemberRole.Member, ClanMemberRole.Trial)).toBe(false);
    expect(canManageMember(ClanMemberRole.SubCaptain, ClanMemberRole.Member)).toBe(true);
    expect(canManageMember(ClanMemberRole.SubCaptain, ClanMemberRole.SubCaptain)).toBe(false);
    expect(canManageMember(ClanMemberRole.SubCaptain, ClanMemberRole.Captain)).toBe(false);
    expect(canManageMember(ClanMemberRole.Captain, ClanMemberRole.SubCaptain)).toBe(true);
  });

  it("changement de rôle : ni auto-promotion, ni présidence, ni rôle ≥ au sien", () => {
    const captain = { userId: "1", role: ClanMemberRole.Captain };
    const vice = { userId: "2", role: ClanMemberRole.SubCaptain };
    const member = { userId: "3", role: ClanMemberRole.Member };
    expect(roleChangeError(captain, member, ClanMemberRole.SubCaptain)).toBeNull();
    expect(roleChangeError(captain, member, ClanMemberRole.Member)).toBeNull();
    expect(roleChangeError(captain, captain, ClanMemberRole.Member)?.status).toBe(400);
    expect(roleChangeError(captain, member, ClanMemberRole.Captain)?.status).toBe(400);
    expect(roleChangeError(vice, member, ClanMemberRole.SubCaptain)?.status).toBe(403);
    expect(roleChangeError(vice, member, ClanMemberRole.Trial)).toBeNull();
  });

  it("distinctions : valeurs d'enum et clés anglaises historiques, dédoublonnées", () => {
    expect(parseDistinctions(["Joueur", "Player", "Content Creator"])).toEqual([
      ClanMemberDistinction.Player,
      ClanMemberDistinction.ContentCreator,
    ]);
    expect(parseDistinctions(["Gardien"])).toBeNull();
    expect(isClanMemberRole(3)).toBe(true);
    expect(isClanMemberRole(4)).toBe(false);
    expect(isClanMemberRole(1.5)).toBe(false);
  });

  it("limites de membres : défauts et bornes du legacy, seuls Joueur et Staff comptent", () => {
    expect(normalizeClanMemberLimits({})).toEqual({ playerLimit: 30, staffLimit: 7 });
    expect(normalizeClanMemberLimits({ playerLimit: 500, staffLimit: 0 })).toEqual({ playerLimit: 100, staffLimit: 1 });
    const limits = { playerLimit: 2, staffLimit: 1 };
    expect(memberLimitExceeded({ players: 2, staff: 0 }, limits, [ClanMemberDistinction.Player])).toBe("player");
    expect(memberLimitExceeded({ players: 0, staff: 1 }, limits, [ClanMemberDistinction.Staff])).toBe("staff");
    expect(memberLimitExceeded({ players: 9, staff: 9 }, limits, [ClanMemberDistinction.Artist])).toBeNull();
  });

  it("réseaux sociaux : URL canonique X/Instagram/TikTok uniquement", () => {
    expect(canonicalSocial("https://twitter.com/raimon")).toEqual({ platform: "xUrl", url: "https://x.com/raimon" });
    expect(canonicalSocial("https://www.tiktok.com/@raimon")).toEqual({
      platform: "tiktokUrl",
      url: "https://tiktok.com/@raimon",
    });
    expect(canonicalSocial("https://youtube.com/raimon")).toBeNull();
    expect(canonicalSocial("pas une url")).toBeNull();
  });
});

describe("effets Discord des clans", () => {
  let fetchSpy: ReturnType<typeof spyOn<typeof globalThis, "fetch">>;
  const previousToken = Bun.env.ACHILLEA_DISCORD_BOT_TOKEN;

  beforeEach(() => {
    Bun.env.ACHILLEA_DISCORD_BOT_TOKEN = "synthetic-achillea-token";
    fetchSpy = spyOn(globalThis, "fetch");
  });
  afterEach(() => {
    fetchSpy.mockRestore();
    if (previousToken === undefined) delete Bun.env.ACHILLEA_DISCORD_BOT_TOKEN;
    else Bun.env.ACHILLEA_DISCORD_BOT_TOKEN = previousToken;
  });

  it("envoie le MP d'invitation avec le texte et les boutons du legacy", async () => {
    const calls: Array<{ url: string; body: unknown }> = [];
    fetchSpy.mockImplementation((async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, body: init?.body ? JSON.parse(String(init.body)) : undefined });
      return Response.json(url.endsWith("/users/@me/channels") ? { id: "900" } : { id: "901" });
    }) as typeof fetch);

    const message = discord.messageInvitation("Raimon", "222", "111", [ClanMemberDistinction.Player], 42);
    const result = await discord.mp("222", message, "MP d'invitation");

    expect(result).toEqual({ ok: true, id: "901" });
    expect(calls[0]).toEqual({ url: "https://discord.com/api/v10/users/@me/channels", body: { recipient_id: "222" } });
    expect(calls[1]?.url).toBe("https://discord.com/api/v10/channels/900/messages");
    const sent = calls[1]?.body as { content: string; components: Array<{ components: Array<{ custom_id: string }> }> };
    expect(sent.content).toBe(
      "<@222>, vous avez été invité à rejoindre le Clan Raimon par <@111> en qualité de **Joueur**",
    );
    expect(sent.components[0]?.components.map(button => button.custom_id)).toEqual([
      "confirm_invite:42",
      "cancel_invite:42",
    ]);
  });

  it("un refus Discord est consigné, jamais levé", async () => {
    fetchSpy.mockImplementation((async () => new Response("Cannot send messages to this user", { status: 403 })) as unknown as typeof fetch);
    const warn = spyOn(console, "warn").mockImplementation(() => {});
    const result = await discord.mp("222", { content: "x" }, "MP test");
    expect(result.ok).toBe(false);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("provisionne rôle et salon du clan avec les permissions du legacy", async () => {
    const calls: Array<{ method: string; url: string; body: any }> = [];
    fetchSpy.mockImplementation((async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      calls.push({ method: init?.method ?? "GET", url, body: init?.body ? JSON.parse(String(init.body)) : undefined });
      if (url.endsWith("/roles")) return Response.json({ id: "role-1" });
      if (url.endsWith("/users/@me")) return Response.json({ id: "bot-1" });
      if (url.endsWith("/channels")) return Response.json({ id: "chan-1" });
      if (url.startsWith("https://rosegriffon.fr")) return new Response("introuvable", { status: 404 });
      return new Response(null, { status: 204 });
    }) as typeof fetch);
    const warn = spyOn(console, "warn").mockImplementation(() => {});

    const result = await discord.provisionnerClan({
      name: "Raimon",
      shortName: "RMN",
      presidentId: "1",
      founderIds: ["1", "2", "3", "4", "5"],
      logo: "https://rosegriffon.fr/achillea/achillea.png",
    });
    warn.mockRestore();

    expect(result).toEqual({ ok: true, data: { roleId: "role-1", channelId: "chan-1", emojiId: "" } });
    const channel = calls.find(call => call.url.endsWith("/channels"))!;
    expect(channel.body.parent_id).toBe(discord.configAchillea().clanCategoryId);
    expect(channel.body.permission_overwrites[1]).toEqual({ id: "role-1", type: 0, allow: String((1n << 10n) | (1n << 16n)) });
    const roleGrants = calls.filter(call => call.method === "PUT" && call.url.includes("/roles/role-1"));
    expect(roleGrants).toHaveLength(5);
  });

  it("sans jeton Achilléa, aucun appel réseau et un échec explicite", async () => {
    delete Bun.env.ACHILLEA_DISCORD_BOT_TOKEN;
    const result = await discord.restAchillea("GET", "/users/@me");
    expect(result).toEqual({ ok: false, statut: null, motif: "ACHILLEA_DISCORD_BOT_TOKEN absent" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("suggestions", () => {
  it("rend une liste vide pour une saisie vide, sans base", async () => {
    for (const kind of ["all", "clans", "users"]) {
      const response = await app.handle(new Request(`http://localhost/v1/achillea/misc/suggest/${kind}?query=%20`));
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual([]);
    }
  });

  it("score et motif ILIKE", () => {
    expect(similarity("rai", "Raimon")).toBeGreaterThan(similarity("mon", "Raimon"));
    expect(similarity("raimon", "Raimon")).toBe(1);
    expect(similarity("zeus", "Raimon")).toBe(0);
    expect(likePattern("50%_a")).toBe("%50\\%\\_a%");
    expect(normalizeQuery("  Rai ")).toBe("rai");
    expect(normalizeQuery(undefined)).toBeNull();
  });
});

describe("ligues", () => {
  it("résout un identifiant ou un alias, casse ignorée", async () => {
    const response = await app.handle(new Request("http://localhost/v1/achillea/leagues/ASTRAL-S1"));
    expect(response.status).toBe(200);
    const payload = (await response.json()) as { meta: { id: string } };
    expect(payload.meta.id).toBe("astral-s1");
  });

  it("répond 404 pour une ligue inconnue", async () => {
    const response = await app.handle(new Request("http://localhost/v1/achillea/leagues/inconnue"));
    expect(response.status).toBe(404);
  });
});

describe("POST /v1/auth/logout", () => {
  it("efface le cookie de session avec les attributs qui le posent", async () => {
    const response = await app.handle(
      new Request("http://localhost/v1/auth/logout", { method: "POST", headers: { origin: "https://rosegriffon.fr" } }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(response.headers.get("cache-control")).toBe("no-store");
    const cookie = response.headers.get("set-cookie") ?? "";
    expect(cookie.startsWith("token=;")).toBe(true);
    for (const attribute of ["Domain=.rosegriffon.fr", "Path=/", "Max-Age=0", "HttpOnly", "Secure", "SameSite=Lax"])
      expect(cookie).toContain(attribute);
  });

  it("hors production : cookie d'hôte, sans Secure", () => {
    const cookie = achilleaSessionClearCookie(new Request("http://localhost:3000/v1/auth/logout"), "development");
    expect(cookie).toBe("token=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax");
  });
});
