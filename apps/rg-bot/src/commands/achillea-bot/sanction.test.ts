/**
 * `/sanction` contre une API simulée et un serveur Discord doublé.
 */
import { afterEach, describe, expect, test } from "bun:test";

import { fausseInteraction, installerApi, type AppelApi, type RequeteSimulee } from "../../../test/achillea-kit";
import { CommandeSanction } from "./sanction";

const SERVEUR = "1055585286320554055";
const MODO = { id: "111111111111111111", username: "modo" };
const CIBLE = { id: "333333333333333333", username: "fautif", bot: false, displayName: "Fautif" };

let restaurer: (() => void) | null = null;
afterEach(() => {
  restaurer?.();
  restaurer = null;
});

function api(routes: Parameters<typeof installerApi>[0]): AppelApi[] {
  const installation = installerApi(routes);
  restaurer = installation.restaurer;
  return installation.appels;
}

function sanctionFactice(champs: Record<string, unknown> = {}) {
  return {
    id: "5d1c2a9e-0000-4000-8000-000000000001",
    userId: CIBLE.id,
    guildId: SERVEUR,
    type: "warn",
    reason: "spam",
    durationSec: null,
    issuedBy: MODO.id,
    issuedByType: "staff",
    expiresAt: null,
    revokedAt: null,
    revokedBy: null,
    revokeReason: null,
    evidence: null,
    createdAt: new Date().toISOString(),
    ...champs,
  };
}

const page = (data: unknown[]) => ({ data, total: data.length, meta: { page: 1, pageSize: 100, pageCount: 1 } });

/** Serveur Discord doublé : consigne chaque effet appliqué. */
function serveurDouble() {
  const effets: string[] = [];
  const serveur = {
    members: {
      fetch: async (id: string) => ({
        timeout: async (ms: number | null) => void effets.push(`timeout:${id}:${ms}`),
        kick: async () => void effets.push(`kick:${id}`),
      }),
    },
    bans: {
      create: async (id: string) => void effets.push(`ban:${id}`),
      remove: async (id: string) => void effets.push(`unban:${id}`),
    },
  };
  const client = { user: { id: "222222222222222222" }, guilds: { fetch: async () => serveur } };
  return { effets, client };
}

const interactionSanction = (client: unknown) => fausseInteraction({ utilisateur: MODO, guildId: SERVEUR, client });

describe("/sanction warn", () => {
  test("nominal : enregistrée par l'API au nom du modérateur, pas d'escalade sous 3 warns", async () => {
    const appels = api({
      "POST /sanctions": sanctionFactice(),
      "GET /sanctions": page([sanctionFactice()]),
    });
    const { client, effets } = serveurDouble();
    const interaction = interactionSanction(client);
    await new CommandeSanction().warn(CIBLE as never, "spam", "capture", interaction as never);

    expect(interaction.envois[0]?.via).toBe("deferReply");
    expect(appels[0]).toMatchObject({ methode: "POST", chemin: "/sanctions" });
    expect(appels[0]?.corps).toMatchObject({ type: "warn", userId: CIBLE.id, guildId: SERVEUR, evidence: [{ note: "capture" }] });
    expect(appels[0]?.porteur).toStartWith("Bearer ");
    expect(appels.filter(a => a.methode === "POST")).toHaveLength(1);
    expect(effets).toEqual([]);
    expect(interaction.texte()).toContain("Avertissement émis");
  });

  test("3 warns actifs : escalade en mute 1 h appliquée sur Discord", async () => {
    const warns = [1, 2, 3].map(n => sanctionFactice({ id: `w${n}` }));
    let posts = 0;
    const appels = api({
      "POST /sanctions": ({ corps }: RequeteSimulee) => {
        posts += 1;
        const c = corps as { type: string; durationSec?: number };
        return sanctionFactice({ id: `s${posts}`, type: c.type, durationSec: c.durationSec ?? null });
      },
      "GET /sanctions": page(warns),
    });
    const { client, effets } = serveurDouble();
    const interaction = interactionSanction(client);
    await new CommandeSanction().warn(CIBLE as never, "spam", undefined, interaction as never);

    const creations = appels.filter(a => a.methode === "POST");
    expect(creations).toHaveLength(2);
    expect(creations[1]?.corps).toMatchObject({ type: "mute", durationSec: 3600 });
    expect(effets).toEqual([`timeout:${CIBLE.id}:3600000`]);
    expect(interaction.texte()).toContain("Escalade automatique");
  });

  test("refus de l'API (403) : le motif est affiché, aucun effet", async () => {
    api({ "POST /sanctions": [403, { message: "Administrator role required" }] });
    const { client, effets } = serveurDouble();
    const interaction = interactionSanction(client);
    await new CommandeSanction().warn(CIBLE as never, "spam", undefined, interaction as never);
    expect(interaction.texte()).toContain("Administrator role required");
    expect(effets).toEqual([]);
  });

  test("se sanctionner soi-même est refusé avant tout appel", async () => {
    const appels = api({});
    const interaction = interactionSanction(serveurDouble().client);
    await new CommandeSanction().warn({ ...MODO, bot: false } as never, "x", undefined, interaction as never);
    expect(appels).toEqual([]);
    expect(interaction.texte()).toContain("vous-même");
  });
});

