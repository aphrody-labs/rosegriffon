import { describe, expect, test } from "bun:test";

import { carriereFactice, ficheFactice } from "../../test/achillea-clans-fixtures";
import {
  boutonsCreationCandidature,
  distinctionsDepuis,
  embedCarriere,
  embedFicheClan,
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

describe("fiche et carrière", () => {
  test("clan actif : président, effectif, membres par rôle", () => {
    const texte = JSON.stringify(embedFicheClan(ficheFactice() as never).toJSON());
    expect(texte).toContain("[PSG] Paris Griffon");
    expect(texte).toContain("Président");
    expect(texte).toContain("1 membre");
  });

  test("clan dissous : fiche réduite", () => {
    const texte = JSON.stringify(embedFicheClan(ficheFactice({ isDisbanded: true }) as never).toJSON());
    expect(texte).toContain("dissous");
    expect(texte).not.toContain("Effectif");
  });

  test("carrière : clans passés puis actuel, « - » pour le départ en cours", () => {
    const carriere = {
      ...carriereFactice(1),
      past: [
        { clanId: 7, clanName: "Ancien", shortName: "ANC", emojiId: "123", role: 1, joinedAt: "2025-07-01T00:00:00.000Z", leftAt: "2025-12-01T00:00:00.000Z", leaveReason: 3 },
      ],
    };
    const texte = JSON.stringify(embedCarriere(carriere as never).toJSON());
    expect(texte).toContain("<:ANC:123> Ancien");
    expect(texte.indexOf("Ancien")).toBeLessThan(texte.indexOf("Paris Griffon"));
    expect(texte).toContain("\\n-");
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
