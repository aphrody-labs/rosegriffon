/**
 * `/guild settings` et les boutons du panneau, contre une API simulée.
 */
import { afterEach, describe, expect, test } from "bun:test";

import { fausseInteraction, installerApi } from "../../../test/achillea-kit";
import { embedReglages, GuildBoutons, GuildCommande, rangeeGestion, rangeeReglages, serveurDuBouton } from "./guild";

const SERVEUR = "1055585286320554055";
const SALON = "1320451424689193070";
const REGLAGES = { guildId: SERVEUR, broadcastChannel: SALON, rankedEnabled: false, clan: null };

let restaurer: (() => void) | null = null;
afterEach(() => {
  restaurer?.();
  restaurer = null;
});

function api(routes: Parameters<typeof installerApi>[0]) {
  const installation = installerApi(routes);
  restaurer = installation.restaurer;
  return installation.appels;
}

const ids = (rangee: { toJSON(): unknown }) =>
  (rangee.toJSON() as { components: Array<{ custom_id?: string }> }).components.map(c => c.custom_id);

describe("présentation", () => {
  test("custom_id legacy, bouton de liaison selon le clan", () => {
    expect(ids(rangeeReglages(REGLAGES))).toEqual([
      `broadcast_channel_button:${SERVEUR}`,
      `broadcast_management_button:${SERVEUR}`,
      `bind_clan_guild:${SERVEUR}`,
    ]);
    expect(ids(rangeeReglages({ ...REGLAGES, clan: { id: 1, name: "A", shortName: "A" } }))[2]).toBe(`unbind_clan_guild:${SERVEUR}`);
    expect(ids(rangeeGestion(REGLAGES))).toEqual([
      `delete_broadcast_channel_button:${SERVEUR}`,
      `ranked_broadcast_toggle:${SERVEUR}`,
      `guild_settings_menu:${SERVEUR}`,
    ]);
    expect(JSON.stringify(embedReglages(REGLAGES).toJSON())).toContain(`<#${SALON}>`);
    expect(serveurDuBouton(`bind_clan_guild:${SERVEUR}`)).toBe(SERVEUR);
    expect(serveurDuBouton("bind_clan_guild:abc")).toBeNull();
  });
});

describe("/guild settings", () => {
  test("administrateur : panneau rendu depuis l'API, au nom du membre", async () => {
    const appels = api({ [`GET /guilds/${SERVEUR}/settings`]: REGLAGES });
    const interaction = fausseInteraction({ administrateur: true, guildId: SERVEUR });
    await new GuildCommande().settings(interaction as never);
    expect(appels).toHaveLength(1);
    expect(appels[0]?.porteur).toStartWith("Bearer ");
    expect(interaction.envois[0]?.via).toBe("deferReply");
    expect(interaction.texte()).toContain("broadcast_channel_button");
  });

  test("refus de l'API (403) : message de l'API", async () => {
    api({ [`GET /guilds/${SERVEUR}/settings`]: [403, { message: "Tu dois être administrateur du serveur" }] });
    const interaction = fausseInteraction({ administrateur: true, guildId: SERVEUR });
    await new GuildCommande().settings(interaction as never);
    expect(interaction.texte()).toContain("Tu dois être administrateur du serveur");
  });

  test("non administrateur ou hors serveur : refus local, aucun appel", async () => {
    const appels = api({});
    const membre = fausseInteraction({ administrateur: false, guildId: SERVEUR });
    await new GuildCommande().settings(membre as never);
    expect(membre.texte()).toContain("Accès refusé");
    const mp = fausseInteraction({ administrateur: true, guildId: null });
    await new GuildCommande().settings(mp as never);
    expect(mp.texte()).toContain("serveur");
    expect(appels).toHaveLength(0);
  });
});

