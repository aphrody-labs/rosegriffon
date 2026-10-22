/**
 * Profil Discord Achilléa : serveur d'administration, pont REST, audit signé et
 * routes `/admin/ops/*` + `/bot/*` de l'API unifiée.
 *
 * Aucun appel réseau réel : Discord est simulé par un client factice (serveur
 * d'administration) ou par `fetch` espionné (pont REST) ; l'API s'arrête à la
 * garde ou au serveur d'administration, sans ouvrir de connexion Postgres.
 */
import { afterAll, afterEach, beforeAll, describe, expect, spyOn, test } from "bun:test";

import { signatureAudit } from "../src/api/modules/achillea/audit";
import { developpeurs, versLigneCommande, versLigneGuilde } from "../src/api/modules/achillea/ops";
import {
  appelerBotAchillea,
  BotAchilleaInjoignable,
  envoyerMpAchillea,
  jetonBotAchillea,
  publierSalonAchillea,
} from "../src/lib/achillea-discord";
import { PROFILS, jetonDuProfil } from "../src/lib/profil";
import { PROFILS_BOT } from "@rosegriffon/types/bot";

// ─── Client Discord factice ─────────────────────────────────────────────────

function guildeFactice(options: { id: string; nom: string; membres: number; inviter: boolean }) {
  const quittee = { valeur: false };
  const salon = {
    id: `${options.id}9`,
    type: 0,
    rawPosition: 0,
    createInvite: async () => ({ url: `https://discord.gg/${options.id.slice(-4)}` }),
  };
  return {
    quittee,
    guild: {
      id: options.id,
      name: options.nom,
      memberCount: options.membres,
      ownerId: "100000000000000001",
      joinedAt: new Date("2026-01-02T03:04:05.000Z"),
      iconURL: () => null,
      bannerURL: () => null,
      toJSON: () => ({ id: options.id, name: options.nom }),
      members: {
        me: { permissionsIn: () => ({ has: () => options.inviter }) },
        cache: new Map(),
        fetchMe: async () => null,
      },
      channels: { fetch: async () => new Map([[salon.id, salon]]), cache: new Map() },
      roles: { cache: new Map() },
      leave: async () => {
        quittee.valeur = true;
      },
    },
  };
}

const A = guildeFactice({ id: "200000000000000001", nom: "Tournois", membres: 50, inviter: true });
const B = guildeFactice({ id: "200000000000000002", nom: "Clans", membres: 900, inviter: false });

const clientFactice = {
  isReady: () => true,
  ws: { ping: 42 },
  user: {
    tag: "AchilleaBot#0001",
    id: "1427690638576582697",
    toJSON: () => ({ id: "1427690638576582697", username: "AchilleaBot" }),
    displayAvatarURL: () => "https://cdn.discordapp.com/avatar.png",
    bannerURL: () => null,
  },
  application: { id: "1427690638576582697", owner: { toJSON: () => ({ id: "100000000000000001" }) } },
  guilds: {
    cache: new Map([
      [A.guild.id, A.guild],
      [B.guild.id, B.guild],
    ]),
    fetch: async (id: string) => (id === A.guild.id ? A.guild : id === B.guild.id ? B.guild : null),
  },
  users: {
    cache: new Map(),
    fetch: async () => null,
  },
};

const JETON_ADMIN = "jeton-admin-de-test";
const PORT = 39_000 + Math.floor(Math.random() * 1000);
let arreter: (() => void) | null = null;

beforeAll(async () => {
  process.env.BOT_ADMIN_TOKEN = JETON_ADMIN;
  process.env.BOT_ADMIN_PORT = String(PORT);
  process.env.BOT_ADMIN_URL_ACHILLEA = `http://127.0.0.1:${PORT}`;
  const { demarrerServeurAdmin } = await import("../src/lib/serveur-admin");
  const serveur = demarrerServeurAdmin(clientFactice as never);
  arreter = () => serveur?.stop();
});

afterAll(() => arreter?.());

