/**
 * Vues de `/clan manage` et `/clan teams` : identifiants, règles d'activation,
 * modales — sans Discord ni réseau.
 */
import { describe, expect, test } from "bun:test";
import { ClanMemberDistinction } from "@rosegriffon/achillea-core/enums";
import type { ClanMemberDTO } from "@rosegriffon/achillea-types/domain/clan";
import type { ClanTeam } from "@rosegriffon/achillea-client";

import {
  bornerPageMembres,
  decoderIdGestion,
  distinctionsDepuisValeurs,
  idChampEffectif,
  idGestion,
  logoAccepte,
  modaleEffectif,
  modaleParametresEquipe,
  patchBascule,
  rangeeGestionEquipe,
  rangeeGestionMembre,
  rangeeMenuEquipes,
  rangeePaginationGestion,
  selecteurDistinctions,
  trierMembres,
  typeDepuisNumero,
} from "./achillea-clan-vues";

function membre(id: string, role: number, depuis = "2026-01-01"): ClanMemberDTO {
  return {
    clanRole: role,
    distinctions: [ClanMemberDistinction.Player],
    clanFameContributed: 0,
    createdAt: new Date(depuis),
    updatedAt: new Date(depuis),
    user: { id, username: `joueur-${id}` },
  } as ClanMemberDTO;
}

const equipe: ClanTeam = {
  id: 7,
  clanId: 42,
  name: "Equipe principale",
  type: 0,
  captainUserId: "1001",
  updatedAt: new Date("2026-10-01"),
  members: [
    { linkId: 1, userId: "1001", displayName: "Akira", avatar: null, role: 0 },
    { linkId: 2, userId: "1002", displayName: "Kazemaru", avatar: null, role: 0 },
    { linkId: 3, userId: "1003", displayName: "Coach", avatar: null, role: 2 },
  ],
  valid: false,
  errors: ["Il faut au moins 3 joueurs."],
};

const ids = (rangee: { toJSON(): { components: Array<{ custom_id?: string; disabled?: boolean }> } }) =>
  rangee.toJSON().components.map(c => `${c.custom_id}${c.disabled ? " (grisé)" : ""}`);

describe("identifiants", () => {
  test("clan_manage aller-retour", () => {
    expect(idGestion("role", "123", 2)).toBe("clan_manage:role:123:2");
    expect(decoderIdGestion("clan_manage:role:123:2")).toEqual({ action: "role", args: ["123", "2"] });
    expect(decoderIdGestion("team_edit_btn:0:1")).toBeNull();
  });

  test("identifiants legacy des équipes conservés", () => {
    expect(ids(rangeeMenuEquipes(42))).toEqual(["team_manager_btn:42:1", "team_manager_btn:42:2"]);
    expect(ids(rangeeGestionEquipe(equipe))).toEqual([
      "team_edit_btn:0:0",
      "team_edit_btn:0:1",
      "team_edit_btn:0:2",
      "team_settings_btn:7",
      "return_teams_menu",
    ]);
    expect(typeDepuisNumero("1")).toBe(0);
    expect(typeDepuisNumero("2")).toBe(1);
    expect(typeDepuisNumero("3")).toBeNull();
  });

  test("pagination : identifiants uniques dans la rangée", () => {
    const rangee = ids(rangeePaginationGestion("members", 1, 1));
    expect(new Set(rangee).size).toBe(rangee.length);
    expect(bornerPageMembres(9, 20)).toBe(2);
    expect(bornerPageMembres(0, 20)).toBe(1);
  });
});

