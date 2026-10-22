/**
 * `/clan teams` et les composants `team_*`, contre une API simulée.
 */
import { afterEach, describe, expect, test } from "bun:test";

import { fausseInteraction, installerApi } from "../../../test/achillea-kit";
import { ClanEquipes, lireEffectif } from "./clan-equipes";
import { appartenance, CLAN_ID, equipe, MEMBRE, PRESIDENT, VICE } from "./clan-fixtures.test-kit";

let restaurer: (() => void) | null = null;
afterEach(() => {
  restaurer?.();
  restaurer = null;
});

function api(routes: Record<string, unknown>) {
  const installe = installerApi(routes);
  restaurer = installe.restaurer;
  return installe.appels;
}

function interaction(options: Parameters<typeof fausseInteraction>[0] = {}) {
  const i = fausseInteraction({ utilisateur: { id: PRESIDENT, username: "Endou" }, ...options });
  i.isChatInputCommand = () => !options.customId;
  return i;
}

const routesEquipes = (role: number | null, equipes = [equipe(0), equipe(1)]) => ({
  "GET /clans/teams/membership": appartenance(role),
  [`GET /clans/teams/clan/${CLAN_ID}`]: equipes,
  "GET /clans/teams/70": equipe(0),
});

const equipes = new ClanEquipes();

describe("/clan teams", () => {
  test("nominal : menu des deux équipes, identifiants legacy", async () => {
    api(routesEquipes(3));
    const i = interaction({ commande: "clan", sousCommande: "teams" });
    await equipes.teams(i as never);
    expect(i.texte()).toContain(`team_manager_btn:${CLAN_ID}:1`);
    expect(i.texte()).toContain(`team_manager_btn:${CLAN_ID}:2`);
    expect(i.texte()).toContain("Il faut au moins 3 joueurs.");
  });

  test("crée les équipes manquantes d'un clan validé avant leur introduction", async () => {
    const appels = api({
      ...routesEquipes(3, []),
      "POST /clans/teams": (requete: { corps: unknown }) => equipe((requete.corps as { type: 0 | 1 }).type),
    });
    const i = interaction({ commande: "clan", sousCommande: "teams" });
    await equipes.teams(i as never);
    expect(appels.filter(a => a.chemin === "/clans/teams").map(a => a.corps)).toEqual([
      { clanId: CLAN_ID, type: 0 },
      { clanId: CLAN_ID, type: 1 },
    ]);
    expect(i.texte()).toContain("Equipe secondaire");
  });

  test("refus : un membre simple n'y a pas accès", async () => {
    const appels = api(routesEquipes(1));
    const i = interaction({ commande: "clan", sousCommande: "teams" });
    await equipes.teams(i as never);
    expect(i.texte()).toContain("réservé au Président et aux Vice-Présidents");
    expect(appels).toHaveLength(1);
  });
});

describe("composants team_*", () => {
  test("team_manager_btn ouvre l'équipe 1 (type 0)", async () => {
    api(routesEquipes(2));
    const i = interaction({ customId: `team_manager_btn:${CLAN_ID}:1` });
    await equipes.ouvrirEquipe(i as never);
    expect(i.envois[0]?.via).toBe("deferUpdate");
    expect(i.texte()).toContain("team_edit_btn:0:0");
    expect(i.texte()).toContain("team_settings_btn:70");
    expect(i.texte()).toContain("**[C]** Kabeyama");
  });

  test("team_manager_btn d'un autre clan : refus explicite", async () => {
    api(routesEquipes(3));
    const i = interaction({ customId: "team_manager_btn:999:1" });
    await equipes.ouvrirEquipe(i as never);
    expect(i.texte()).toContain("autre clan");
  });

  test("return_teams_menu revient au menu", async () => {
    api(routesEquipes(3));
    const i = interaction({ customId: "return_teams_menu" });
    await equipes.retourMenu(i as never);
    expect(i.texte()).toContain(`team_manager_btn:${CLAN_ID}:2`);
  });

  test("team_edit_btn ouvre la modale d'effectif en première réponse", async () => {
    api(routesEquipes(3));
    const i = interaction({ customId: "team_edit_btn:0:1" });
    await equipes.editerEffectif(i as never);
    expect(i.envois.map(e => e.via)).toEqual(["showModal"]);
    expect(i.texte()).toContain("team_manager_modal:70:1");
    expect(i.texte()).toContain(`sub_1:0:${CLAN_ID}`);
  });

  test("team_settings_btn ouvre la modale de paramètres", async () => {
    api(routesEquipes(3));
    const i = interaction({ customId: "team_settings_btn:70" });
    await equipes.parametres(i as never);
    expect(i.texte()).toContain("team_settings_modal:70");
    expect(i.texte()).toContain("team_settings_captain:70");
  });

  test("team_manager_modal : effectif envoyé à l'API, équipe réaffichée", async () => {
    const appels = api({ ...routesEquipes(3), "PUT /clans/teams/70/roster": equipe(0) });
    const i = interaction({
      customId: "team_manager_modal:70:0",
      champs: { [`player_1:0:${CLAN_ID}`]: MEMBRE, [`player_2:0:${CLAN_ID}`]: ` ${VICE} ` },
    });
    await equipes.enregistrerEffectif(i as never);
    expect(appels.find(a => a.methode === "PUT")?.corps).toEqual({ role: 0, userIds: [MEMBRE, VICE] });
    expect(i.texte()).toContain("team_edit_btn:0:2");
  });

  test("team_manager_modal refusé par l'API (409) : motif affiché", async () => {
    api({
      ...routesEquipes(3),
      "PUT /clans/teams/70/roster": [409, { message: "<@1> occupe déjà une place dans l'équipe « Equipe secondaire »" }],
    });
    const i = interaction({ customId: "team_manager_modal:70:0", champs: {} });
    await equipes.enregistrerEffectif(i as never);
    expect(i.texte()).toContain("occupe déjà une place");
  });

  test("team_settings_modal : nom et capitaine, sinon « aucun changement »", async () => {
    const appels = api({ ...routesEquipes(3), "PATCH /clans/teams/70": equipe(0) });
    const i = interaction({ customId: "team_settings_modal:70", champs: { "team_settings_name:70": "Les Éclairs" } });
    i.fields.getStringSelectValues = () => [MEMBRE];
    await equipes.enregistrerParametres(i as never);
    expect(appels.find(a => a.methode === "PATCH")?.corps).toEqual({ name: "Les Éclairs" });

    const inchange = interaction({ customId: "team_settings_modal:70", champs: { "team_settings_name:70": "Equipe principale" } });
    inchange.fields.getStringSelectValues = () => [MEMBRE];
    await equipes.enregistrerParametres(inchange as never);
    expect(inchange.texte()).toContain("Aucun changement");
  });

  test("lireEffectif ignore les champs vides et absents", () => {
    const champs = {
      getTextInputValue: (id: string) => {
        if (id === `coach_1:1:${CLAN_ID}`) return " 123 ";
        throw new Error("absent");
      },
    };
    expect(lireEffectif(champs, 2, { type: 1, clanId: CLAN_ID })).toEqual(["123"]);
  });
});