describe("profil achillea", () => {
  test("lit son propre jeton, jamais celui du bot Rose Griffon", () => {
    expect(jetonDuProfil(PROFILS.achillea, { ACHILLEA_DISCORD_BOT_TOKEN: "jeton-achillea" })).toBe("jeton-achillea");
    expect(() => jetonDuProfil(PROFILS.achillea, { DISCORD_BOT_TOKEN: "jeton-rg" })).toThrow(/ACHILLEA_DISCORD_BOT_TOKEN/);
  });

  test("publie par guilde sur le serveur Achilléa et demande GuildMembers", () => {
    expect(PROFILS.achillea.porteeCommandes).toBe("guildes");
    expect(PROFILS.achillea.guildes).toEqual(["1055585286320554055"]);
    // Guilds, GuildMembers, et GuildVoiceStates pour l'alerte du vocal d'aide ranked.
    expect(PROFILS.achillea.intents.length).toBe(3);
  });

  test("a son propre port d'administration", () => {
    const ports = Object.values(PROFILS_BOT).map(p => p.portAdmin);
    expect(new Set(ports).size).toBe(ports.length);
    expect(PROFILS_BOT.achillea.portAdmin).toBe(3009);
  });
});

describe("serveur d'administration (client factice)", () => {
  test("liste les guildes, la plus peuplée en tête", async () => {
    const { guildes } = await appelerBotAchillea<{ guildes: Array<{ id: string; proprietaire: string; rejointeLe: string }> }>(
      "/guildes",
    );
    expect(guildes.map(g => g.id)).toEqual([B.guild.id, A.guild.id]);
    expect(guildes[0]!.proprietaire).toBe("100000000000000001");
    expect(guildes[0]!.rejointeLe).toBe("2026-01-02T03:04:05.000Z");
  });

  test("crée une invitation quand un salon le permet, 409 sinon", async () => {
    const ok = await appelerBotAchillea<{ url: string }>(`/guildes/${A.guild.id}/invitation`, { method: "POST" });
    expect(ok.url).toBe("https://discord.gg/0001");
    const refus = await appelerBotAchillea(`/guildes/${B.guild.id}/invitation`, { method: "POST" }).catch(e => e);
    expect(refus).toBeInstanceOf(BotAchilleaInjoignable);
    expect((refus as BotAchilleaInjoignable).statut).toBe(409);
  });

  test("404 pour une guilde que le bot n'a pas rejointe", async () => {
    const refus = await appelerBotAchillea("/guildes/299999999999999999/invitation", { method: "POST" }).catch(e => e);
    expect((refus as BotAchilleaInjoignable).statut).toBe(404);
  });

  test("identité et départ d'un serveur", async () => {
    const identite = await appelerBotAchillea<{ user: { username: string }; owner: { id: string } }>("/identite");
    expect(identite.user.username).toBe("AchilleaBot");
    expect(identite.owner.id).toBe("100000000000000001");
    await appelerBotAchillea(`/guildes/${A.guild.id}/quitter`, { method: "POST" });
    expect(A.quittee.valeur).toBe(true);
  });

  test("refuse un jeton faux", async () => {
    const reponse = await fetch(`http://127.0.0.1:${PORT}/guildes`, { headers: { Authorization: "Bearer faux" } });
    expect(reponse.status).toBe(401);
  });

  test("le journal recopie la console une fois branché", async () => {
    const { brancherJournal } = await import("../src/lib/serveur-admin");
    brancherJournal();
    console.info("ligne-témoin-du-journal");
    const { lignes } = await appelerBotAchillea<{ lignes: string[] }>("/journal");
    expect(lignes.some(l => l.includes("[info] ligne-témoin-du-journal"))).toBe(true);
  });
});