describe("gestion d'un membre", () => {
  test("règles d'activation de l'ancien bot, vues par le Président", () => {
    const rangee = ids(rangeeGestionMembre(membre("5", 0), 3, 42));
    expect(rangee).toEqual([
      "clan_manage:role:5:1",
      "clan_manage:role:5:2",
      "editDistinctions:5:42",
      "clan_manage:kick:5",
      "clan_manage:members:1:back",
    ]);
  });

  test("un Vice-Président ne peut ni rétrograder ni expulser un autre Vice-Président", () => {
    const rangee = ids(rangeeGestionMembre(membre("6", 2), 2, 42));
    expect(rangee[0]).toBe("clan_manage:role:6:1 (grisé)");
    expect(rangee[3]).toBe("clan_manage:kick:6 (grisé)");
  });

  test("menu des distinctions : identifiant legacy, valeurs = clés de l'enum", () => {
    const json = selecteurDistinctions(membre("5", 1), 42).toJSON().components[0] as unknown as {
      custom_id: string;
      options: Array<{ value: string; default?: boolean }>;
    };
    expect(json.custom_id).toBe("edit_distinctions:5:42");
    expect(json.options.find(o => o.value === "Player")?.default).toBe(true);
    expect(distinctionsDepuisValeurs(["Player", "Staff", "Inconnue", "Artiste"])).toEqual([
      ClanMemberDistinction.Player,
      ClanMemberDistinction.Staff,
      ClanMemberDistinction.Artist,
    ]);
  });

  test("tri : rôle décroissant puis arrivée la plus récente", () => {
    const tries = trierMembres([membre("a", 1, "2026-01-01"), membre("b", 3), membre("c", 1, "2026-05-01")]);
    expect(tries.map(m => m.user.id)).toEqual(["b", "c", "a"]);
  });
});

describe("paramètres", () => {
  const clan = { isRecruiting: true, autoAcceptMembers: false, isHidden: false };
  test("chaque bascule inverse SON champ", () => {
    expect(patchBascule("recruiting", clan)).toEqual({ isRecruiting: false });
    expect(patchBascule("auto", clan)).toEqual({ autoAcceptMembers: true });
    expect(patchBascule("hidden", clan)).toEqual({ isHidden: true });
    expect(patchBascule("autre", clan)).toBeNull();
  });

  test("logo : png, jpg et jpeg seulement", () => {
    expect([logoAccepte("image/png"), logoAccepte("image/jpeg"), logoAccepte("image/gif"), logoAccepte(null)]).toEqual([
      true,
      true,
      false,
      false,
    ]);
  });
});

describe("modales d'équipe", () => {
  test("effectif : identifiants legacy des champs, valeurs pré-remplies", () => {
    const json = modaleEffectif(equipe, 0).toJSON() as unknown as {
      custom_id: string;
      components: Array<{ component: { custom_id: string; value?: string } }>;
    };
    expect(json.custom_id).toBe("team_manager_modal:7:0");
    expect(json.components).toHaveLength(5);
    expect(json.components[0]?.component.custom_id).toBe("player_1:0:42");
    expect(json.components[0]?.component.value).toBe("1001");
    expect(idChampEffectif(2, 1, equipe)).toBe("coach_1:0:42");
  });

  test("paramètres : nom et capitaine parmi les joueurs seulement", () => {
    const json = modaleParametresEquipe(equipe).toJSON() as unknown as {
      custom_id: string;
      components: Array<{ component: { custom_id: string; options?: Array<{ value: string; default?: boolean }> } }>;
    };
    expect(json.custom_id).toBe("team_settings_modal:7");
    expect(json.components[0]?.component.custom_id).toBe("team_settings_name:7");
    const options = json.components[1]?.component.options ?? [];
    expect(options.map(o => o.value)).toEqual(["1001", "1002"]);
    expect(options.find(o => o.value === "1001")?.default).toBe(true);
  });
});

