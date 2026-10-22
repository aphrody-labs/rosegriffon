/**
 * Boutons et menus des clans : chaque `custom_id` de l'ancien bot, chemin
 * nominal et refus. Un refus sur un message public ne doit jamais le réécrire.
 */
import { afterEach, describe, expect, test } from "bun:test";
import { MetadataStorage } from "discordx";

import { fausseInteraction, installerApi, type Gestionnaire } from "../../../test/achillea-kit";
import { carriereFactice, ficheFactice } from "../../../test/achillea-clans-fixtures";
import { ComposantsClan, messageVoteApres } from "./composants-clan";

const JOUEUR = "222222222222222222";

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

const c = new ComposantsClan();

/** Le message public a-t-il été réécrit (hors simple retrait des boutons) ? */
function messageReecrit(i: ReturnType<typeof fausseInteraction>): boolean {
  return i.envois.some(e => e.via === "editReply" && JSON.stringify(e.charge).includes("embeds"));
}

describe("identifiants de l'ancien bot", () => {
  test("chaque custom_id legacy est servi par une expression identique", () => {
    const attendus = [
      "/^confirm_application:.+/",
      "/^refuse_application:.+/",
      "/^init_application:.+/",
      "/^create_application:.+/",
      "/^cancel_application:.+/",
      "/^apply_distinctions:\\d+$/",
      "/^confirm_invite:.+/",
      "/^cancel_invite:.+/",
      "/^init_invite:.+/",
      "/^invite_distinctions:\\d+$/",
      "/vote:(approve|reject):(\\d+)/",
      "/^get_clan_history:.+/",
      "dismiss-message",
    ];
    const declares = [...MetadataStorage.instance.buttonComponents, ...MetadataStorage.instance.selectMenuComponents]
      .filter(composant => composant.classRef === ComposantsClan)
      .map(composant => String(composant.id));
    for (const id of attendus) expect(declares).toContain(id);
  });
});

describe("candidatures", () => {
  test("accepter : appel par identifiant, boutons retirés", async () => {
    const appels = api({ "POST /clans/applications/accept": { success: true } });
    const i = fausseInteraction({ customId: "confirm_application:17" });
    await c.accepterCandidature(i as never);
    expect(appels[0]).toMatchObject({ chemin: "/clans/applications/accept", corps: { id: 17 } });
    expect(i.texte()).toContain("Candidature acceptée");
  });

  test("accepter sans droit : réponse privée, message intact", async () => {
    api({ "POST /clans/applications/accept": [403, { success: false, error: "Vous n'avez pas les droits pour effectuer cette action" }] });
    const i = fausseInteraction({ customId: "confirm_application:17" });
    await c.accepterCandidature(i as never);
    expect(i.envois.at(-1)?.via).toBe("followUp");
    expect(i.texte()).toContain("pas les droits");
    expect(messageReecrit(i)).toBe(false);
  });

  test("refuser : nominal et refus", async () => {
    const appels = api({ "POST /clans/applications/reject": { success: true } });
    const i = fausseInteraction({ customId: "refuse_application:17" });
    await c.refuserCandidature(i as never);
    expect(appels[0]?.chemin).toBe("/clans/applications/reject");
    expect(i.texte()).toContain("Candidature refusée");
    restaurer?.();
    api({ "POST /clans/applications/reject": [404, { success: false, error: "Candidature introuvable." }] });
    const j = fausseInteraction({ customId: "refuse_application:17" });
    await c.refuserCandidature(j as never);
    expect(j.texte()).toContain("Candidature introuvable");
  });

  test("init_application ouvre le menu, refuse un clan fermé", async () => {
    api({ "GET /clans/fiche/:ref": ficheFactice() });
    const i = fausseInteraction({ customId: "init_application:42" });
    await c.ouvrirCandidature(i as never);
    expect(i.texte()).toContain("apply_distinctions:42");
    restaurer?.();
    api({ "GET /clans/fiche/:ref": ficheFactice({ isRecruiting: false }) });
    const j = fausseInteraction({ customId: "init_application:42" });
    await c.ouvrirCandidature(j as never);
    expect(j.texte()).toContain("ne recrute pas");
  });

  test("apply_distinctions demande confirmation avec les clés choisies", async () => {
    api({ "GET /clans/fiche/:ref": ficheFactice() });
    const i = fausseInteraction({ customId: "apply_distinctions:42", valeurs: ["Player", "Staff"] });
    await c.choisirDistinctionsCandidature(i as never);
    expect(i.texte()).toContain("create_application:42:Player|Staff");
    expect(i.texte()).toContain("cancel_application:42");
    expect(i.texte()).toContain("Joueur, Staff");
  });

  test("create_application envoie les distinctions, rend le refus de l'API", async () => {
    const appels = api({ "POST /clans/applications/create": { success: true, autojoin: false } });
    const i = fausseInteraction({ customId: "create_application:42:Player|Staff" });
    await c.envoyerCandidature(i as never);
    expect(appels[0]?.corps).toEqual({ clanId: 42, distinctions: ["Joueur", "Staff"] });
    expect(i.texte()).toContain("candidature a été envoyée");
    restaurer?.();
    api({ "POST /clans/applications/create": [400, { success: false, error: "Vous faites déjà partie d'un Clan." }] });
    const j = fausseInteraction({ customId: "create_application:42:Player" });
    await c.envoyerCandidature(j as never);
    expect(j.texte()).toContain("déjà partie d'un Clan");
  });

  test("cancel_application efface la réponse", async () => {
    const i = fausseInteraction({ customId: "cancel_application:42" });
    await c.annulerCandidature(i as never);
    expect(i.texte()).toContain("supprime");
  });
});

