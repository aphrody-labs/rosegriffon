import { describe, expect, test } from "bun:test";
import { Colors } from "discord.js";

import { carriereFactice, ficheFactice } from "../../test/achillea-clans-fixtures";
import {
  boutonsCreationCandidature,
  distinctionsDepuis,
  embedCarriere,
  embedErreurLegacy,
  embedFicheClan,
  embedListeClans,
  embedRefusLegacy,
  embedSuccesLegacy,
  EMOJI_ENTREE,
  EMOJI_SORTIE,
  rangeePaginationClans,
  logoAccepte,
  reseauDe,
  selecteurDistinctions,
} from "./achillea-clan-format";

const json = (valeur: { toJSON: () => unknown }) => JSON.stringify(valeur.toJSON());

describe("distinctions", () => {
  test("clés et libellés acceptés, inconnues ignorées, sans doublon", () => {
    expect(distinctionsDepuis(["Player", "Staff", "Joueur", "Inconnue"])).toEqual(["Joueur", "Staff"] as never);
  });

  test("menus et boutons aux identifiants de l'ancien bot", () => {
    expect(json(selecteurDistinctions("apply", 42))).toContain('"custom_id":"apply_distinctions:42"');
    expect(json(selecteurDistinctions("invite", "123"))).toContain('"custom_id":"invite_distinctions:123"');
    const boutons = json(boutonsCreationCandidature(42, ["Player", "Staff"]));
    expect(boutons).toContain("create_application:42:Player|Staff");
    expect(boutons).toContain("cancel_application:42");
  });
});

describe("fiche et carrière (legacy createActiveClanInfosEmbed / createMemberHistoryEmbed)", () => {
  test("clan actif : couleur 0x206694, auteur, six champs en ligne dans l'ordre de l'ancien bot", () => {
    const e = embedFicheClan(ficheFactice() as never, { nom: "joueur", avatar: "https://cdn/a.png" }, ["222222222222222222", "3"]).toJSON();
    expect(e.color).toBe(0x206694);
    expect(e.title).toBe("[PSG] Paris Griffon\n");
    expect(e.author).toEqual({ name: "joueur", icon_url: "https://cdn/a.png" });
    expect(e.footer).toBeUndefined();
    expect(e.timestamp).toBeUndefined();
    expect(e.fields?.map(f => [f.name, f.inline])).toEqual([
      ["Président", true],
      ["Vice-Présidents", true],
      ["Fondateurs", true],
      ["Membres", true],
      ["Discord", true],
      ["Réseaux sociaux", true],
    ]);
    expect(e.fields?.[2]?.value).toBe("- <@222222222222222222>\n- <@3>\n");
    expect(e.fields?.[3]?.value).toBe("1");
    expect(e.fields?.[4]?.value).toBe("No");
    expect(e.fields?.[5]?.value).toBe("[Twitter](https://x.com/psg)\n");
  });

  test("clan dissous : rouge, « - Clan dissout », fondateurs seuls", () => {
    const e = embedFicheClan(ficheFactice({ isDisbanded: true }) as never, null, ["9"]).toJSON();
    expect(e.color).toBe(Colors.Red);
    expect(e.title).toBe("[PSG] Paris Griffon\n - Clan dissout");
    expect(e.fields).toEqual([{ name: "Fondateurs", value: "- <@9>\n", inline: true }]);
  });

  test("annuaire : « Liste des Clans », colonnes Clan / Id / Présidence et page", () => {
    const clan = { id: 42, name: "Paris Griffon", president: { id: "222222222222222222", username: "p" } };
    const e = embedListeClans([clan] as never, 1, 3, { nom: "joueur" }).toJSON();
    expect(e.title).toBe("Liste des Clans");
    expect(e.color).toBe(0x206694);
    expect(e.description).toBe("Liste des clans en activité. Sélectionnez-en un ci-dessous pour voir ses informations détaillées.");
    expect(e.fields).toEqual([
      { name: "Clan", value: "Paris Griffon", inline: true },
      { name: "Id", value: "42", inline: true },
      { name: "Présidence", value: "<@222222222222222222>", inline: true },
      { name: "Page 1/3", value: " ", inline: true },
    ]);
  });

  test("pagination : Début / Précédent / Suivant / Fin, bleus, toujours là", () => {
    const rangee = rangeePaginationClans(1, 3).toJSON() as unknown as { components: Array<Record<string, unknown>> };
    expect(rangee.components.map(b => [b.label, b.style, b.disabled, b.custom_id])).toEqual([
      ["Début", 1, true, "clan_infos_page:1:first"],
      ["Précédent", 1, true, "clan_infos_page:1:previous"],
      ["Suivant", 1, false, "clan_infos_page:2:next"],
      ["Fin", 1, false, "clan_infos_page:3:last"],
    ]);
  });

  test("carrière : clans quittés (ordre de l'API) puis actuel, flèches et JJ/MM/AAAA", () => {
    const carriere = {
      ...carriereFactice(1),
      past: [
        { clanId: 7, clanName: "Ancien", shortName: "ANC", emojiId: "123", role: 1, joinedAt: "2025-07-01T00:00:00.000Z", leftAt: "2025-12-01T00:00:00.000Z", leaveReason: 3 },
        { clanId: 8, clanName: "Premier", shortName: "PRE", emojiId: "124", role: 1, joinedAt: "2025-01-01T00:00:00.000Z", leftAt: "2025-02-01T00:00:00.000Z", leaveReason: 3 },
      ],
    };
    const e = embedCarriere(carriere as never).toJSON();
    expect(e.color).toBe(0x206694);
    expect(e.fields?.[0]?.value.split("\n").slice(0, 2)).toEqual(["<:ANC:123> Ancien", "<:PRE:124> Premier"]);
    expect(e.fields?.[1]?.value.split("\n")[0]).toBe(`${EMOJI_ENTREE} 01/07/2025`);
    expect(e.fields?.[2]?.value).toBe(`${EMOJI_SORTIE} 01/12/2025\n${EMOJI_SORTIE} 01/02/2025\n-`);
    expect(e.footer).toBeUndefined();
  });

  test("embeds simples : ✅ vert 0x57f287, ❌ Colors.Red, refus de garde 0xed4245", () => {
    expect(embedSuccesLegacy("ok").toJSON()).toEqual({ color: 0x57f287, title: "✅ ok" });
    expect(embedErreurLegacy("ko").toJSON()).toEqual({ color: Colors.Red, title: "❌ ko" });
    expect(embedRefusLegacy("non").toJSON()).toEqual({ color: 0xed4245, title: "❌ non" });
  });
});

