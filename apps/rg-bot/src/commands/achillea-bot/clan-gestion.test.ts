/**
 * `/clan manage` et ses composants, contre une API simulée (seul le réseau manque).
 */
import { afterEach, describe, expect, test } from "bun:test";

import { fausseInteraction, installerApi } from "../../../test/achillea-kit";
import { ClanGestion } from "./clan-gestion";
import { CLAN, CLAN_ID, INVITATION, MEMBRE, MEMBRES, PRESIDENT, routesClan } from "./clan-fixtures.test-kit";

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

function commande(options: Parameters<typeof fausseInteraction>[0] = {}) {
  const interaction = fausseInteraction({ utilisateur: { id: PRESIDENT, username: "Endou" }, ...options });
  interaction.isChatInputCommand = () => !options.customId;
  return interaction;
}

const gestion = new ClanGestion();

describe("/clan manage", () => {
  test("nominal : panneau privé du clan, menu principal", async () => {
    api(routesClan(3));
    const interaction = commande({ commande: "clan", sousCommande: "manage" });
    await gestion.manage(interaction as never);
    expect(interaction.envois[0]?.via).toBe("deferReply");
    expect(JSON.stringify(interaction.envois[0]?.charge)).toContain("64");
    const texte = interaction.texte();
    expect(texte).toContain("[RMN] Raimon");
    expect(texte).toContain("clan_manage:infos");
    expect(texte).toContain("clan_manage:members:1");
  });

  test("refus : un simple membre ne gère pas le clan", async () => {
    const appels = api(routesClan(1));
    const interaction = commande({ commande: "clan", sousCommande: "manage" });
    await gestion.manage(interaction as never);
    expect(interaction.texte()).toContain("réservée au Président et aux Vice-Présidents");
    expect(appels.map(a => a.chemin)).toEqual(["/clans/teams/membership"]);
  });

  test("sans clan : message clair", async () => {
    api(routesClan(null));
    const interaction = commande({ commande: "clan", sousCommande: "manage" });
    await gestion.manage(interaction as never);
    expect(interaction.texte()).toContain("Tu n'es membre d'aucun clan actif");
  });
});

describe("composants clan_manage", () => {
  test("bascule « Clan caché » : PATCH au nom de qui clique, panneau mis à jour", async () => {
    const appels = api({
      ...routesClan(3),
      [`PATCH /clans/${CLAN_ID}`]: { success: true },
    });
    const interaction = commande({ customId: "clan_manage:toggle:hidden" });
    await gestion.bouton(interaction as never);
    const patch = appels.find(a => a.methode === "PATCH");
    expect(patch?.corps).toEqual({ isHidden: true });
    expect(interaction.texte()).toContain("clan_manage:toggle:hidden");
  });

  test("refus de l'API (403) : motif affiché en privé, panneau intact", async () => {
    api({
      ...routesClan(2),
      [`PATCH /clans/${CLAN_ID}`]: [403, { message: "Reserved for clan captain or administrator" }],
    });
    const interaction = commande({ customId: "clan_manage:toggle:recruiting" });
    await gestion.bouton(interaction as never);
    const suivi = interaction.envois.find(e => e.via === "followUp");
    expect(JSON.stringify(suivi?.charge)).toContain("Reserved for clan captain or administrator");
    expect(interaction.envois.some(e => e.via === "editReply")).toBe(false);
  });

  test("liste des membres puis sélection d'un membre", async () => {
    api(routesClan(3));
    const liste = commande({ customId: "clan_manage:members:1" });
    await gestion.bouton(liste as never);
    expect(liste.texte()).toContain("clan_manage:member_select");

    const choix = commande({ customId: "clan_manage:member_select", valeurs: [MEMBRE] });
    await gestion.selection(choix as never);
    expect(choix.texte()).toContain("Kabeyama");
    expect(choix.texte()).toContain(`editDistinctions:${MEMBRE}:${CLAN_ID}`);
  });

  test("promotion : updateMember avec le nouveau rôle", async () => {
    const appels = api({ ...routesClan(3), "POST /clans/updateMember": { success: true, members: MEMBRES } });
    const interaction = commande({ customId: `clan_manage:role:${MEMBRE}:1` });
    await gestion.bouton(interaction as never);
    const corps = appels.find(a => a.chemin === "/clans/updateMember")?.corps as { clanRole: number; user: { id: string } };
    expect(corps.clanRole).toBe(1);
    expect(corps.user.id).toBe(MEMBRE);
    expect(interaction.texte()).toContain("Promotion");
  });

  test("le bouton « Nom » ouvre la modale sans différer", async () => {
    api(routesClan(3));
    const interaction = commande({ customId: "clan_manage:name" });
    await gestion.bouton(interaction as never);
    expect(interaction.envois.map(e => e.via)).toEqual(["showModal"]);
    expect(interaction.texte()).toContain("clan_manage:name_modal");
    expect(interaction.texte()).toContain(CLAN.name);
  });

  test("révocation d'une invitation, après confirmation", async () => {
    const appels = api({ ...routesClan(3), "POST /clans/invites/revoke": { success: true } });
    const demande = commande({ customId: `clan_manage:revoke:${INVITATION.id}` });
    await gestion.bouton(demande as never);
    expect(demande.texte()).toContain(`clan_manage:revoke_ok:${INVITATION.id}`);

    const confirme = commande({ customId: `clan_manage:revoke_ok:${INVITATION.id}` });
    await gestion.bouton(confirme as never);
    expect(appels.some(a => a.chemin === "/clans/invites/revoke")).toBe(true);
    expect(confirme.texte()).toContain("Invitation révoquée");
  });
});