describe("pont REST Discord", () => {
  const env = { ACHILLEA_DISCORD_BOT_TOKEN: "jeton-test" };
  let espion: ReturnType<typeof spyOn> | null = null;
  afterEach(() => espion?.mockRestore());

  test("sans jeton, aucun appel et un motif explicite", async () => {
    espion = spyOn(globalThis, "fetch");
    const resultat = await publierSalonAchillea("300000000000000001", { content: "x" }, {});
    expect(resultat).toEqual({ ok: false, statut: null, motif: "ACHILLEA_DISCORD_BOT_TOKEN absent" });
    expect(espion).not.toHaveBeenCalled();
    expect(jetonBotAchillea({ ACHILLEA_DISCORD_BOT_TOKEN: "$AUTRE" })).toBeNull();
  });

  test("un MP ouvre le canal puis poste, sans mention de masse", async () => {
    const appels: Array<{ url: string; corps: unknown; auth: string | null }> = [];
    espion = spyOn(globalThis, "fetch").mockImplementation((async (url: string, init?: RequestInit) => {
      appels.push({
        url,
        corps: init?.body ? JSON.parse(String(init.body)) : null,
        auth: new Headers(init?.headers).get("authorization"),
      });
      return url.endsWith("/users/@me/channels") ? Response.json({ id: "400000000000000001" }) : Response.json({ id: "500000000000000001" });
    }) as typeof fetch);
    const resultat = await envoyerMpAchillea("100000000000000009", { content: "Candidature acceptée" }, env);
    expect(resultat).toEqual({ ok: true, id: "500000000000000001" });
    expect(appels[0]!.corps).toEqual({ recipient_id: "100000000000000009" });
    expect(appels[1]!.url).toEndWith("/channels/400000000000000001/messages");
    expect(appels[1]!.corps).toMatchObject({ content: "Candidature acceptée", allowed_mentions: { parse: ["users"] } });
    expect(appels.every(a => a.auth === "Bot jeton-test")).toBe(true);
  });

  test("respecte la limite de débit puis réussit", async () => {
    let n = 0;
    espion = spyOn(globalThis, "fetch").mockImplementation((async () =>
      ++n === 1 ? Response.json({ retry_after: 0.01 }, { status: 429 }) : Response.json({ id: "600000000000000001" })) as unknown as typeof fetch);
    const resultat = await publierSalonAchillea("300000000000000001", { content: "x" }, env);
    expect(resultat).toEqual({ ok: true, id: "600000000000000001" });
    expect(n).toBe(2);
  });

  test("MP fermés : résultat négatif, pas d'exception", async () => {
    espion = spyOn(globalThis, "fetch").mockImplementation((async (url: string) =>
      url.endsWith("/users/@me/channels")
        ? Response.json({ id: "400000000000000001" })
        : Response.json({ code: 50007, message: "Cannot send messages to this user" }, { status: 403 })) as unknown as typeof fetch);
    const resultat = await envoyerMpAchillea("100000000000000009", { content: "x" }, env);
    expect(resultat.ok).toBe(false);
    if (!resultat.ok) expect(resultat.statut).toBe(403);
  });
});

describe("journal d'audit", () => {
  test("signature identique à la formule de l'ancien bot", () => {
    const ts = new Date("2026-10-22T10:00:00.000Z");
    const entree = { actor_id: "1", action: "wallet.adjust", target_type: "user", target_id: "2", payload: { amount: 5 }, ts };
    const attendu = new Bun.CryptoHasher("sha256")
      .update(
        "tete" +
          JSON.stringify({ actor_id: "1", action: "wallet.adjust", target_type: "user", target_id: "2", payload: { amount: 5 }, ts: ts.toISOString() }),
      )
      .digest("hex");
    expect(signatureAudit("tete", entree)).toBe(attendu);
    expect(signatureAudit(null, entree)).not.toBe(attendu);
  });
});

