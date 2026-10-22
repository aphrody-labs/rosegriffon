import { afterEach, describe, expect, it, spyOn } from "bun:test";
import { CastAvailabilityStatus, CastSlotRole, SanctionType } from "@rosegriffon/achillea-core/enums";
import { signHmacSha256 } from "@rosegriffon/achillea-core/licenses";
import { fakeDb, sessionToken } from "./achillea-fixtures";

// Ces requêtes s'arrêtent à l'authentification, à la validation ou à une base
// factice : aucune connexion PostgreSQL n'est ouverte.
process.env.DATABASE_URL ??= "postgres://localhost/rg_route_test";
const { app } = await import("../src/api/server");
const { requireRole } = await import("../src/api/modules/achillea/guards");
const { buildChecklist, planAutoAssign } = await import("../src/api/modules/achillea/casts/service");
const { dispatchReminders, attributionMessage } = await import("../src/api/modules/achillea/casts/notifications");
const { castDb } = await import("../src/api/modules/achillea/casts/service");
const { renderPlayerCard } = await import("../src/api/modules/achillea/images/player-card");
const { renderClanPoster, clanColors } = await import("../src/api/modules/achillea/images/clan-poster");
const { rankFromElo, sanitizeName, PNG_SIGNATURE } = await import("../src/api/modules/achillea/images/render");
const { renderLicensePdf } = await import("../src/api/modules/achillea/licenses/pdf");
const { LicenseService } = await import("../src/api/modules/achillea/licenses/service");
const { relayToUsers, setRealtimeDelivery, rankedProofMessage } = await import(
  "../src/api/modules/achillea/notifications/internal"
);
const { verifyCrossSyncSignature, validateCrossSync, applyCrossSync, CrossSyncError } = await import(
  "../src/api/modules/achillea/moderation-sync"
);
const { PublicImageStorage, sniffImageMime } = await import("../src/api/modules/achillea/storage");
const { resyncAvatars } = await import("../src/api/modules/achillea/users/avatar-resync");

const BASE = "http://localhost/v1/achillea";
const EVENT_ID = "11111111-1111-4111-8111-111111111111";
const LICENSE_ID = "22222222-2222-4222-8222-222222222222";
const ATTRIBUTION_ID = "33333333-3333-4333-8333-333333333333";

function request(path: string, init: RequestInit & { json?: unknown } = {}) {
  const headers = new Headers(init.headers);
  let body = init.body;
  if (init.json !== undefined) {
    headers.set("content-type", "application/json");
    body = JSON.stringify(init.json);
  }
  return app.handle(new Request(`${BASE}${path}`, { ...init, headers, body }));
}

const PNG_1PX = Uint8Array.from(
  atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="),
  c => c.charCodeAt(0),
);

afterEach(() => {
  delete process.env.RANKED_INTERNAL_SECRET;
  delete process.env.ACHILLEA_CROSS_SYNC_RECEIVE_SECRET;
  delete process.env.ACHILLEA_DISCORD_BOT_TOKEN;
  delete process.env.ACHILLEA_STAFF_CHANNEL_ID;
  setRealtimeDelivery(null);
});

describe("authentification des routes portées", () => {
  const validCreate = {
    name: "Finale",
    kind: "tournament",
    scheduledAt: "2026-11-01T18:00:00.000Z",
    slots: [{ role: "caster_main" }],
  };
  const cases: Array<[string, string, unknown?]> = [
    ["GET", "/casts/events"],
    ["GET", `/casts/events/${EVENT_ID}`],
    ["POST", "/casts/events", validCreate],
    ["POST", `/casts/events/${EVENT_ID}/survey`, { casterPool: ["123456789012345678"] }],
    ["POST", `/casts/events/${EVENT_ID}/availability`, { status: "available" }],
    ["POST", `/casts/events/${EVENT_ID}/auto-assign`, {}],
    ["PATCH", `/casts/attributions/${ATTRIBUTION_ID}`, { newCasterId: "123456789012345678" }],
    ["POST", `/casts/attributions/${ATTRIBUTION_ID}/confirm`],
    ["POST", "/casts/reminders/dispatch"],
    ["POST", "/licenses/issue/123456789012345678"],
    ["POST", `/licenses/${LICENSE_ID}/revoke`],
    ["POST", "/users/123456789012345678/card/regenerate"],
    ["POST", "/clans/1/poster/regenerate"],
    ["POST", "/users/resync-avatars"],
    ["GET", "/proxy/delete/0123456789abcdef01234567.png"],
  ];
  for (const [method, path, json] of cases) {
    it(`${method} ${path} → 401 sans session`, async () => {
      const response = await request(path, { method, json });
      expect(response.status).toBe(401);
    });
  }

  it("POST /proxy/upload → 401 sans session", async () => {
    const form = new FormData();
    form.append("file", new Blob([PNG_1PX], { type: "image/png" }), "a.png");
    const response = await app.handle(new Request(`${BASE}/proxy/upload`, { method: "POST", body: form }));
    expect(response.status).toBe(401);
  });
});

