import { describe, expect, test } from "bun:test";

import {
  appliquerEffet,
  avertissementsActifs,
  effetDeRevocation,
  effetDeSanction,
  escaladeApres,
  formaterDureeCourte,
  horodatage,
  libelleMode,
  lienCapture,
  lireDuree,
  signe,
  utilisateurDe,
  type Sanction,
} from "./achillea-moderation";

const warn = (champs: Partial<Sanction> = {}): Sanction =>
  ({
    id: "x",
    userId: "1",
    guildId: "2",
    type: "warn",
    reason: null,
    durationSec: null,
    issuedBy: "3",
    issuedByType: "staff",
    expiresAt: null,
    revokedAt: null,
    revokedBy: null,
    revokeReason: null,
    evidence: null,
    createdAt: new Date().toISOString(),
    ...champs,
  }) as Sanction;

describe("durées", () => {
  test("lireDuree accepte s, m, h, d (et j)", () => {
    expect(lireDuree("30s")).toBe(30);
    expect(lireDuree("15m")).toBe(900);
    expect(lireDuree("2h")).toBe(7200);
    expect(lireDuree("7d")).toBe(604_800);
    expect(lireDuree("7J")).toBe(604_800);
    expect(lireDuree("demain")).toBeNull();
    expect(lireDuree("0m")).toBeNull();
  });

  test("formaterDureeCourte arrondit à l'unité la plus grande", () => {
    expect(formaterDureeCourte(604_800)).toBe("7j");
    expect(formaterDureeCourte(7200)).toBe("2h");
    expect(formaterDureeCourte(900)).toBe("15m");
    expect(formaterDureeCourte(30)).toBe("30s");
  });

  test("horodatage Discord", () => {
    expect(horodatage("2026-01-01T00:00:00.000Z")).toBe("<t:1767225600:F>");
    expect(horodatage(null)).toBe("—");
    expect(horodatage("pas une date")).toBe("—");
  });
});

describe("escalade", () => {
  test("seuls les warns actifs de la fenêtre comptent", () => {
    const vieux = new Date(Date.now() - 40 * 86_400_000).toISOString();
    const sanctions = [
      warn(),
      warn(),
      warn({ revokedAt: new Date().toISOString() }),
      warn({ createdAt: vieux }),
      warn({ type: "mute" as Sanction["type"] }),
      warn({ expiresAt: new Date(Date.now() - 1000).toISOString() }),
    ];
    expect(avertissementsActifs(sanctions)).toBe(2);
    expect(escaladeApres(sanctions)).toBeNull();
  });

  test("3, 5, 8 warns → mute 1 h, mute 24 h, ban 7 j", () => {
    expect(escaladeApres([warn(), warn(), warn()])).toMatchObject({ type: "mute", durationSec: 3600, avertissements: 3 });
    expect(escaladeApres(Array.from({ length: 5 }, () => warn()))).toMatchObject({ type: "mute", durationSec: 86_400 });
    expect(escaladeApres(Array.from({ length: 8 }, () => warn()))).toMatchObject({ type: "ban", durationSec: 604_800 });
  });
});

describe("effets Discord", () => {
  test("par type de sanction et à la révocation", () => {
    expect(effetDeSanction({ type: "warn" as Sanction["type"], durationSec: null })).toEqual({ action: "aucun" });
    expect(effetDeSanction({ type: "mute" as Sanction["type"], durationSec: 60 })).toEqual({ action: "timeout", ms: 60_000 });
    expect(effetDeSanction({ type: "kick" as Sanction["type"], durationSec: null })).toEqual({ action: "expulser" });
    expect(effetDeSanction({ type: "ban" as Sanction["type"], durationSec: null })).toEqual({ action: "bannir" });
    expect(effetDeRevocation({ type: "mute" as Sanction["type"] })).toEqual({ action: "lever-timeout" });
    expect(effetDeRevocation({ type: "ban" as Sanction["type"] })).toEqual({ action: "debannir" });
    expect(effetDeRevocation({ type: "kick" as Sanction["type"] })).toEqual({ action: "aucun" });
  });

  test("appliquerEffet appelle la bonne méthode", async () => {
    const journal: string[] = [];
    const serveur = {
      members: {
        fetch: async (id: string) => ({
          timeout: async (ms: number | null) => void journal.push(`t:${id}:${ms}`),
          kick: async () => void journal.push(`k:${id}`),
        }),
      },
      bans: {
        create: async (id: string) => void journal.push(`b:${id}`),
        remove: async (id: string) => void journal.push(`u:${id}`),
      },
    };
    await appliquerEffet(serveur, "9", { action: "timeout", ms: 5 });
    await appliquerEffet(serveur, "9", { action: "lever-timeout" });
    await appliquerEffet(serveur, "9", { action: "expulser" });
    await appliquerEffet(serveur, "9", { action: "bannir" });
    await appliquerEffet(serveur, "9", { action: "debannir" });
    await appliquerEffet(serveur, "9", { action: "aucun" });
    expect(journal).toEqual(["t:9:5", "t:9:null", "k:9", "b:9", "u:9"]);
  });
});

describe("divers", () => {
  test("utilisateurDe déballe un GuildMember", () => {
    const user = { id: "1", username: "a" };
    expect(utilisateurDe({ user } as never)).toBe(user as never);
    expect(utilisateurDe(user as never)).toBe(user as never);
  });

  test("libellés ranked", () => {
    expect(libelleMode(2)).toBe("Standard (1v1)");
    expect(libelleMode(4)).toBe("Double (2v2)");
    expect(libelleMode(null)).toBe("—");
    expect(signe(3)).toBe("+3");
    expect(signe(-2)).toBe("-2");
    expect(lienCapture("/storage/a.png", "https://r.fr/")).toBe("[capture](https://r.fr/storage/a.png)");
    expect(lienCapture(null, "x")).toBe("pas de capture");
  });
});
