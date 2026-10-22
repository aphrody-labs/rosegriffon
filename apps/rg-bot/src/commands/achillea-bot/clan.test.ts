/**
 * `/clan` — chaque sous-commande contre une API simulée : chemin nominal et refus.
 * Le client est le vrai `ClientAchilleaDelegue` ; seul `fetch` est doublé.
 */
import { afterEach, describe, expect, test } from "bun:test";
import { ClanMemberRole } from "@rosegriffon/achillea-core/enums";

import { fausseInteraction, installerApi, type Gestionnaire } from "../../../test/achillea-kit";
import { carriereFactice, ficheFactice, JOUEUR_TEST as MOI, PRESIDENT_TEST as AUTRE } from "../../../test/achillea-clans-fixtures";
import { ClanCommandes, PHRASE_TRANSFERT } from "./clan";

let restaurer: (() => void) | null = null;
afterEach(() => {
  restaurer?.();
  restaurer = null;
});

function api(routes: Record<string, Gestionnaire | unknown>) {
  const installe = installerApi(routes);
  restaurer = installe.restaurer;
  return installe.appels;
}

const commandes = new ClanCommandes();

describe("/clan infos", () => {
  test("par sigle : la fiche et le bouton Postuler", async () => {
    const appels = api({ "GET /clans/fiche/:ref": ficheFactice() });
    const i = fausseInteraction();
    await commandes.infos("psg", i as never);
    expect(appels[0]?.chemin).toBe("/clans/fiche/psg");
    expect(i.texte()).toContain("[PSG] Paris Griffon");
    expect(i.texte()).toContain("init_application:42");
  });

  test("sans sigle : l'annuaire paginé et le sélecteur clanSelector", async () => {
    const appels = api({
      "GET /clans": {
        data: [{ id: 42, name: "Paris Griffon", shortName: "PSG", avatarUrl: "", biography: "", fame: 120, isRecruiting: true, membersLimit: false }],
        count: 31,
      },
    });
    const i = fausseInteraction();
    await commandes.infos(undefined, i as never);
    expect(appels[0]?.chemin).toBe("/clans");
    expect(i.texte()).toContain("clanSelector");
    expect(i.texte()).toContain("clan_infos_page:2");
    expect(i.texte()).toContain("Paris Griffon");
  });

  test("sigle inconnu : le motif de l'API", async () => {
    api({ "GET /clans/fiche/:ref": [404, { success: false, error: "Aucun Clan ne correspond à « ZZZ »." }] });
    const i = fausseInteraction();
    await commandes.infos("ZZZ", i as never);
    expect(i.texte()).toContain("Aucun Clan ne correspond");
  });

  test("bouton de page et sélection d'un clan", async () => {
    api({
      "GET /clans": { data: [], count: 0 },
      "GET /clans/fiche/:ref": ficheFactice(),
    });
    const page = fausseInteraction({ customId: "clan_infos_page:3" });
    await commandes.page(page as never);
    expect(page.envois[0]?.via).toBe("deferUpdate");
    expect(page.texte()).toContain("Aucun Clan actif");

    const choix = fausseInteraction({ customId: "clanSelector", valeurs: ["42"] });
    await commandes.choisir(choix as never);
    expect(choix.texte()).toContain("clan_infos_page:1");
    expect(choix.texte()).toContain("[PSG] Paris Griffon");
  });
});

describe("/clan apply", () => {
  test("clan qui recrute : le menu apply_distinctions", async () => {
    api({ "GET /clans/fiche/:ref": ficheFactice() });
    const i = fausseInteraction();
    await commandes.apply("PSG", i as never);
    expect(i.texte()).toContain("apply_distinctions:42");
  });

  test("clan fermé : refus", async () => {
    api({ "GET /clans/fiche/:ref": ficheFactice({ isRecruiting: false }) });
    const i = fausseInteraction();
    await commandes.apply("PSG", i as never);
    expect(i.texte()).toContain("ne recrute pas");
  });
});

describe("/clan invite-member", () => {
  const cible = { id: AUTRE, bot: false, toString: () => `<@${AUTRE}>` };

  test("Vice-Président : le menu invite_distinctions", async () => {
    api({ "GET /clans/history/:userId": carriereFactice(ClanMemberRole.SubCaptain) });
    const i = fausseInteraction();
    await commandes.inviteMember(cible as never, i as never);
    expect(i.texte()).toContain(`invite_distinctions:${AUTRE}`);
  });

  test("simple membre : refus", async () => {
    api({ "GET /clans/history/:userId": carriereFactice(ClanMemberRole.Member) });
    const i = fausseInteraction();
    await commandes.inviteMember(cible as never, i as never);
    expect(i.texte()).toContain("Accès refusé");
    expect(i.texte()).not.toContain("invite_distinctions");
  });
});