describe("parité legacy du panneau /clan manage", () => {
  const user = { id: "9", username: "Fubuki", lastInteract: null };
  const membre = { clanRole: 1, distinctions: ["Joueur"], clanFameContributed: 0, createdAt: "2026-02-01T12:00:00.000Z", updatedAt: "2026-02-01T12:00:00.000Z", user };
  const clan = { id: 42, shortenedName: "RMN", name: "Raimon", clanAvatarUrl: "https://cdn.test/r.png", founders: [], clanBiography: "", membersCount: 1 };

  test("membres : titre « - Members », description et pagination Début/Précédent/Suivant/Fin + Menu", async () => {
    const vues = await import("./achillea-clan-vues");
    const e = vues.embedListeMembres(clan as never, [membre] as never, 1).toJSON();
    expect(e.color).toBe(0x206694);
    expect(e.title).toBe("[RMN] Raimon - Members");
    expect(e.description).toBe("Liste des membres du clan ordonnées par rôle et ancienneté\n\n**1 Membres** - Page 1/1");
    expect(e.fields?.map(f => f.name)).toEqual(["Membre", "Rôle", "Dernière activité"]);
    const rangee = vues.rangeePaginationGestion("members", 1, 1).toJSON() as unknown as { components: Array<{ label: string; style: number }> };
    expect(rangee.components.map(b => b.label)).toEqual(["Début", "Précédent", "Suivant", "Fin", "Menu"]);
    expect(rangee.components.every(b => b.style === 1)).toBe(true);
  });

  test("membre : « Gestion du membre », six champs, « Editer les distinctions »", async () => {
    const vues = await import("./achillea-clan-vues");
    const e = vues.embedMembre(membre as never).toJSON();
    expect(e.title).toBe("Fubuki - Gestion du membre");
    expect(e.description).toBe("__*Clan rejoint le 01/02/2026*__");
    expect(e.fields?.map(f => f.name)).toEqual(["Rôle", "Distinctions", "Dernière activité", "Contributions", "Stats Interclan", "Stats Coupes des Clans"]);
    expect(JSON.stringify(vues.rangeeGestionMembre(membre as never, 2, 42).toJSON())).toContain("Editer les distinctions");
  });

  test("invitations : liste, fiche et question de révocation de l'ancien bot", async () => {
    const vues = await import("./achillea-clan-vues");
    const invitation = { id: 5, user, inviter: membre, distinctions: [], createdAt: "2026-11-05T12:00:00.000Z", updatedAt: "2026-11-05T12:00:00.000Z", lastNotifiedAt: "2026-11-05T12:00:00.000Z" };
    const liste = vues.embedListeInvitations(clan as never, [], 1).toJSON();
    expect(liste.title).toBe("[RMN] Raimon - Invites");
    expect(liste.description).toBe("Liste des invitations émises par le clan ordonnées par ancienneté\n\n**0/100** - Page 1/1");
    expect(liste.fields?.map(f => f.value)).toEqual(["-", "-", "-"]);
    const fiche = vues.embedInvitation(invitation as never).toJSON();
    expect(fiche.title).toBe("Fubuki - Gestion de l'invitation");
    expect(fiche.fields?.map(f => `${f.name}=${f.value}`)).toEqual([
      "Dernière activité=—", "Elo=Non classé", "Tournois gagnés=0", "Participations Interclan=0", "Victoires Interclan=0", "Victoires Coupes des Clans=0",
    ]);
    expect(vues.questionRevocation(invitation as never)).toBe("Voulez-vous révoquer l'invitation envoyée à Fubuki ?");
    const confirmation = JSON.stringify(vues.rangeeConfirmationRevocation(5).toJSON());
    expect(confirmation).toContain('"label":"Confirmer"');
    expect(confirmation).toContain('"label":"Annuler"');
  });

  test("modales : biographie et réseaux de l'ancien bot", async () => {
    const vues = await import("./achillea-clan-vues");
    const bio = JSON.stringify(vues.modaleBiographie({ clanBiography: "x" }).toJSON());
    expect(bio).toContain('"title":"Change Clan Biography"');
    expect(bio).toContain('"label":"Clan biography"');
    const reseaux = JSON.stringify(vues.modaleReseaux({ xUrl: null, instagramUrl: null, tiktokUrl: null }).toJSON());
    expect(reseaux).toContain('"title":"Modifier les Réseaux du Clan"');
    expect(reseaux).toContain("https://twitter.com/youraccount");
  });
});