describe("validation", () => {
  it("refuse un type d'évènement inconnu", async () => {
    const response = await request("/casts/events", {
      method: "POST",
      json: { name: "x", kind: "concert", scheduledAt: "2026-11-01", slots: [{ role: "caster_main" }] },
    });
    expect(response.status).toBe(422);
  });

  it("refuse un évènement sans poste", async () => {
    const response = await request("/casts/events", {
      method: "POST",
      json: { name: "x", kind: "match", scheduledAt: "2026-11-01", slots: [] },
    });
    expect(response.status).toBe(422);
  });

  it("PDF de licence : identifiant invalide ou sans extension → 404", async () => {
    expect((await request("/licenses/pas-un-uuid.pdf")).status).toBe(404);
    expect((await request(`/licenses/${LICENSE_ID}`)).status).toBe(404);
  });

  it("carte joueur : identifiant non Discord → 404", async () => {
    expect((await request("/users/abc/card.png")).status).toBe(404);
  });

  it("upload : fichier manquant ou non image → 400", async () => {
    const authorization = `Bearer ${await sessionToken("123456789012345678")}`;
    const empty = new FormData();
    empty.append("other", "x");
    const missing = await app.handle(
      new Request(`${BASE}/proxy/upload`, { method: "POST", body: empty, headers: { authorization } }),
    );
    expect(missing.status).toBe(400);
    const text = new FormData();
    text.append("file", new Blob(["<svg onload=alert(1)>"], { type: "image/png" }), "x.png");
    const rejected = await app.handle(
      new Request(`${BASE}/proxy/upload`, { method: "POST", body: text, headers: { authorization } }),
    );
    expect(rejected.status).toBe(400);
  });

  it("suppression : identifiant d'image dangereux → 400", async () => {
    const authorization = `Bearer ${await sessionToken("123456789012345678")}`;
    const response = await request("/proxy/delete/..%2F..%2Fsecret", { headers: { authorization } });
    expect(response.status).toBe(400);
  });
});

describe("rôles", () => {
  const headers = async (id: string) => ({ authorization: `Bearer ${await sessionToken(id)}` });

  it("requireRole : 403 sous le rôle requis, accès au-dessus", async () => {
    const player = fakeDb(() => [{ role: 0 }]);
    const denied = await requireRole(player.db, await headers("1000000000000001"), 2);
    expect(denied.error).not.toBeNull();
    const admin = fakeDb(() => [{ role: 2 }]);
    const granted = await requireRole(admin.db, await headers("1000000000000002"), 2);
    expect(granted.error).toBeNull();
    expect(granted.session?.id).toBe("1000000000000002");
  });

  it("requireRole : 401 sans session, sans requête en base", async () => {
    const { db, queries } = fakeDb();
    const result = await requireRole(db, {}, 1);
    expect(result.error).not.toBeNull();
    expect(queries).toHaveLength(0);
  });
});