describe("/clan leave", () => {
  test("membre : confirmation puis départ", async () => {
    const appels = api({
      "GET /clans/history/:userId": carriereFactice(ClanMemberRole.Member),
      "POST /clans/leave": { success: true, clanId: 42, clanName: "Paris Griffon" },
    });
    const i = fausseInteraction();
    await commandes.leave(i as never);
    expect(i.texte()).toContain("clan_leave_confirm:42");

    const clic = fausseInteraction({ customId: "clan_leave_confirm:42" });
    await commandes.confirmerDepart(clic as never);
    expect(appels.at(-1)).toMatchObject({ methode: "POST", chemin: "/clans/leave", corps: { clanId: 42 } });
    expect(clic.texte()).toContain("Vous avez quitté le Clan Paris Griffon");
  });

  test("Président : refusé sans appel d'écriture", async () => {
    const appels = api({ "GET /clans/history/:userId": carriereFactice(ClanMemberRole.Captain) });
    const i = fausseInteraction();
    await commandes.leave(i as never);
    expect(i.texte()).toContain("Le Président ne peut pas quitter");
    expect(appels.every(a => a.methode === "GET")).toBe(true);
  });

  test("composition verrouillée : le motif de l'API", async () => {
    api({ "POST /clans/leave": [409, { success: false, error: "Impossible de quitter le clan : composition verrouillée." }] });
    const clic = fausseInteraction({ customId: "clan_leave_confirm:42" });
    await commandes.confirmerDepart(clic as never);
    expect(clic.texte()).toContain("composition verrouillée");
  });
});

describe("/clan disband", () => {
  test("Président : confirmation puis dissolution", async () => {
    const appels = api({
      "GET /clans/history/:userId": carriereFactice(ClanMemberRole.Captain),
      "POST /clans/:id/disband": { success: true, clanId: 42, clanName: "Paris Griffon" },
    });
    const i = fausseInteraction();
    await commandes.disband(undefined, i as never);
    expect(i.texte()).toContain("clan_disband_confirm:42");
    const clic = fausseInteraction({ customId: "clan_disband_confirm:42" });
    await commandes.confirmerDissolution(clic as never);
    expect(appels.at(-1)?.chemin).toBe("/clans/42/disband");
    expect(clic.texte()).toContain("a été dissous");
  });

  test("Vice-Président : refusé localement", async () => {
    api({ "GET /clans/history/:userId": carriereFactice(ClanMemberRole.SubCaptain) });
    const i = fausseInteraction();
    await commandes.disband(undefined, i as never);
    expect(i.texte()).toContain("Seul le Président");
  });

  test("clan désigné par un non-administrateur : refus 403 de l'API", async () => {
    api({ "POST /clans/:id/disband": [403, { success: false, error: "Seul le Président du Clan (ou un administrateur) peut le dissoudre." }] });
    const clic = fausseInteraction({ customId: "clan_disband_confirm:42" });
    await commandes.confirmerDissolution(clic as never);
    expect(clic.texte()).toContain("ou un administrateur");
  });

  test("Annuler efface la demande", async () => {
    const clic = fausseInteraction({ customId: "clan_action_cancel" });
    await commandes.annuler(clic as never);
    expect(clic.texte()).toContain("Action annulée");
  });
});

describe("/clan transfer-ownership", () => {
  test("soi-même : refus immédiat, pas de modale", async () => {
    const i = fausseInteraction({ utilisateur: { id: MOI } });
    await commandes.transferOwnership({ id: MOI } as never, i as never);
    expect(i.envois.some(e => e.via === "showModal")).toBe(false);
    expect(i.texte()).toContain("vous choisir");
  });

  test("modale, phrase recopiée, transfert", async () => {
    const appels = api({ "POST /clans/transfer-ownership": { success: true, clanId: 42, clanName: "Paris Griffon" } });
    const i = fausseInteraction();
    await commandes.transferOwnership({ id: AUTRE } as never, i as never);
    expect(i.texte()).toContain(`clan_transfer_modal:${AUTRE}`);

    const modale = fausseInteraction({ customId: `clan_transfer_modal:${AUTRE}`, champs: { userInput: PHRASE_TRANSFERT } });
    await commandes.validerTransfert(modale as never);
    expect(appels[0]).toMatchObject({ chemin: "/clans/transfer-ownership", corps: { userId: AUTRE } });
    expect(modale.texte()).toContain("nouveau Président");
  });

  test("mauvaise phrase : aucun appel", async () => {
    const appels = api({});
    const modale = fausseInteraction({ customId: `clan_transfer_modal:${AUTRE}`, champs: { userInput: "oui" } });
    await commandes.validerTransfert(modale as never);
    expect(appels).toHaveLength(0);
    expect(modale.texte()).toContain("La validation a échoué");
  });

  test("non-Président : refus de l'API", async () => {
    api({ "POST /clans/transfer-ownership": [403, { success: false, error: "Seul le Président peut transférer la présidence." }] });
    const modale = fausseInteraction({ customId: `clan_transfer_modal:${AUTRE}`, champs: { userInput: PHRASE_TRANSFERT } });
    await commandes.validerTransfert(modale as never);
    expect(modale.texte()).toContain("Seul le Président");
  });
});

describe("/clan poster", () => {
  test("affiche jointe en PNG", async () => {
    api({
      "GET /clans/fiche/:ref": ficheFactice(),
      "GET /clans/:id/poster.png": () => new Response(new Uint8Array([137, 80, 78, 71]), { headers: { "content-type": "image/png" } }),
    });
    const i = fausseInteraction();
    await commandes.poster("PSG", i as never);
    expect(i.texte()).toContain("Affiche officielle du Clan");
    expect(i.texte()).toContain("clan-42-poster.png");
  });

  test("hors clan et sans sigle : refus", async () => {
    api({ "GET /clans/history/:userId": carriereFactice(null) });
    const i = fausseInteraction();
    await commandes.poster(undefined, i as never);
    expect(i.texte()).toContain("Vous ne faites pas partie d'un Clan");
  });
});