describe("routes /admin/ops et /bot", () => {
  let app: { handle: (r: Request) => Promise<Response> };
  beforeAll(async () => {
    process.env.API_ADMIN_TOKEN = "secret-dev-de-test";
    ({ app } = await import("../src/api/server"));
  });

  test("toutes les routes ops exigent une session", async () => {
    for (const [methode, chemin] of [
      ["GET", "health"],
      ["GET", "audit"],
      ["GET", "metrics-summary"],
      ["GET", "guilds"],
      ["GET", "guilds/200000000000000001/invite"],
      ["GET", "commands"],
      ["GET", "logs"],
      ["POST", "maintenance"],
    ] as const) {
      const reponse = await app.handle(
        new Request(`http://localhost/v1/achillea/admin/ops/${chemin}`, {
          method: methode,
          headers: { "content-type": "application/json" },
          body: methode === "POST" ? '{"maintenance":true}' : undefined,
        }),
      );
      expect(`${chemin} ${reponse.status}`).toBe(`${chemin} 401`);
    }
  });

  test("l'API développeur exige le secret d'administration", async () => {
    const sans = await app.handle(new Request("http://localhost/v1/achillea/bot/guilds"));
    expect(sans.status).toBe(400);
    const faux = await app.handle(new Request("http://localhost/v1/achillea/bot/guilds", { headers: { authorization: "Bearer faux" } }));
    expect(faux.status).toBe(401);
  });

  test("avec le secret, lit l'identité du bot en direct", async () => {
    const reponse = await app.handle(
      new Request("http://localhost/v1/achillea/bot/info", { headers: { authorization: "Bearer secret-dev-de-test" } }),
    );
    expect(reponse.status).toBe(200);
    expect(((await reponse.json()) as { user: { username: string } }).user.username).toBe("AchilleaBot");
  });

  test("bot injoignable : 503 explicite", async () => {
    const avant = process.env.BOT_ADMIN_URL_ACHILLEA;
    process.env.BOT_ADMIN_URL_ACHILLEA = "http://127.0.0.1:1";
    const reponse = await app.handle(
      new Request("http://localhost/v1/achillea/bot/commands", { headers: { authorization: "Bearer secret-dev-de-test" } }),
    );
    process.env.BOT_ADMIN_URL_ACHILLEA = avant;
    expect(reponse.status).toBe(503);
    expect(((await reponse.json()) as { message: string }).message).toStartWith("Bot Discord Achilléa indisponible");
  });

  test("développeurs : propriétaire en tête, identifiants invalides écartés", () => {
    expect(developpeurs({ ACHILLEA_DEV_IDS: "100000000000000002, pas-un-id", ACHILLEA_BOT_OWNER_ID: "100000000000000001" })).toEqual([
      "100000000000000001",
      "100000000000000002",
    ]);
  });

  test("projections vers le contrat du client", () => {
    expect(
      versLigneGuilde({ id: "1", nom: "N", membres: 3, servie: false, icone: null, proprietaire: "9", rejointeLe: null }),
    ).toEqual({ id: "1", name: "N", iconURL: null, memberCount: 3, ownerId: "9", createdAt: null });
    expect(
      versLigneCommande({
        chemin: "clan infos",
        racine: "clan",
        groupe: null,
        sousCommande: "infos",
        description: "d",
        options: [],
        profil: "achillea",
        source: null,
        reservee: false,
      }),
    ).toEqual({ name: "clan infos", description: "d", type: 1 });
  });
});

describe("salon des preuves de litige", () => {
  test("variable dédiée, puis salon TO configuré, puis salon TO du serveur Achilléa", async () => {
    const { salonPreuvesRanked, SALON_TO_ACHILLEA } = await import("../src/lib/achillea-discord");
    expect(salonPreuvesRanked({ RANKED_PROOF_CHANNEL_ID: "700000000000000001", ACHILLEA_TO_CHANNEL_ID: "700000000000000002" })).toBe(
      "700000000000000001",
    );
    expect(salonPreuvesRanked({ ACHILLEA_TO_CHANNEL_ID: "700000000000000002" })).toBe("700000000000000002");
    expect(salonPreuvesRanked({ RANKED_PROOF_CHANNEL_ID: "pas-un-id" })).toBe(SALON_TO_ACHILLEA);
  });
});

describe("chaîne d'audit relue depuis jsonb", () => {
  test("la signature ne dépend pas de l'ordre des clés de la charge", () => {
    const ts = new Date("2026-10-22T13:00:00.000Z");
    const base = { actor_id: null, action: "storage.migrate", target_type: "storage", target_id: "images", ts };
    // Ordre d'écriture JS, puis ordre rendu par Postgres (`jsonb` trie par longueur puis octets).
    const ecrite = signatureAudit(null, { ...base, payload: { clans: 58, images: 7, captures: 2, objets: 62, vers: "b", depuis: "a" } });
    const relue = signatureAudit(null, { ...base, payload: { vers: "b", clans: 58, images: 7, objets: 62, depuis: "a", captures: 2 } });
    expect(relue).toBe(ecrite);
  });
});

describe("vérification d'une charge stockée en chaîne jsonb", () => {
  test("relue sans canonisation, elle redonne la signature d'origine", () => {
    const ts = new Date("2026-10-22T13:16:18.072Z");
    const charge = { clans: 58, images: 7, captures: 2, objets: 62, depuis: "a", vers: "b" };
    const base = { actor_id: null, action: "storage.migrate", target_type: "storage", target_id: "images", ts };
    const origine = new Bun.CryptoHasher("sha256")
      .update(
        JSON.stringify({
          actor_id: null,
          action: "storage.migrate",
          target_type: "storage",
          target_id: "images",
          payload: charge,
          ts: ts.toISOString(),
        }),
      )
      .digest("hex");
    expect(signatureAudit(null, { ...base, payload: JSON.parse(JSON.stringify(charge)) }, "tel-quel")).toBe(origine);
  });
});