describe("routes internes", () => {
  it("refusent tout appel tant que RANKED_INTERNAL_SECRET n'est pas posé", async () => {
    for (const path of ["/notifications/emit-match-found", "/notifications/emit-to-users"]) {
      const response = await request(path, {
        method: "POST",
        json: { userIds: ["123456789012345678"], event: "rematch_offer", payload: {} },
      });
      expect(response.status).toBe(403);
    }
  });

  it("refusent un mauvais secret", async () => {
    process.env.RANKED_INTERNAL_SECRET = "s".repeat(32);
    const response = await request("/notifications/ranked-proof", {
      method: "POST",
      headers: { "x-internal-secret": "mauvais" },
      json: { lobbyId: 3, userId: "123456789012345678", url: "https://x.supabase.co/p.png" },
    });
    expect(response.status).toBe(403);
  });

  it("ranked-proof publie l'embed dans le salon des TO via l'application Achilléa", async () => {
    process.env.RANKED_INTERNAL_SECRET = "s".repeat(32);
    process.env.ACHILLEA_DISCORD_BOT_TOKEN = "jeton-test";
    const calls: Array<{ url: string; body: any }> = [];
    const spy = spyOn(globalThis, "fetch").mockImplementation((async (url: string, init?: RequestInit) => {
      calls.push({ url: String(url), body: JSON.parse(String(init?.body)) });
      return Response.json({ id: "999" });
    }) as typeof fetch);
    try {
      const response = await request("/notifications/ranked-proof", {
        method: "POST",
        headers: { "x-internal-secret": "s".repeat(32) },
        json: { lobbyId: 3, userId: "123456789012345678", url: "https://x.supabase.co/p.png" },
      });
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ success: true });
      expect(calls[0]?.url).toBe("https://discord.com/api/v10/channels/1436378680153608203/messages");
      expect(calls[0]?.body.embeds[0].color).toBe(0x6d00ce);
      expect(calls[0]?.body.embeds[0].image.url).toBe("https://x.supabase.co/p.png");
    } finally {
      spy.mockRestore();
    }
  });

  it("ranked-proof : échec Discord → 502", async () => {
    process.env.RANKED_INTERNAL_SECRET = "s".repeat(32);
    process.env.ACHILLEA_DISCORD_BOT_TOKEN = "jeton-test";
    const spy = spyOn(globalThis, "fetch").mockImplementation((async () =>
      new Response("Missing Access", { status: 403 })) as unknown as typeof fetch);
    try {
      const response = await request("/notifications/ranked-proof", {
        method: "POST",
        headers: { "x-internal-secret": "s".repeat(32) },
        json: { lobbyId: 3, userId: "123456789012345678", url: "relative/path.png" },
      });
      expect(response.status).toBe(502);
    } finally {
      spy.mockRestore();
    }
  });

  it("une preuve non absolue devient un champ, sans image", () => {
    const message = rankedProofMessage(1, "123456789012345678", "local/proof.png");
    expect(message.embeds?.[0]?.image).toBeUndefined();
    expect(message.components).toBeUndefined();
  });

  it("relayToUsers : livraison temps réel puis boîte de réception (lue si livrée)", async () => {
    setRealtimeDelivery(async ids => new Set(ids.filter(id => id === "100000000000000001")));
    const { db, queries } = fakeDb(({ sql }) => {
      if (sql.startsWith('select "id" from "user"')) return [{ id: "100000000000000001" }, { id: "100000000000000002" }];
      if (sql.startsWith('insert into "notification"')) return [{ id: 42 }];
      return [];
    });
    const result = await relayToUsers(db, ["100000000000000001", "100000000000000002"], "match_found", { lobbyId: 1 });
    expect(result).toEqual({ delivered: 1, stored: 2 });
    const links = queries.find(q => q.sql.startsWith('insert into "user_notification"'));
    expect(links?.parameters).toContain(true);
    expect(links?.parameters).toContain(false);
  });
});

