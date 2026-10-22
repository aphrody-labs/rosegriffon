import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";

import { PLANIFICATIONS } from "@rosegriffon/types/cron";
import {
  configClans,
  decider,
  DELAI_GRACE_MS,
  effetsDiscord,
  embedDissolution,
  MESSAGE_DISSOLUTION,
  signatureAudit,
  type ClanDissous,
} from "./achillea-clans";

const maintenant = new Date("2026-10-22T12:00:00Z");

describe("achillea:clans — décision", () => {
  test("planifiée toutes les 15 minutes", () => {
    expect(PLANIFICATIONS["achillea:clans"]).toBe("*/15 * * * *");
  });

  test("dissout seulement après 24 h sous la limite", () => {
    const il_y_a = (ms: number) => new Date(maintenant.getTime() - ms);
    expect(decider({ membres: 4, depuis: il_y_a(DELAI_GRACE_MS) }, maintenant)).toBe("dissoudre");
    expect(decider({ membres: 4, depuis: il_y_a(DELAI_GRACE_MS - 1) }, maintenant)).toBe("attendre");
    expect(decider({ membres: 0, depuis: il_y_a(3 * DELAI_GRACE_MS) }, maintenant)).toBe("dissoudre");
  });

  test("un clan revenu à 5 membres est rétabli, même après l'échéance", () => {
    expect(decider({ membres: 5, depuis: new Date(0) }, maintenant)).toBe("retablir");
  });

  test("un drapeau sans horodatage attend (le premier passage le pose)", () => {
    expect(decider({ membres: 2, depuis: null }, maintenant)).toBe("attendre");
  });
});

describe("achillea:clans — journal d'audit", () => {
  test("signature chaînée au format de l'API (sha256 hex)", () => {
    const entree = {
      actor_id: null,
      action: "clan.disband",
      target_type: "Clan",
      target_id: "12",
      payload: { motif: "sous-effectif" },
      ts: maintenant,
    };
    const premiere = signatureAudit(null, entree);
    expect(premiere).toMatch(/^[0-9a-f]{64}$/);
    expect(signatureAudit(premiere, entree)).not.toBe(premiere);
    expect(signatureAudit(null, entree)).toBe(premiere);
  });
});

describe("achillea:clans — effets Discord", () => {
  let fetchSpy: ReturnType<typeof spyOn<typeof globalThis, "fetch">>;
  const appels: Array<{ method: string; url: string; body: any }> = [];

  beforeEach(() => {
    appels.length = 0;
    fetchSpy = spyOn(globalThis, "fetch").mockImplementation((async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      appels.push({ method: init?.method ?? "GET", url, body: init?.body ? JSON.parse(String(init.body)) : undefined });
      if (url.endsWith("/users/@me/channels")) return Response.json({ id: "555555555555555555" });
      return new Response(null, { status: 204 });
    }) as typeof fetch);
  });
  afterEach(() => fetchSpy.mockRestore());

  const clan: ClanDissous = {
    id: 12,
    name: "Raimon",
    founders: ["111111111111111111"],
    clan_avatar_url: "https://cdn.rosegriffon.fr/raimon.png",
    clan_fame: 40,
    created_at: new Date("2026-01-01T00:00:00Z"),
    channel_id: "222222222222222222",
    role_id: "333333333333333333",
    broadcast_channel: "444444444444444444",
    capitaine: "111111111111111111",
    membres: ["111111111111111111", "666666666666666666"],
    fils: ["777777777777777777"],
  };

  test("supprime salon, rôle, fils, retire le rôle Président, annonce et écrit aux membres", async () => {
    await effetsDiscord("jeton-synthetique", clan, maintenant);
    const { guildId, captainRoleId, clanAnnouncementsChannelId } = configClans();
    const resume = appels.map(a => `${a.method} ${a.url.replace("https://discord.com/api/v10", "")}`);
    expect(resume).toContain("DELETE /channels/222222222222222222");
    expect(resume).toContain(`DELETE /guilds/${guildId}/roles/333333333333333333`);
    expect(resume).toContain(`DELETE /guilds/${guildId}/members/111111111111111111/roles/${captainRoleId}`);
    expect(resume).toContain("DELETE /channels/777777777777777777");
    expect(resume).toContain("POST /channels/444444444444444444/messages");
    expect(resume).toContain(`POST /channels/${clanAnnouncementsChannelId}/messages`);
    const mps = appels.filter(a => a.url.endsWith("/users/@me/channels"));
    expect(mps.map(a => a.body.recipient_id)).toEqual(clan.membres);
    const mp = appels.find(a => a.url.endsWith("/channels/555555555555555555/messages"));
    expect(mp?.body.embeds[0].description).toBe(MESSAGE_DISSOLUTION);
  });

  test("un marqueur non Discord (donnée ancienne) n'est jamais envoyé à l'API", async () => {
    await effetsDiscord("jeton-synthetique", { ...clan, channel_id: "", role_id: "pending:x", broadcast_channel: null, fils: [] }, maintenant);
    expect(appels.some(a => a.url.includes("pending"))).toBe(false);
    expect(appels.some(a => a.method === "DELETE" && a.url.endsWith("/channels/"))).toBe(false);
  });

  test("embed d'annonce du legacy", () => {
    const embed = embedDissolution(clan, maintenant);
    expect(embed.title).toBe("Dissolution de Clan : Raimon");
    expect(embed.fields.map(f => f.name)).toEqual(["Fondateurs", "Fondé le", "Fame accumulée"]);
  });
});