describe("invitations", () => {
  test("confirm_invite : l'invité rejoint", async () => {
    const appels = api({ "POST /clans/invites/accept": { success: true, clanId: 42, clanName: "Paris Griffon" } });
    const i = fausseInteraction({ customId: "confirm_invite:5" });
    await c.accepterInvitation(i as never);
    expect(appels[0]).toMatchObject({ chemin: "/clans/invites/accept", corps: { id: 5 } });
    expect(i.texte()).toContain("Vous avez rejoint le Clan Paris Griffon");
  });

  test("confirm_invite par un autre joueur : refus privé", async () => {
    api({ "POST /clans/invites/accept": [403, { success: false, error: "Cette invitation ne vous est pas adressée." }] });
    const i = fausseInteraction({ customId: "confirm_invite:5" });
    await c.accepterInvitation(i as never);
    expect(i.envois.at(-1)?.via).toBe("followUp");
    expect(i.texte()).toContain("pas adressée");
  });

  test("cancel_invite : refus de l'invitation", async () => {
    const appels = api({ "POST /clans/invites/decline": { success: true, clanName: "Paris Griffon" } });
    const i = fausseInteraction({ customId: "cancel_invite:5" });
    await c.refuserInvitation(i as never);
    expect(appels[0]?.chemin).toBe("/clans/invites/decline");
    expect(i.texte()).toContain("refusée");
    restaurer?.();
    api({ "POST /clans/invites/decline": [404, { success: false, error: "Cette invitation n'existe plus." }] });
    const j = fausseInteraction({ customId: "cancel_invite:5" });
    await c.refuserInvitation(j as never);
    expect(j.texte()).toContain("n'existe plus");
  });

  test("init_invite ouvre le menu, invite_distinctions invite", async () => {
    const i = fausseInteraction({ customId: `init_invite:${JOUEUR}` });
    await c.ouvrirInvitation(i as never);
    expect(i.texte()).toContain(`invite_distinctions:${JOUEUR}`);

    const appels = api({ "POST /clans/invites/create": { success: true } });
    const j = fausseInteraction({ customId: `invite_distinctions:${JOUEUR}`, valeurs: ["Player"] });
    await c.choisirDistinctionsInvitation(j as never);
    expect(appels[0]?.corps).toEqual({ userId: JOUEUR, distinctions: ["Joueur"] });
    expect(j.texte()).toContain("Invitation envoyée");
  });

  test("invite_distinctions sans droit : motif de l'API", async () => {
    api({ "POST /clans/invites/create": [403, { success: false, error: "Vous n'avez pas les droits pour effectuer cette action" }] });
    const j = fausseInteraction({ customId: `invite_distinctions:${JOUEUR}`, valeurs: ["Player"] });
    await c.choisirDistinctionsInvitation(j as never);
    expect(j.texte()).toContain("pas les droits");
  });
});

describe("votes", () => {
  const vote = (surcharge: Record<string, unknown> = {}) => ({
    success: true,
    proposalId: 9,
    type: "CLAN_CREATION",
    action: "inserer",
    status: "PENDING",
    approvals: 1,
    rejections: 0,
    eligible: 4,
    clan: { id: 42, name: "Paris Griffon" },
    message: "Vous avez rejoint le Clan Paris Griffon !",
    ...surcharge,
  });

  test("vote:approve : décompte mis à jour et réponse privée", async () => {
    const appels = api({ "POST /clans/votes/:id": vote() });
    const i = fausseInteraction({ customId: "vote:approve:9" });
    i.message.embeds = [{ title: "[PSG] Paris Griffon - Clan foundation", fields: [{ name: "Votes", value: "0 / 4" }] }];
    await c.voter(i as never);
    expect(appels[0]).toMatchObject({ chemin: "/clans/votes/9", corps: { approve: true } });
    expect(i.texte()).toContain("1 / 4");
    expect(i.texte()).toContain("Vous avez rejoint");
  });

  test("vote d'un non-éligible : refus privé, message intact", async () => {
    api({ "POST /clans/votes/:id": [403, { success: false, error: "Vous n'êtes pas éligible pour ce vote." }] });
    const i = fausseInteraction({ customId: "vote:reject:9" });
    await c.voter(i as never);
    expect(i.texte()).toContain("pas éligible");
    expect(messageReecrit(i)).toBe(false);
  });

  test("proposition close : boutons retirés, issue affichée", () => {
    const charge = messageVoteApres([], vote({ status: "APPROVED", approvals: 3 }) as never);
    expect(charge.components).toEqual([]);
    expect(JSON.stringify(charge.embeds[0]!.toJSON())).toContain("Approuvée");
  });
});

describe("divers", () => {
  test("get_clan_history : la carrière et le bouton d'invitation", async () => {
    api({ "GET /clans/history/:userId": carriereFactice(1) });
    const i = fausseInteraction({
      customId: `get_clan_history:${JOUEUR}`,
      client: { users: { fetch: async () => ({ displayAvatarURL: () => "https://cdn.example/a.png" }) } },
    });
    await c.carriere(i as never);
    expect(i.texte()).toContain("Carrière");
    expect(i.texte()).toContain(`init_invite:${JOUEUR}`);
  });

  test("get_clan_history d'un inconnu : motif", async () => {
    api({ "GET /clans/history/:userId": [404, { success: false, error: "Ce joueur n'a pas de compte Achilléa." }] });
    const i = fausseInteraction({ customId: `get_clan_history:${JOUEUR}` });
    await c.carriere(i as never);
    expect(i.texte()).toContain("pas de compte Achilléa");
  });

  test("dismiss-message efface", async () => {
    const i = fausseInteraction({ customId: "dismiss-message" });
    await c.fermer(i as never);
    expect(i.texte()).toContain("supprime");
  });
});