describe("moderation/sync", () => {
  const body = JSON.stringify({
    version: "1.0",
    source_guild_id: "200000000000000001",
    source_bot_id: "300000000000000001",
    action: "create",
    sanction: { id: "remote-1", userId: "100000000000000001", type: "ban", issuedBy: "400000000000000001" },
  });

  it("403 sans en-têtes de signature", async () => {
    const response = await request("/moderation/sync", { method: "POST", json: JSON.parse(body) });
    expect(response.status).toBe(403);
  });

  it("403 avec une signature invalide", async () => {
    process.env.ACHILLEA_CROSS_SYNC_RECEIVE_SECRET = "secret-de-test";
    const response = await app.handle(
      new Request(`${BASE}/moderation/sync`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-achillea-signature": "00".repeat(32),
          "x-achillea-timestamp": String(Date.now()),
        },
        body,
      }),
    );
    expect(response.status).toBe(403);
  });

  it("signature : corps brut, forme re-sérialisée, dérive de 5 min", async () => {
    const ts = String(Date.now());
    const signature = await signHmacSha256(`${ts}.${body}`, "k");
    expect(await verifyCrossSyncSignature(ts, body, signature, "k")).toBe(true);
    const spaced = JSON.stringify(JSON.parse(body), null, 2);
    expect(await verifyCrossSyncSignature(ts, spaced, signature, "k")).toBe(true);
    expect(await verifyCrossSyncSignature(ts, body, signature, "autre")).toBe(false);
    const old = String(Date.now() - 6 * 60 * 1000);
    expect(await verifyCrossSyncSignature(old, body, await signHmacSha256(`${old}.${body}`, "k"), "k")).toBe(false);
  });

  it("validation du message", () => {
    expect(() => validateCrossSync({ version: "2.0" })).toThrow(CrossSyncError);
    expect(() => validateCrossSync({ ...JSON.parse(body), action: "delete" })).toThrow(/Unknown action/);
    expect(() =>
      validateCrossSync({ ...JSON.parse(body), sanction: { userId: "1", type: "slap", issuedBy: "2" } }),
    ).toThrow(/Unknown sanction type/);
    expect(validateCrossSync(JSON.parse(body)).type).toBe(SanctionType.Ban);
  });

  it("création : sanction système, anti-boucle et audit dans la transaction", async () => {
    const { db, queries } = fakeDb(({ sql }) => {
      if (sql.startsWith('insert into "sanction"')) return [{ id: "sanction-1" }];
      if (sql.includes("INSERT INTO achillea.audit_log"))
        return [{ id: "a", ts: new Date(), signature: "s", action: "sanction.sync.create" }];
      return [];
    });
    const id = await applyCrossSync(db, validateCrossSync(JSON.parse(body)));
    expect(id).toBe("sanction-1");
    const insert = queries.find(q => q.sql.startsWith('insert into "sanction"'));
    expect(insert?.parameters).toContain("system");
    expect(JSON.stringify(insert?.parameters)).toContain('"from":"300000000000000001"');
    expect(queries.some(q => q.sql.includes("INSERT INTO achillea.audit_log"))).toBe(true);
  });

  it("révocation sans miroir : consigne une levée (unban)", async () => {
    const { db, queries } = fakeDb(({ sql }) => {
      if (sql.startsWith('insert into "sanction"')) return [{ id: "sanction-2" }];
      if (sql.includes("INSERT INTO achillea.audit_log")) return [{ id: "a", ts: new Date(), signature: "s" }];
      return [];
    });
    await applyCrossSync(db, validateCrossSync({ ...JSON.parse(body), action: "revoke" }));
    const insert = queries.find(q => q.sql.startsWith('insert into "sanction"'));
    expect(insert?.parameters).toContain(SanctionType.Unban);
  });
});

