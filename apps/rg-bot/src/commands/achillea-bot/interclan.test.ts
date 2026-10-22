/**
 * `/interclan` et ses boutons, contre une API simulée (le vrai client, seul le réseau manque).
 */
import { afterEach, describe, expect, test } from "bun:test";

import { fausseInteraction, installerApi } from "../../../test/achillea-kit";
import { ficheInterclan, matchsEnCours } from "../../../test/interclan-fixture";
import { ETAT } from "../../api/modules/achillea/interclans/regles";
import { champsNumeriques, dirige, InterclanComposants, placementsSaisis, scoreSaisi } from "./composants-interclan";
import { InterclanCommande, ligneInterclan } from "./interclan";

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
const REFUS = [403, { message: "Il faut être Vice-Président ou Président du clan." }];
const vias = (i: { envois: Array<{ via: string }> }) => i.envois.map(e => e.via);
const commande = new InterclanCommande();
const composants = new InterclanComposants();

describe("utilitaires", () => {
  test("lecture des custom_id, des saisies et des droits", () => {
    expect(champsNumeriques("interclan_lineup:42:1", 2)).toEqual([42, 1]);
    expect(champsNumeriques("start_interclan:x", 1)).toBeNull();
    expect(placementsSaisis(c => ({ lineup_member_1: " 110000000000000000 ", lineup_member_3: "<@!130000000000000000>" })[c] ?? "")).toEqual([
      { userId: "110000000000000000", position: 1 },
      { userId: "130000000000000000", position: 3 },
    ]);
    expect(scoreSaisi("3")).toBe(3);
    expect(scoreSaisi("-1")).toBeNull();
    expect(scoreSaisi("abc")).toBeNull();
    const fiche = ficheInterclan();
    expect(dirige(fiche, 7)).toBe(true);
    expect(dirige(fiche, 9)).toBe(false);
    expect(dirige({ ...fiche, viewer: { clanId: null, clanRole: null, isAdmin: true } }, 9)).toBe(true);
    expect(ligneInterclan({ ...fiche, fixedDate: fiche.fixedDate })).toContain("**AR** vs **BB**");
  });
});

describe("/interclan request", () => {
  test("nominal : le défi part au nom de l'auteur, date brute transmise à l'API", async () => {
    const appels = api({ "POST /interclans": ficheInterclan({ state: ETAT.EN_ATTENTE }) });
    const i = fausseInteraction();
    await commande.request("bb", "25/10 20:00", "Revanche", i as never);
    expect(appels[0]?.corps).toEqual({ challengedShortName: "bb", date: "25/10 20:00", motif: "Revanche" });
    expect(appels[0]?.porteur).toStartWith("Bearer ");
    expect(vias(i)[0]).toBe("deferReply");
    expect(i.texte()).toContain("Brume Bleue");
  });

  test("refus de l'API : son motif, en privé", async () => {
    api({ "POST /interclans": REFUS });
    const i = fausseInteraction();
    await commande.request("bb", "25/10 20:00", undefined, i as never);
    expect(i.texte()).toContain("Vice-Président");
  });
});

describe("/interclan liste et infos", () => {
  const resume = { id: 42, name: "AR vs BB", state: 1, stateLabel: "🟢 Accepté", fixedDate: "2026-10-25T18:00:00Z", clanA: { id: 7, name: "A", shortName: "AR" }, clanB: { id: 9, name: "B", shortName: "BB" }, winnerClanId: null };

  test("liste de son clan", async () => {
    const appels = api({ "GET /interclans": { data: [resume] } });
    const i = fausseInteraction();
    await commande.liste(undefined, i as never);
    expect(appels[0]?.chemin).toBe("/interclans");
    expect(i.texte()).toContain("#42");
  });

  test("liste vide : la suite à donner", async () => {
    api({ "GET /interclans": { data: [] } });
    const i = fausseInteraction();
    await commande.liste(true, i as never);
    expect(i.texte()).toContain("Aucun interclan");
  });

  test("infos : la vue de l'état, boutons compris", async () => {
    api({ "GET /interclans/42": ficheInterclan() });
    const i = fausseInteraction();
    await commande.infos(42, i as never);
    expect(i.texte()).toContain("interclan_lineup:42:0");
  });

  test("infos refusée ou introuvable", async () => {
    api({ "GET /interclans/42": [404, { message: "Cet Interclan n'existe plus ou a été supprimé." }] });
    const i = fausseInteraction();
    await commande.infos(42, i as never);
    expect(i.texte()).toContain("n'existe plus");
  });
});