describe("création", () => {
  test("réseaux reconnus comme côté API", () => {
    expect(reseauDe("https://twitter.com/x")).toBe("twitter");
    expect(reseauDe("https://www.instagram.com/x")).toBe("instagram");
    expect(reseauDe("https://tiktok.com/@x")).toBe("tiktok");
    expect(reseauDe("https://facebook.com/x")).toBeNull();
    expect(reseauDe("pas une url")).toBeNull();
  });

  test("logos PNG et JPEG seulement", () => {
    expect(logoAccepte("image/png")).toBe(true);
    expect(logoAccepte("image/jpeg; charset=binary")).toBe(true);
    expect(logoAccepte("image/gif")).toBe(false);
    expect(logoAccepte(null)).toBe(false);
  });
});

describe("miniature d'un clan pour Discord", () => {
  test("marqueur de clan sans logo → logo PNG d'Achilléa", async () => {
    const { miniatureClan, LOGO_ACHILLEA_PNG } = await import("./achillea-clan-format");
    expect(miniatureClan("/achillea/default-clan-avatar.svg?clan=73")).toBe(LOGO_ACHILLEA_PNG);
    expect(miniatureClan(null)).toBe(LOGO_ACHILLEA_PNG);
  });

  test("URL absolue conservée, chemin relatif résolu sur le site", async () => {
    const { miniatureClan } = await import("./achillea-clan-format");
    const stockage = "https://xzwfnxzkxtcpgmtqulbh.supabase.co/storage/v1/object/public/images/3TTlIgH3.png";
    expect(miniatureClan(stockage)).toBe(stockage);
    expect(miniatureClan("/achillea/clans/x.png")).toBe("https://rosegriffon.fr/achillea/clans/x.png");
  });
});