describe("cellule cast", () => {
  it("auto-attribution : préférence, plafond anti-saturation, un poste par caster", () => {
    const plan = planAutoAssign(
      [
        { id: "s1", role: CastSlotRole.CasterMain },
        { id: "s2", role: CastSlotRole.Producer },
      ],
      [
        { userId: "a", status: CastAvailabilityStatus.Available, preferredRoles: [CastSlotRole.Producer] },
        { userId: "b", status: CastAvailabilityStatus.Maybe, preferredRoles: [CastSlotRole.CasterMain] },
        { userId: "c", status: CastAvailabilityStatus.Available, preferredRoles: [CastSlotRole.CasterMain] },
      ],
      new Map([["c", 3]]),
      new Map(),
      3,
    );
    expect(plan).toEqual([
      { slotId: "s1", userId: "b" },
      { slotId: "s2", userId: "a" },
    ]);
  });

  it("checklist : confirmation et postes libres", () => {
    const slot = (id: string) => ({
      id,
      role: CastSlotRole.CasterMain,
      required: true,
      defraymentAmount: null,
      defraymentCurrency: null,
      defraymentReason: null,
      notes: null,
    });
    const checklist = buildChecklist(
      [slot("s1"), slot("s2")],
      [{ id: "a1", slotId: "s1", userId: "u", assignedAt: "x", assignedBy: "system", confirmedAt: "y" }],
    );
    expect(checklist.map(item => [item.casterId, item.confirmed])).toEqual([
      ["u", true],
      [null, false],
    ]);
  });

  it("message d'attribution aux couleurs Achilléa", () => {
    const message = attributionMessage(
      { id: EVENT_ID, name: "Finale", kind: "tournament" as never, scheduledAt: "2026-11-01T18:00:00.000Z" },
      CastSlotRole.Producer,
    );
    expect(message.embeds?.[0]?.color).toBe(0x6d00ce);
    expect(JSON.stringify(message)).toContain("Réalisation");
  });

  it("rappels J-2 : MP, MP fermés comptés traités, drapeau posé, récap staff", async () => {
    process.env.ACHILLEA_DISCORD_BOT_TOKEN = "jeton-test";
    process.env.ACHILLEA_STAFF_CHANNEL_ID = "500000000000000001";
    const scheduled = new Date(Date.now() + 48 * 60 * 60 * 1000);
    const { db, queries } = fakeDb(({ sql }) =>
      sql.startsWith("select")
        ? [
            { attribution_id: "a1", user_id: "100000000000000001", role: "caster_main", event_id: EVENT_ID, name: "Finale", kind: "tournament", scheduled_at: scheduled, twitch_url: null },
            { attribution_id: "a2", user_id: "100000000000000002", role: "producer", event_id: EVENT_ID, name: "Finale", kind: "tournament", scheduled_at: scheduled, twitch_url: null },
          ]
        : [],
    );
    const urls: string[] = [];
    const spy = spyOn(globalThis, "fetch").mockImplementation((async (url: string, init?: RequestInit) => {
      urls.push(String(url));
      if (String(url).endsWith("/users/@me/channels")) {
        const recipient = JSON.parse(String(init?.body)).recipient_id;
        if (recipient === "100000000000000002") return new Response("Cannot send messages", { status: 403 });
        return Response.json({ id: "dm-1" });
      }
      return Response.json({ id: "msg" });
    }) as typeof fetch);
    try {
      const report = await dispatchReminders(castDb(db), "j2");
      expect(report).toEqual({ kind: "j2", events: 1, sent: 1, failed: 0 });
      const update = queries.find(q => q.sql.startsWith('update "cast_attribution"'));
      expect(update?.sql).toContain('"notified_j2"');
      expect(update?.parameters).toEqual(expect.arrayContaining(["a1", "a2"]));
      expect(urls).toContain("https://discord.com/api/v10/channels/500000000000000001/messages");
    } finally {
      spy.mockRestore();
    }
  });
});

describe("licences", () => {
  it("émission : numéro ACH-année-séquence, secret QR, URL de PDF et audit", async () => {
    const issuedAt = new Date("2026-10-22T10:00:00.000Z");
    const { db, queries } = fakeDb(({ sql, parameters }) => {
      if (sql.startsWith('select "id" from "user"')) return [{ id: "100000000000000001" }];
      if (sql.startsWith("select count(*)")) return [{ count: "41" }];
      if (sql.startsWith('insert into "license"')) return [{ id: LICENSE_ID }];
      if (sql.startsWith('update "license"'))
        return [
          {
            id: LICENSE_ID,
            user_id: "100000000000000001",
            license_number: "ACH-2026-00042",
            issued_at: issuedAt,
            valid_until: new Date(issuedAt.getTime() + 365 * 86_400_000),
            status: "Active",
            pdf_url: parameters[0],
            qr_secret: "f".repeat(64),
            created_at: issuedAt,
            updated_at: issuedAt,
          },
        ];
      if (sql.includes("INSERT INTO achillea.audit_log")) return [{ id: "a", ts: issuedAt, signature: "s" }];
      return [];
    });
    const license = await LicenseService.issue(db, "100000000000000001", "100000000000000009", issuedAt);
    const insert = queries.find(q => q.sql.startsWith('insert into "license"'));
    expect(insert?.parameters).toContain("ACH-2026-00042");
    expect(insert?.parameters.some(p => typeof p === "string" && /^[0-9a-f]{64}$/.test(p))).toBe(true);
    expect(queries.some(q => q.sql.includes("pg_advisory_xact_lock"))).toBe(true);
    expect(license.pdfUrl).toBe(`https://ranked.rosegriffon.fr/api/licenses/${LICENSE_ID}.pdf`);
    const audit = queries.find(q => q.sql.includes("INSERT INTO achillea.audit_log"));
    expect(audit?.parameters).toContain("license.issue");
  });

  it("PDF : document Skia à deux pages, signature %PDF", async () => {
    const pdf = await renderLicensePdf({
      licenseNumber: "ACH-2026-00001",
      qrSecret: "a".repeat(64),
      issuedAt: new Date("2026-01-01"),
      validUntil: new Date("2027-01-01"),
      status: "Active",
      holder: { displayName: "Ayane", avatar: null },
    });
    expect(new TextDecoder().decode(pdf.subarray(0, 5))).toBe("%PDF-");
    expect((new TextDecoder("latin1").decode(pdf).match(/\/Type\s*\/Page\b/g) ?? []).length).toBe(2);
  });
});