describe("boutons et fenêtres", () => {
  test("interclan_approval : accepter réécrit le message", async () => {
    const appels = api({ "POST /interclans/42/respond": ficheInterclan() });
    const i = fausseInteraction({ customId: "interclan_approval:42:1" });
    await composants.approbation(i as never);
    expect(appels[0]?.corps).toEqual({ accept: true });
    expect(vias(i)).toEqual(["deferUpdate", "editReply"]);
    expect(i.texte()).toContain("accepté");
  });

  test("interclan_approval : refus de droits en privé, message public intact", async () => {
    api({ "POST /interclans/42/respond": [403, { message: "Seuls les membres du clan défié (Brume Bleue) peuvent répondre à ce défi." }] });
    const i = fausseInteraction({ customId: "interclan_approval:42:0" });
    await composants.approbation(i as never);
    expect(vias(i)).toEqual(["deferUpdate", "followUp"]);
    expect(i.texte()).toContain("clan défié");
  });

  test("interclan_lineup : fenêtre pré-remplie pour son clan, refus pour l'autre", async () => {
    api({ "GET /interclans/42": ficheInterclan() });
    const i = fausseInteraction({ customId: "interclan_lineup:42:0" });
    await composants.composition(i as never);
    expect(vias(i)).toEqual(["showModal"]);
    expect(i.texte()).toContain("lineup_manager_modal:7:42");

    const autre = fausseInteraction({ customId: "interclan_lineup:42:1" });
    await composants.composition(autre as never);
    expect(vias(autre)).toEqual(["reply"]);
    expect(autre.texte()).toContain("Brume Bleue");
  });

  test("lineup_manager_modal : composition envoyée, message mis à jour", async () => {
    const appels = api({ "PUT /interclans/42/lineups/7": ficheInterclan() });
    const i = fausseInteraction({ customId: "lineup_manager_modal:7:42", champs: { lineup_member_1: "110000000000000000", lineup_member_2: "120000000000000000" } });
    await composants.enregistrerComposition(i as never);
    expect(appels[0]?.corps).toEqual({
      members: [
        { userId: "110000000000000000", position: 1 },
        { userId: "120000000000000000", position: 2 },
      ],
    });
    expect(vias(i)).toEqual(["deferUpdate", "editReply", "followUp"]);
  });

  test("lineup_manager_modal : refus (non-membre) en privé", async () => {
    api({ "PUT /interclans/42/lineups/7": [400, { message: "Les IDs suivants ne sont pas des membres du clan : 1" }] });
    const i = fausseInteraction({ customId: "lineup_manager_modal:7:42", champs: { lineup_member_1: "190000000000000000" } });
    await composants.enregistrerComposition(i as never);
    expect(vias(i)).toEqual(["deferUpdate", "followUp"]);
    expect(i.texte()).toContain("pas des membres");
  });

  test("lock_interclan_lineup : verrou puis vue « prêt »", async () => {
    const appels = api({
      "GET /interclans/42": ficheInterclan(),
      "POST /interclans/42/lineups/7/lock": ficheInterclan({ state: ETAT.PRET }),
    });
    const i = fausseInteraction({ customId: "lock_interclan_lineup:42:0" });
    await composants.verrouiller(i as never);
    expect(appels.map(a => `${a.methode} ${a.chemin}`)).toEqual(["GET /interclans/42", "POST /interclans/42/lineups/7/lock"]);
    expect(i.texte()).toContain("start_interclan:42");
  });

  test("lock_interclan_lineup : hors fenêtre → motif de l'API", async () => {
    api({
      "GET /interclans/42": ficheInterclan(),
      "POST /interclans/42/lineups/7/lock": [409, { message: "Le verrouillage ne peut être effectué qu'une heure avant le début de l'Interclan." }],
    });
    const i = fausseInteraction({ customId: "lock_interclan_lineup:42:0" });
    await composants.verrouiller(i as never);
    expect(vias(i)).toEqual(["deferUpdate", "followUp"]);
  });

  test("cancel_interclan : confirmation demandée au Président, refus aux autres", async () => {
    api({ "GET /interclans/42": ficheInterclan() });
    const i = fausseInteraction({ customId: "cancel_interclan:42" });
    await composants.annuler(i as never);
    expect(i.texte()).toContain("cancel_interclan_confirmation:42:1");

    api({ "GET /interclans/42": ficheInterclan({ viewer: { clanId: 7, clanRole: 2, isAdmin: false } }) });
    const vp = fausseInteraction({ customId: "cancel_interclan:42" });
    await composants.annuler(vp as never);
    expect(vp.texte()).toContain("Seuls les Présidents");
  });

  test("cancel_interclan_confirmation : oui annule, non efface la question", async () => {
    const appels = api({ "POST /interclans/42/cancel": ficheInterclan({ state: ETAT.ANNULE }) });
    const oui = fausseInteraction({ customId: "cancel_interclan_confirmation:42:1" });
    await composants.confirmerAnnulation(oui as never);
    expect(appels).toHaveLength(1);
    expect(oui.texte()).toContain("annulé");

    const non = fausseInteraction({ customId: "cancel_interclan_confirmation:42:0" });
    await composants.confirmerAnnulation(non as never);
    expect(appels).toHaveLength(1);
    expect(non.texte()).toContain("supprime");
  });

  test("cancel_interclan_confirmation : refus 403 en privé", async () => {
    api({ "POST /interclans/42/cancel": [403, { message: "Seul le Président du clan peut effectuer cette action." }] });
    const i = fausseInteraction({ customId: "cancel_interclan_confirmation:42:1" });
    await composants.confirmerAnnulation(i as never);
    expect(vias(i)).toEqual(["deferUpdate", "followUp"]);
  });

  test("start_interclan : scores et boutons de matchs", async () => {
    api({ "POST /interclans/42/start": ficheInterclan({ state: ETAT.EN_COURS, matches: matchsEnCours() }) });
    const i = fausseInteraction({ customId: "start_interclan:42" });
    await composants.lancer(i as never);
    expect(i.texte()).toContain("interclan_match:42:101");
  });

  test("start_interclan : trop tôt → motif", async () => {
    api({ "POST /interclans/42/start": [409, { message: "Le lancement de l'interclan s'effectue à partir de l'heure prévue" }] });
    const i = fausseInteraction({ customId: "start_interclan:42" });
    await composants.lancer(i as never);
    expect(vias(i)).toEqual(["deferUpdate", "followUp"]);
  });

  test("interclan_match : fenêtre de score, match inconnu refusé", async () => {
    api({ "GET /interclans/42": ficheInterclan({ state: ETAT.EN_COURS, matches: matchsEnCours() }) });
    const i = fausseInteraction({ customId: "interclan_match:42:101" });
    await composants.ouvrirScore(i as never);
    expect(i.texte()).toContain("interclan_match_result_modal:101");

    const inconnu = fausseInteraction({ customId: "interclan_match:42:999" });
    await composants.ouvrirScore(inconnu as never);
    expect(inconnu.texte()).toContain("#999");

    const joue = fausseInteraction({ customId: "interclan_match:42:100" });
    await composants.ouvrirScore(joue as never);
    expect(joue.texte()).toContain("déjà enregistré");
  });

  test("interclan_match_result_modal : score enregistré, dernier match → vote annoncé", async () => {
    const appels = api({
      "POST /interclans/matches/101/score": {
        detail: ficheInterclan({ state: ETAT.TERMINE, matches: matchsEnCours() }),
        termine: true,
        match: { id: 101, scoreA: 3, scoreB: 1, joueurA: "1-2", joueurB: "2-2" },
      },
    });
    const i = fausseInteraction({ customId: "interclan_match_result_modal:101", champs: { score_a: "3", score_b: "1" } });
    await composants.enregistrerScore(i as never);
    expect(appels[0]?.corps).toEqual({ scoreA: 3, scoreB: 1 });
    expect(vias(i)).toEqual(["deferUpdate", "editReply", "followUp"]);
    expect(i.texte()).toContain("vote de validation");
  });

  test("interclan_match_result_modal : saisie invalide sans appel, refus de l'API en privé", async () => {
    const appels = api({ "POST /interclans/matches/101/score": [403, { message: "Seuls les membres des deux clans concernés peuvent effectuer cette action." }] });
    const invalide = fausseInteraction({ customId: "interclan_match_result_modal:101", champs: { score_a: "x", score_b: "1" } });
    await composants.enregistrerScore(invalide as never);
    expect(appels).toHaveLength(0);
    expect(invalide.texte()).toContain("nombres positifs");

    const refuse = fausseInteraction({ customId: "interclan_match_result_modal:101", champs: { score_a: "1", score_b: "1" } });
    await composants.enregistrerScore(refuse as never);
    expect(vias(refuse)).toEqual(["deferUpdate", "followUp"]);
  });
});
