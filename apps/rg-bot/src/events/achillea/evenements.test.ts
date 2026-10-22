/**
 * Évènements du profil Achilléa : relevé des guildes et alerte du vocal d'aide ranked.
 */
import { afterEach, describe, expect, test } from "bun:test";

import {
  doitAlerter,
  estEntreeDansAide,
  EvenementAideRanked,
  messageAlerte,
  oublierAlertes,
  salonsAideRanked,
  SALON_TO_DEFAUT,
  VOCAL_AIDE_RANKED_DEFAUT,
} from "./aide-ranked";
import { EvenementsServeursAchillea, planificateurReleve, PlanificateurReleve } from "./serveurs";

afterEach(() => {
  planificateurReleve.annuler();
  oublierAlertes();
});

describe("relevé des guildes", () => {
  test("des évènements rapprochés ne déclenchent qu'un relevé", async () => {
    let appels = 0;
    const planificateur = new PlanificateurReleve(async () => {
      appels += 1;
      return { success: true };
    }, 20);
    planificateur.demander("arrivée sur A");
    planificateur.demander("arrivée sur B");
    planificateur.demander("départ de C");
    expect(planificateur.enAttente).toBe(true);
    await Bun.sleep(60);
    expect(appels).toBe(1);
    expect(planificateur.enAttente).toBe(false);
  });

  test("un échec ou une exception du relevé ne lève jamais", async () => {
    const enEchec = new PlanificateurReleve(async () => ({ success: false, error: "bail pris" }), 1);
    await enEchec.executer();
    const quiLeve = new PlanificateurReleve(async () => {
      throw new Error("boum");
    }, 1);
    await quiLeve.executer();
    expect(true).toBe(true);
  });

  test("guildCreate et guildDelete programment le relevé", () => {
    const evenements = new EvenementsServeursAchillea();
    evenements.arrivee([{ id: "1", name: "Nouveau" }] as never);
    expect(planificateurReleve.enAttente).toBe(true);
    planificateurReleve.annuler();
    evenements.depart([{ id: "1" }] as never);
    expect(planificateurReleve.enAttente).toBe(true);
  });
});

describe("vocal d'aide ranked", () => {
  test("salons : environnement, sinon valeurs legacy", () => {
    expect(salonsAideRanked({})).toEqual({ vocal: VOCAL_AIDE_RANKED_DEFAUT, to: SALON_TO_DEFAUT });
    expect(salonsAideRanked({ ACHILLEA_HELP_RANKED_VOICE_ID: "123456789012345678", ACHILLEA_TO_CHANNEL_ID: "x" })).toEqual({
      vocal: "123456789012345678",
      to: SALON_TO_DEFAUT,
    });
  });

  test("seule une entrée dans le vocal compte", () => {
    expect(estEntreeDansAide(null, "v", "v")).toBe(true);
    expect(estEntreeDansAide("autre", "v", "v")).toBe(true);
    expect(estEntreeDansAide("v", "v", "v")).toBe(false);
    expect(estEntreeDansAide("v", null, "v")).toBe(false);
  });

  test("anti-rafale par joueur", () => {
    expect(doitAlerter("1", 0)).toBe(true);
    expect(doitAlerter("1", 1_000)).toBe(false);
    expect(doitAlerter("2", 1_000)).toBe(true);
    expect(doitAlerter("1", 10 * 60 * 1000)).toBe(true);
  });

  function etat(channelId: string | null, envoyes: unknown[], bot = false) {
    return {
      id: "555555555555555555",
      channelId,
      member: { user: { bot } },
      client: {
        channels: {
          fetch: async () => ({ isSendable: () => true, send: async (m: unknown) => envoyes.push(m) }),
        },
      },
    };
  }

  test("entrée d'un joueur : alerte dans le salon des TO, mention du seul joueur", async () => {
    const envoyes: unknown[] = [];
    await new EvenementAideRanked().etatVocal([etat(null, envoyes), etat(VOCAL_AIDE_RANKED_DEFAUT, envoyes)] as never);
    expect(envoyes).toEqual([
      { content: messageAlerte("555555555555555555"), allowedMentions: { users: ["555555555555555555"] } },
    ]);
  });

  test("bot, départ ou salon introuvable : aucune alerte", async () => {
    const envoyes: unknown[] = [];
    await new EvenementAideRanked().etatVocal([etat(null, envoyes), etat(VOCAL_AIDE_RANKED_DEFAUT, envoyes, true)] as never);
    await new EvenementAideRanked().etatVocal([etat(VOCAL_AIDE_RANKED_DEFAUT, envoyes), etat(null, envoyes)] as never);
    const sansSalon = { ...etat(VOCAL_AIDE_RANKED_DEFAUT, envoyes), client: { channels: { fetch: async () => null } } };
    await new EvenementAideRanked().etatVocal([etat(null, envoyes), sansSalon] as never);
    expect(envoyes).toEqual([]);
  });
});