describe("modales clan_manage", () => {
  test("nom : PATCH avec le seul champ modifié", async () => {
    const appels = api({ ...routesClan(3), [`PATCH /clans/${CLAN_ID}`]: { success: true } });
    const interaction = commande({
      customId: "clan_manage:name_modal",
      champs: { nameInput: "Raimon Eleven", shortNameInput: "RMN" },
    });
    await gestion.modale(interaction as never);
    expect(appels.find(a => a.methode === "PATCH")?.corps).toEqual({ name: "Raimon Eleven" });
    expect(interaction.texte()).toContain("Nom du clan changé");
  });

  test("expulsion : motif transmis à l'API", async () => {
    const appels = api({ ...routesClan(3), [`POST /clans/kick/${MEMBRE}`]: { success: true, members: MEMBRES.slice(0, 2) } });
    const interaction = commande({ customId: `clan_manage:kick_modal:${MEMBRE}`, champs: { textInput: "Absences répétées" } });
    await gestion.modale(interaction as never);
    expect(appels.find(a => a.chemin === `/clans/kick/${MEMBRE}`)?.corps).toEqual({ reason: "Absences répétées" });
    expect(interaction.texte()).toContain("Membre expulsé");
  });

  test("logo : un format refusé n'appelle pas l'API d'images", async () => {
    const appels = api(routesClan(3));
    const interaction = commande({ customId: "clan_manage:logo_modal" });
    interaction.fields.getUploadedFiles = () => ({
      first: () => ({ url: "https://cdn.test/x.gif", name: "x.gif", contentType: "image/gif" }),
    });
    await gestion.modale(interaction as never);
    expect(interaction.texte()).toContain("png, jpg ou jpeg");
    expect(appels.some(a => a.chemin.startsWith("/proxy"))).toBe(false);
  });
});

describe("identifiants legacy des distinctions", () => {
  test("editDistinctions affiche le menu edit_distinctions", async () => {
    api(routesClan(3));
    const interaction = commande({ customId: `editDistinctions:${MEMBRE}:${CLAN_ID}` });
    await gestion.editerDistinctions(interaction as never);
    expect(interaction.texte()).toContain(`edit_distinctions:${MEMBRE}:${CLAN_ID}`);
    expect(interaction.texte()).toContain(`return_to_member_menu:${MEMBRE}:${CLAN_ID}`);
  });

  test("edit_distinctions : clés traduites en libellés pour l'API", async () => {
    const appels = api({ ...routesClan(3), "POST /clans/updateMember": { success: true } });
    const interaction = commande({ customId: `edit_distinctions:${MEMBRE}:${CLAN_ID}`, valeurs: ["Staff", "Player"] });
    await gestion.choisirDistinctions(interaction as never);
    const corps = appels.find(a => a.chemin === "/clans/updateMember")?.corps as { distinctions: string[] };
    expect(corps.distinctions).toEqual(["Staff", "Joueur"]);
    expect(interaction.texte()).toContain("Distinctions éditées");
  });

  test("edit_distinctions refusé par l'API (403)", async () => {
    api({ ...routesClan(2), "POST /clans/updateMember": [403, { success: false, error: "Rang insuffisant." }] });
    const interaction = commande({ customId: `edit_distinctions:${PRESIDENT}:${CLAN_ID}`, valeurs: ["Staff"] });
    await gestion.choisirDistinctions(interaction as never);
    expect(interaction.texte()).toContain("Rang insuffisant.");
  });

  test("return_to_member_menu revient à la fiche du membre", async () => {
    api(routesClan(3));
    const interaction = commande({ customId: `return_to_member_menu:${MEMBRE}:${CLAN_ID}` });
    await gestion.retourMembre(interaction as never);
    expect(interaction.texte()).toContain(`clan_manage:kick:${MEMBRE}`);
  });
});
