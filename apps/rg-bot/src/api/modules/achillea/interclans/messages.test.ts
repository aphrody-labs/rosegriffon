import { describe, expect, test } from "bun:test";

import { ficheInterclan, matchsEnCours } from "../../../../../test/interclan-fixture";
import {
  boutonsAccepterRefuser,
  boutonsCompositions,
  boutonsLancement,
  boutonsMatchs,
  fenetreComposition,
  fenetreScore,
  messageDefi,
  messagePourEtat,
  messageVote,
} from "./messages";
import { ETAT } from "./regles";

type Rangee = { components: Array<{ custom_id: string; disabled?: boolean; emoji?: { id?: string } }> };
const ids = (r: unknown) => (r as Rangee).components.map(c => c.custom_id);

describe("custom_id du legacy, à l'octet près", () => {
  test("défi et confirmation", () => {
    expect(ids(boutonsAccepterRefuser("interclan_approval", 42))).toEqual(["interclan_approval:42:1", "interclan_approval:42:0"]);
    expect(ids(boutonsAccepterRefuser("cancel_interclan_confirmation", 42))).toEqual([
      "cancel_interclan_confirmation:42:1",
      "cancel_interclan_confirmation:42:0",
    ]);
  });

  test("compositions : verrou désactivé tant que la lineup est incomplète", () => {
    const rangee = boutonsCompositions(ficheInterclan()) as unknown as Rangee;
    expect(ids(rangee)).toEqual([
      "interclan_lineup:42:0",
      "lock_interclan_lineup:42:0",
      "interclan_lineup:42:1",
      "lock_interclan_lineup:42:1",
      "cancel_interclan:42",
    ]);
    expect(rangee.components[1]?.disabled).toBeUndefined();
    expect(rangee.components[3]?.disabled).toBe(true);
    // Émoji seulement si le clan en a un : un émoji sans identifiant fait refuser le message.
    expect(rangee.components[0]?.emoji?.id).toBe("1300000000000000001");
    expect(rangee.components[2]?.emoji).toBeUndefined();
  });

  test("lancement, matchs, vote", () => {
    expect(ids(boutonsLancement(ficheInterclan()))).toEqual(["start_interclan:42", "cancel_interclan:42"]);
    const matchs = boutonsMatchs(ficheInterclan({ matches: matchsEnCours() })) as unknown as Rangee;
    expect(ids(matchs)).toEqual([100, 101, 102, 103, 104].map(l => `interclan_match:42:${l}`));
    expect(matchs.components[0]?.disabled).toBe(true);
    const vote = messageVote(
      ficheInterclan({
        state: ETAT.TERMINE,
        validation: { proposalId: 5, status: "PENDING", expiresAt: "2026-10-26T00:00:00Z", closedAt: null, approvals: 1, rejections: 0, eligible: 10, minParticipationRatio: 1 },
      }),
    );
    expect(ids(vote.components?.[0])).toEqual(["vote:approve:5", "vote:reject:5"]);
  });

  test("fenêtres : composition pré-remplie et score", () => {
    const fenetre = fenetreComposition(ficheInterclan(), 0) as { custom_id: string; components: Array<{ components: Array<{ custom_id: string; value?: string }> }> };
    expect(fenetre.custom_id).toBe("lineup_manager_modal:7:42");
    expect(fenetre.components.map(r => r.components[0]?.custom_id)).toEqual([1, 2, 3, 4, 5].map(i => `lineup_member_${i}`));
    expect(fenetre.components[0]?.components[0]?.value).toBe("110000000000000000");
    const score = fenetreScore(matchsEnCours()[1]!) as { custom_id: string; components: Array<{ components: Array<{ custom_id: string }> }> };
    expect(score.custom_id).toBe("interclan_match_result_modal:101");
    expect(score.components.map(r => r.components[0]?.custom_id)).toEqual(["score_a", "score_b"]);
    expect(fenetreScore({ id: 1, state: "Fresh", players: [] })).toBeNull();
  });
});

describe("messages", () => {
  test("le défi mentionne les dirigeants du clan défié et le challenger", () => {
    const m = messageDefi(ficheInterclan({ state: ETAT.EN_ATTENTE }), "111111111111111111", ["222222222222222222"]);
    expect(m.content).toContain("<@222222222222222222>");
    expect(m.content).toContain("<@111111111111111111> du clan Aigles Rouges vous défie");
    expect(ids(m.components?.[0])).toEqual(["interclan_approval:42:1", "interclan_approval:42:0"]);
  });

  test("la vue suit l'état", () => {
    const etat = (state: number, extra = {}) => messagePourEtat(ficheInterclan({ state, ...extra }));
    expect(ids(etat(ETAT.EN_ATTENTE).components?.[0])[0]).toBe("interclan_approval:42:1");
    expect(ids(etat(ETAT.ACCEPTE).components?.[0])[0]).toBe("interclan_lineup:42:0");
    expect(ids(etat(ETAT.PRET).components?.[0])[0]).toBe("start_interclan:42");
    expect(ids(etat(ETAT.EN_COURS, { matches: matchsEnCours() }).components?.[0])[0]).toBe("interclan_match:42:100");
    expect(etat(ETAT.ANNULE).components).toEqual([]);
    expect(JSON.stringify(etat(ETAT.RESULTAT_VALIDE, { matches: matchsEnCours() }).embeds)).toContain("Bilan");
  });
});