describe("boutons", () => {
  const bouton = (customId: string, administrateur = true) =>
    fausseInteraction({ administrateur, guildId: SERVEUR, customId });

  test("broadcast_channel_button ouvre la fenêtre modal_guild_broadcast_channel", async () => {
    api({});
    const i = bouton(`broadcast_channel_button:${SERVEUR}`);
    await new GuildBoutons().ouvrirFenetre(i as never);
    expect(i.envois[0]?.via).toBe("showModal");
    expect(i.texte()).toContain(`modal_guild_broadcast_channel:${SERVEUR}`);
  });

  test("fenêtre : salon choisi envoyé à l'API, panneau mis à jour", async () => {
    const appels = api({ [`PATCH /guilds/${SERVEUR}/settings`]: REGLAGES });
    const i = bouton(`modal_guild_broadcast_channel:${SERVEUR}`);
    i.fields.getSelectedChannels = () => ({ first: () => ({ id: SALON }) });
    await new GuildBoutons().fenetre(i as never);
    expect(appels[0]?.corps).toEqual({ broadcastChannel: SALON });
    expect(i.envois.map(e => e.via)).toEqual(["deferUpdate", "editReply", "followUp"]);
  });

  test("lier / délier : nominal et refus 403", async () => {
    const lie = { ...REGLAGES, clan: { id: 7, name: "Les Griffons", shortName: "RG" } };
    api({ [`POST /guilds/${SERVEUR}/clan`]: lie, [`DELETE /guilds/${SERVEUR}/clan`]: [403, { message: "Seuls le Président" }] });
    const lier = bouton(`bind_clan_guild:${SERVEUR}`);
    await new GuildBoutons().lier(lier as never);
    expect(lier.texte()).toContain("Les Griffons");
    expect(lier.texte()).toContain("unbind_clan_guild");
    const delier = bouton(`unbind_clan_guild:${SERVEUR}`);
    await new GuildBoutons().delier(delier as never);
    expect(delier.envois.map(e => e.via)).toEqual(["deferUpdate", "followUp"]);
    expect(delier.texte()).toContain("Seuls le Président");
  });

  test("gestion, retour au menu, suppression du salon", async () => {
    const appels = api({
      [`GET /guilds/${SERVEUR}/settings`]: REGLAGES,
      [`PATCH /guilds/${SERVEUR}/settings`]: { ...REGLAGES, broadcastChannel: null },
    });
    const gestion = bouton(`broadcast_management_button:${SERVEUR}`);
    await new GuildBoutons().gestion(gestion as never);
    expect(gestion.texte()).toContain("ranked_broadcast_toggle");
    const menu = bouton(`guild_settings_menu:${SERVEUR}`);
    await new GuildBoutons().menu(menu as never);
    expect(menu.texte()).toContain("broadcast_channel_button");
    const suppr = bouton(`delete_broadcast_channel_button:${SERVEUR}`);
    await new GuildBoutons().supprimerSalon(suppr as never);
    expect(appels.at(-1)?.corps).toEqual({ broadcastChannel: null });
  });

  test("bascule ranked : inverse l'état lu en base", async () => {
    const appels = api({
      [`GET /guilds/${SERVEUR}/settings`]: REGLAGES,
      [`PATCH /guilds/${SERVEUR}/settings`]: { ...REGLAGES, rankedEnabled: true },
    });
    const i = bouton(`ranked_broadcast_toggle:${SERVEUR}`);
    await new GuildBoutons().basculerRanked(i as never);
    expect(appels.at(-1)?.corps).toEqual({ rankedEnabled: true });
    expect(i.texte()).toContain("activées");
  });

  test("membre sans droit ou autre serveur : refus, aucun appel", async () => {
    const appels = api({});
    const i = bouton(`bind_clan_guild:${SERVEUR}`, false);
    await new GuildBoutons().lier(i as never);
    expect(i.texte()).toContain("Accès refusé");
    const ailleurs = fausseInteraction({ administrateur: true, guildId: "900000000000000001", customId: `bind_clan_guild:${SERVEUR}` });
    await new GuildBoutons().lier(ailleurs as never);
    expect(ailleurs.texte()).toContain("ne concerne pas ce serveur");
    expect(appels).toHaveLength(0);
  });
});