describe("images générées", () => {
  const isPng = (bytes: Uint8Array) => PNG_SIGNATURE.every((byte, i) => bytes[i] === byte);

  it("carte joueur : PNG 1080×1350", async () => {
    const png = await renderPlayerCard(
      {
        userId: "100000000000000001",
        displayName: "Ayane",
        handle: "ayane",
        avatarUrl: null,
        elo: 1250,
        rankIndex: rankFromElo(1250),
        wins: 12,
        losses: 4,
        winrate: 75,
        season: "Saison 2026-10",
      },
      null,
    );
    expect(isPng(png)).toBe(true);
    const view = new DataView(png.buffer, png.byteOffset);
    expect([view.getUint32(16), view.getUint32(20)]).toEqual([1080, 1350]);
  });

  it("affiche de clan : PNG 1080×1920, même sans membre", async () => {
    const png = await renderClanPoster(
      {
        clan: { id: 7, name: "Les Griffons", shortenedName: "RG", avatarUrl: null, seed: "rg" },
        members: [],
        averageElo: 0,
        membersCount: 0,
      },
      { logo: null, avatars: [] },
    );
    expect(isPng(png)).toBe(true);
    expect(new DataView(png.buffer, png.byteOffset).getUint32(20)).toBe(1920);
  });

  it("rangs, couleurs et noms assainis", () => {
    expect(rankFromElo(0)).toBe(1);
    expect(rankFromElo(1250)).toBe(8);
    expect(rankFromElo(9999)).toBe(11);
    expect(clanColors("rg")).toEqual(clanColors("rg"));
    expect(sanitizeName("𝒜𝓎𝒶𝓃ℯ 🌸")).toBe("Ayane");
  });
});

describe("stockage et avatars", () => {
  it("type d'image par octets magiques", () => {
    expect(sniffImageMime(PNG_1PX)).toBe("image/png");
    expect(sniffImageMime(new TextEncoder().encode("<svg/>"))).toBeNull();
  });

  it("dépôt nommé par hash, dossier contrôlé", async () => {
    const uploads: string[] = [];
    const storage = new PublicImageStorage("images", {
      storage: {
        from: () => ({
          upload: async (path: string) => {
            uploads.push(path);
            return { error: null };
          },
          remove: async () => ({ error: null }),
          getPublicUrl: (path: string) => ({ data: { publicUrl: `https://cdn.test/${path}` } }),
        }),
      },
    });
    const stored = await storage.uploadImage(PNG_1PX, "proxy");
    expect(stored.id).toMatch(/^[a-f0-9]{24}\.png$/);
    expect(uploads).toEqual([`proxy/${stored.id}`]);
    await expect(storage.uploadImage(PNG_1PX, "../etc")).rejects.toThrow();
    await expect(storage.deleteImage("../x.png", "proxy")).rejects.toThrow();
  });

  it("resync : met à jour avatar et noms depuis Discord, normalise les inconnus", async () => {
    const { db, queries } = fakeDb(({ sql }) =>
      sql.startsWith("select")
        ? [
            { id: "100000000000000001", avatar: null, username: "old", display_name: "Old", normalized_display_name: "old" },
            { id: "100000000000000002", avatar: "abc", username: "gone", display_name: "Gone", normalized_display_name: "gone" },
          ]
        : [],
    );
    const spy = spyOn(globalThis, "fetch").mockImplementation((async (url: string) => {
      if (String(url).endsWith("/100000000000000001"))
        return Response.json({ id: "100000000000000001", username: "ayane", global_name: "Ayane", avatar: "a_hash" });
      return new Response("", { status: 404 });
    }) as typeof fetch);
    try {
      const result = await resyncAvatars(db, "jeton", { pauseMs: 0 });
      expect(result).toEqual({ scanned: 2, updated: 2, failed: 0 });
      const updates = queries.filter(q => q.sql.startsWith('update "user"'));
      expect(JSON.stringify(updates[0]?.parameters)).toContain("a_hash.gif");
      expect(updates[0]?.parameters).toContain("Ayane");
    } finally {
      spy.mockRestore();
    }
  });
});
