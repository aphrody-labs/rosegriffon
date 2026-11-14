import { afterAll, afterEach, describe, expect, test } from "bun:test";
import { PlayerNoteCategory } from "@rosegriffon/achillea-types";

import { BoutonsFileRanked } from "../src/commands/achillea-bot/matchmaker";
import { CommandeReport } from "../src/commands/achillea-bot/report";
import { CommandeSanction } from "../src/commands/achillea-bot/sanction";
import { fausseInteraction, installerApi } from "./achillea-kit";

const GUILD_ID = "1072991720268111892";
const JOUEUR = { id: "444444444444444444", username: "mark_evans" };
const FAUTIF = {
  id: "555555555555555555",
  username: "adversaire",
  bot: false,
  displayName: "Adversaire",
};
const MODO = { id: "111111111111111111", username: "arbitre" };

let restaurerApi: (() => void) | null = null;
let serveurAzalee: ReturnType<typeof Bun.serve> | null = null;

afterEach(() => {
  restaurerApi?.();
  restaurerApi = null;
});

afterAll(() => {
  serveurAzalee?.stop(true);
  serveurAzalee = null;
});

describe("cas d'usage reels du bot (Achillea + Azalee)", () => {
  test("parcours complet ranked : creation de defi, annulation, signalement puis escalade a 3 warns", async () => {
    const defis = new Map<string, Record<string, unknown>>();
    const signalements: Record<string, unknown>[] = [];
    const sanctions: Record<string, unknown>[] = [];
    const effetsGuild: string[] = [];

    const guild = {
      members: {
        fetch: async (id: string) => ({
          timeout: async (ms: number | null) => {
            effetsGuild.push(`timeout:${id}:${ms}`);
          },
          kick: async () => {
            effetsGuild.push(`kick:${id}`);
          },
        }),
      },
      bans: {
        create: async (id: string) => {
          effetsGuild.push(`ban:${id}`);
        },
        remove: async (id: string) => {
          effetsGuild.push(`unban:${id}`);
        },
      },
    };

    const client = {
      user: { id: "1427690638576582697" },
      guilds: { fetch: async () => guild },
    };

    const { appels, restaurer } = installerApi({
      "POST /ranked/challenge": () => {
        const defi = {
          code: "RgMatch99",
          url: "https://rosegriffon.fr/achillea/ranked/defi/RgMatch99",
          mode: 2,
          ranked: true,
          toUserId: null,
          expiresAt: Date.now() + 600_000,
        };
        defis.set(defi.code, defi);
        return defi;
      },
      "DELETE /ranked/challenge/RgMatch99": () => {
        defis.delete("RgMatch99");
        return { ok: true };
      },
      "POST /player-notes": ({ corps }) => {
        const note = {
          id: `note-${signalements.length + 1}`,
          ...(corps as Record<string, unknown>),
          createdAt: new Date().toISOString(),
        };
        signalements.push(note);
        return note;
      },
      "POST /sanctions": ({ corps }) => {
        const body = corps as Record<string, unknown>;
        const creee = {
          id: `5d1c2a9e-0000-4000-8000-00000000000${sanctions.length + 1}`,
          ...body,
          durationSec: null,
          issuedBy: MODO.id,
          issuedByType: "staff",
          expiresAt: null,
          revokedAt: null,
          revokedBy: null,
          revokeReason: null,
          evidence: null,
          createdAt: new Date().toISOString(),
        };
        sanctions.push(creee);
        return creee;
      },
      "GET /sanctions": () => ({
        data: sanctions,
        total: sanctions.length,
        meta: { page: 1, pageSize: 100, pageCount: 1 },
      }),
    });
    restaurerApi = restaurer;

    // 1. Le joueur lance un defi ranked depuis Discord
    const iJoin = fausseInteraction({
      utilisateur: JOUEUR,
      guildId: GUILD_ID,
      customId: "join_queue:12",
    });
    await new BoutonsFileRanked().rejoindre(iJoin as never);
    expect(defis.has("RgMatch99")).toBe(true);
    expect(iJoin.texte()).toContain("RgMatch99");

    // 2. Le joueur annule son defi avant qu'un adversaire n'accepte
    const iLeave = fausseInteraction({
      utilisateur: JOUEUR,
      guildId: GUILD_ID,
      customId: "leave_queue:RgMatch99",
    });
    await new BoutonsFileRanked().quitter(iLeave as never);
    expect(defis.has("RgMatch99")).toBe(false);
    expect(iLeave.texte()).toContain("retiré");

    // 3. Le joueur signale un comportement anti-jeu
    const iReport = fausseInteraction({
      utilisateur: JOUEUR,
      guildId: GUILD_ID,
    });
    await new CommandeReport().report(
      FAUTIF as never,
      "Deconnexion volontaire en plein match classe",
      PlayerNoteCategory.BEHAVIOR,
      undefined,
      undefined,
      iReport as never,
    );
    expect(signalements).toHaveLength(1);
    expect(signalements[0]?.category).toBe(PlayerNoteCategory.BEHAVIOR);

    // 4. L'arbitre met 3 avertissements progressifs -> le 3e declenche une escalade Discord
    const commandeSanction = new CommandeSanction();
    for (let idx = 1; idx <= 3; idx++) {
      const iWarn = fausseInteraction({
        utilisateur: MODO,
        guildId: GUILD_ID,
        client,
      });
      await commandeSanction.warn(
        FAUTIF as never,
        `Infraction #${idx}`,
        undefined,
        iWarn as never,
      );
    }

    expect(sanctions.length).toBeGreaterThanOrEqual(3);
    expect(effetsGuild.some((e) => e.startsWith(`timeout:${FAUTIF.id}:`))).toBe(
      true,
    );
    expect(appels.some((a) => a.chemin === "/player-notes")).toBe(true);
  });

  test("parcours /azalee perso et /azalee technique via serveur HTTP Azalee reel", async () => {
    const routesAppels: string[] = [];
    serveurAzalee = Bun.serve({
      port: 0,
      fetch(req) {
        const url = new URL(req.url);
        routesAppels.push(`${req.method} ${url.pathname}${url.search}`);

        if (url.pathname === "/v1/azalee/api/characters/mark-evans") {
          return new Response(JSON.stringify({ error: "Not found" }), {
            status: 404,
            headers: { "content-type": "application/json" },
          });
        }
        if (url.pathname === "/v1/azalee/api/characters") {
          return Response.json({
            data: [{ baseSlug: "endou-mamoru", names: { fr: "Mark Evans" } }],
            total: 1,
            page: 1,
            limit: 1,
          });
        }
        if (url.pathname === "/v1/azalee/api/characters/endou-mamoru") {
          return Response.json({
            baseSlug: "endou-mamoru",
            names: { fr: "Mark Evans", en: "Mark Evans", ja: "円堂守" },
            descriptions: { fr: "Gardien legendaire de Raimon." },
            variants: [
              {
                rarity: "Legend",
                position: "GK",
                element: "Montagne",
                stats: {
                  lv99: {
                    kick: 110,
                    control: 120,
                    technique: 135,
                    pressure: 140,
                    physical: 145,
                    agility: 150,
                    intelligence: 130,
                  },
                },
              },
            ],
          });
        }
        if (url.pathname === "/v1/azalee/api/skills/god-hand") {
          return Response.json({
            skillId: "god-hand",
            names: { fr: "Main Celeste", ja: "ゴッドハンド" },
            descriptions: { fr: "Arrete le ballon d'une main geante." },
            categoryName: { fr: "Arrêt" },
            elementName: { fr: "Montagne" },
            tpCost: 35,
            power: { min: 70, max: 110 },
          });
        }
        return new Response("Not found", { status: 404 });
      },
    });

    process.env.DISCORD_BOT_TOKEN ??= "test.discord.token.placeholder";
    process.env.AZALEE_API_URL = `http://127.0.0.1:${serveurAzalee.port}/v1/azalee`;
    const { AzaleeJeuCommand } = await import("../src/commands/azalee-jeu");
    const cmd = new AzaleeJeuCommand();

    const reponsesPerso: unknown[] = [];
    const iPerso = {
      user: JOUEUR,
      guildId: GUILD_ID,
      deferReply: async () => {},
      editReply: async (payload: unknown) => {
        reponsesPerso.push(payload);
        return payload;
      },
    };
    await cmd.perso("mark-evans", "Légendaire", iPerso as never);
    const chargePerso = JSON.stringify(reponsesPerso);
    expect(chargePerso).toContain("Mark Evans");
    expect(chargePerso).toContain("endou-mamoru");
    expect(
      routesAppels.some((r) =>
        r.includes("/v1/azalee/api/characters/endou-mamoru"),
      ),
    ).toBe(true);

    const reponsesTech: unknown[] = [];
    const iTech = {
      user: JOUEUR,
      guildId: GUILD_ID,
      deferReply: async () => {},
      editReply: async (payload: unknown) => {
        reponsesTech.push(payload);
        return payload;
      },
    };
    await cmd.technique("god-hand", undefined, undefined, iTech as never);
    const chargeTech = JSON.stringify(reponsesTech);
    expect(chargeTech).toContain("Main Celeste");
    expect(chargeTech).toContain("Montagne");
    expect(chargeTech).toContain(
      "https://azalee.rosegriffon.fr/skill/god-hand",
    );
  });
});