describe("/sanction mute, kick, ban", () => {
  test("mute 30m : timeout Discord de 30 minutes", async () => {
    const appels = api({ "POST /sanctions": sanctionFactice({ type: "mute", durationSec: 1800, expiresAt: new Date().toISOString() }) });
    const { client, effets } = serveurDouble();
    const interaction = interactionSanction(client);
    await new CommandeSanction().mute(CIBLE as never, "flood", "30m", interaction as never);
    expect(appels[0]?.corps).toMatchObject({ type: "mute", durationSec: 1800 });
    expect(effets).toEqual([`timeout:${CIBLE.id}:1800000`]);
    expect(interaction.texte()).toContain("Mute appliqué");
  });

  test("durée invalide ou au-delà de 28 jours : aucun appel", async () => {
    const appels = api({});
    const interaction = interactionSanction(serveurDouble().client);
    await new CommandeSanction().mute(CIBLE as never, "flood", "demain", interaction as never);
    await new CommandeSanction().mute(CIBLE as never, "flood", "40d", interaction as never);
    expect(appels).toEqual([]);
    expect(interaction.texte()).toContain("Durée invalide");
  });

  test("kick : expulsion Discord", async () => {
    api({ "POST /sanctions": sanctionFactice({ type: "kick" }) });
    const { client, effets } = serveurDouble();
    await new CommandeSanction().kick(CIBLE as never, "insultes", interactionSanction(client) as never);
    expect(effets).toEqual([`kick:${CIBLE.id}`]);
  });

  test("ban : effet Discord en échec, la sanction reste et la réponse le dit", async () => {
    api({ "POST /sanctions": sanctionFactice({ type: "ban" }) });
    const client = {
      guilds: {
        fetch: async () => ({
          members: { fetch: async () => ({}) },
          bans: {
            create: async () => {
              throw new Error("Missing Permissions");
            },
          },
        }),
      },
    };
    const interaction = interactionSanction(client);
    await new CommandeSanction().ban(CIBLE as never, "triche", "7d", interaction as never);
    expect(interaction.texte()).toContain("Sanction enregistrée");
    expect(interaction.texte()).toContain("Missing Permissions");
  });

  test("ban refusé par l'API (403)", async () => {
    api({ "POST /sanctions": [403, { message: "Administrator role required" }] });
    const { client, effets } = serveurDouble();
    const interaction = interactionSanction(client);
    await new CommandeSanction().ban(CIBLE as never, "triche", undefined, interaction as never);
    expect(effets).toEqual([]);
    expect(interaction.texte()).toContain("Administrator role required");
  });
});

describe("/sanction list et revoke", () => {
  test("list : sanctions actives du serveur", async () => {
    const appels = api({ "GET /sanctions": page([sanctionFactice({ type: "mute", durationSec: 600 })]) });
    const interaction = interactionSanction(serveurDouble().client);
    await new CommandeSanction().list(CIBLE as never, interaction as never);
    expect(appels[0]?.chemin).toBe("/sanctions");
    expect(interaction.texte()).toContain("Sanctions actives (1)");
    expect(interaction.texte()).toContain("10m");
  });

  test("revoke d'un ban : débannissement Discord", async () => {
    const id = "5d1c2a9e-0000-4000-8000-000000000009";
    api({ [`POST /sanctions/${id}/revoke`]: sanctionFactice({ id, type: "ban", revokedAt: new Date().toISOString() }) });
    const { client, effets } = serveurDouble();
    const interaction = interactionSanction(client);
    await new CommandeSanction().revoke(id, "erreur", interaction as never);
    expect(effets).toEqual([`unban:${CIBLE.id}`]);
    expect(interaction.texte()).toContain("Sanction révoquée");
  });

  test("revoke refusé (403)", async () => {
    api({ "POST /sanctions/abc/revoke": [403, { message: "Administrator role required" }] });
    const interaction = interactionSanction(serveurDouble().client);
    await new CommandeSanction().revoke("abc", "x", interaction as never);
    expect(interaction.texte()).toContain("Administrator role required");
  });
});
