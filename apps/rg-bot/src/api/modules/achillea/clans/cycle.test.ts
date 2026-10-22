/**
 * Cycle de vie des clans : règles pures et garde d'authentification des routes.
 * Aucun appel n'atteint Postgres : les refus 401 précèdent toute lecture.
 */
import { describe, expect, test } from "bun:test";
import { ClanMemberRole, ClanState, ProposalStatus, ProposalType, VoteChoice } from "@rosegriffon/achillea-core/enums";

import { achilleaModule } from "../index";
import { clanCycleController } from "./cycle";
import {
  actionVote,
  issueEchue,
  issueProposition,
  propositionsAExpirer,
  peutDissoudre,
  referenceClan,
  refusDepart,
  refusTransfert,
  rejointLaFondation,
  roleCapitaine,
} from "./cycle-service";
import { CLAN_FOUNDERS_COUNT, FOUNDING_VOTE_DURATION_MS, FOUNDING_VOTE_MIN_PARTICIPATION } from "./management";

describe("règles du cycle de vie", () => {
  test("le Président ne quitte pas son clan, les autres si", () => {
    expect(refusDepart(ClanMemberRole.Captain)).toContain("Président");
    expect(refusDepart(ClanMemberRole.SubCaptain)).toBeNull();
    expect(refusDepart(ClanMemberRole.Trial)).toBeNull();
  });

  test("dissolution : Président du clan ou administrateur Achilléa", () => {
    expect(peutDissoudre(ClanMemberRole.Captain, 0)).toBe(true);
    expect(peutDissoudre(ClanMemberRole.SubCaptain, 0)).toBe(false);
    expect(peutDissoudre(null, 2)).toBe(true);
    expect(peutDissoudre(null, 1)).toBe(false);
  });

  test("transfert : Président, cible du même clan, jamais soi-même", () => {
    const president = { userId: "1", role: ClanMemberRole.Captain };
    expect(refusTransfert(null, null, null)).toContain("pas partie d'un Clan");
    expect(refusTransfert({ userId: "1", role: ClanMemberRole.SubCaptain }, { userId: "2", clanId: 7 }, 7)).toContain("Seul le Président");
    expect(refusTransfert(president, null, 7)).toContain("ne fait pas partie de votre Clan");
    expect(refusTransfert(president, { userId: "1", clanId: 7 }, 7)).toContain("vous choisir");
    expect(refusTransfert(president, { userId: "2", clanId: 8 }, 7)).toContain("ne fait pas partie");
    expect(refusTransfert(president, { userId: "2", clanId: 7 }, 7)).toBeNull();
  });

  test("vote : bascule, retrait, et fondation non révisable", () => {
    expect(actionVote(ProposalType.CLAN_APPROVAL, null, VoteChoice.APPROVE)).toBe("inserer");
    expect(actionVote(ProposalType.CLAN_APPROVAL, VoteChoice.APPROVE, VoteChoice.APPROVE)).toBe("retirer");
    expect(actionVote(ProposalType.CLAN_APPROVAL, VoteChoice.APPROVE, VoteChoice.REJECT)).toBe("modifier");
    expect(actionVote(ProposalType.CLAN_CREATION, VoteChoice.APPROVE, VoteChoice.REJECT)).toBe("deja_vote");
  });

  test("issue d'une fondation à la majorité (4 fondateurs)", () => {
    const base = { eligibles: 4, ratioParticipation: 1, strategie: "MAJORITY", expireLe: null };
    expect(issueProposition({ ...base, approbations: 2, rejets: 0 })).toBeNull();
    expect(issueProposition({ ...base, approbations: 3, rejets: 0 })).toBe(ProposalStatus.APPROVED);
    expect(issueProposition({ ...base, approbations: 1, rejets: 3 })).toBe(ProposalStatus.REJECTED);
    const hier = new Date(Date.now() - 1000);
    expect(issueProposition({ ...base, approbations: 1, rejets: 0, expireLe: hier })).toBe(ProposalStatus.EXPIRED);
    expect(issueProposition({ ...base, approbations: 3, rejets: 0, strategie: "INCONNUE" })).toBe(ProposalStatus.APPROVED);
  });

  test("référence de clan : identifiant ou sigle normalisé", () => {
    expect(referenceClan("42")).toEqual({ id: 42 });
    expect(referenceClan(" psg ")).toEqual({ sigle: "PSG" });
  });

  test("rôle de Président surchargeable par l'environnement", () => {
    expect(roleCapitaine({})).toBe("1398801292079403121");
    expect(roleCapitaine({ ACHILLEA_CAPTAIN_ROLE_ID: "123" })).toBe("123");
  });
});

describe("clôture des votes échus", () => {
  const maintenant = new Date("2026-10-22T12:00:00Z");
  const passe = new Date("2026-10-22T11:00:00Z");
  const futur = new Date("2026-10-22T13:00:00Z");

  test("sélection : PENDING échus, sauf la validation d'interclan", () => {
    const propositions = [
      { id: 1, type: ProposalType.CLAN_CREATION, status: ProposalStatus.PENDING, expiresAt: passe },
      { id: 2, type: ProposalType.CLAN_CREATION, status: ProposalStatus.PENDING, expiresAt: futur },
      { id: 3, type: ProposalType.INTERCLAN_VALIDATION, status: ProposalStatus.PENDING, expiresAt: passe },
      { id: 4, type: ProposalType.CLAN_APPROVAL, status: ProposalStatus.APPROVED, expiresAt: passe },
      { id: 5, type: ProposalType.RANKED_RECLAMATION, status: ProposalStatus.PENDING, expiresAt: maintenant },
      { id: 6, type: ProposalType.TOURNAMENT_APPEAL, status: ProposalStatus.PENDING, expiresAt: null },
    ];
    expect(propositionsAExpirer(propositions, maintenant).map(p => p.id)).toEqual([1, 5]);
  });

  test("issue échue : même règle qu'au clic, « expirée » si rien ne tranche", () => {
    const base = { eligibles: 4, ratioParticipation: 1, strategie: "MAJORITY", expireLe: passe, maintenant };
    // Quorum non atteint à l'échéance : expirée, même avec une majorité de « pour ».
    expect(issueEchue({ ...base, approbations: 1, rejets: 0 })).toBe(ProposalStatus.EXPIRED);
    expect(issueEchue({ ...base, approbations: 3, rejets: 0 })).toBe(ProposalStatus.EXPIRED);
    expect(issueEchue({ ...base, approbations: 3, rejets: 1 })).toBe(ProposalStatus.APPROVED);
    expect(issueEchue({ ...base, approbations: 0, rejets: 4 })).toBe(ProposalStatus.REJECTED);
    expect(issueEchue({ ...base, approbations: 2, rejets: 2 })).toBe(ProposalStatus.REJECTED);
  });

  test("route interne : 401 sans jeton ou avec un mauvais jeton", async () => {
    const precedent = process.env.API_ADMIN_TOKEN;
    process.env.API_ADMIN_TOKEN = "jeton-interne-de-test";
    try {
      const variantes: Array<Record<string, string>> = [{}, { authorization: "Bearer mauvais" }];
      for (const entetes of variantes) {
        const reponse = await clanCycleController.handle(
          new Request("http://localhost/clans/internal/votes/expire", {
            method: "POST",
            headers: { "content-type": "application/json", ...entetes },
            body: JSON.stringify({}),
          }),
        );
        expect(reponse.status).toBe(401);
        expect(await reponse.json()).toEqual({ message: "Internal authentication required" });
      }
    } finally {
      if (precedent === undefined) delete process.env.API_ADMIN_TOKEN;
      else process.env.API_ADMIN_TOKEN = precedent;
    }
  });

  test("route interne : horodatage invalide → 400, et pas masquée dans le module Achilléa", async () => {
    const precedent = process.env.API_ADMIN_TOKEN;
    process.env.API_ADMIN_TOKEN = "jeton-interne-de-test";
    try {
      const reponse = await achilleaModule.handle(
        new Request("http://localhost/achillea/clans/internal/votes/expire", {
          method: "POST",
          headers: { "content-type": "application/json", authorization: "Bearer jeton-interne-de-test" },
          body: JSON.stringify({ now: "pas une date" }),
        }),
      );
      expect(reponse.status).toBe(400);
      expect(await reponse.json()).toEqual({ message: "Invalid expiration timestamp" });
      const sansJeton = await achilleaModule.handle(
        new Request("http://localhost/achillea/clans/internal/votes/expire", { method: "POST" }),
      );
      expect(sansJeton.status).toBe(401);
    } finally {
      if (precedent === undefined) delete process.env.API_ADMIN_TOKEN;
      else process.env.API_ADMIN_TOKEN = precedent;
    }
  });
});

describe("routes : session obligatoire pour toute écriture", () => {
  const ecritures: Array<[string, unknown]> = [
    ["/clans/leave", {}],
    ["/clans/7/disband", {}],
    ["/clans/transfer-ownership", { userId: "123456789012345678" }],
    ["/clans/invites/accept", { id: 3 }],
    ["/clans/invites/decline", { id: 3 }],
    ["/clans/votes/9", { approve: true }],
  ];

  for (const [chemin, corps] of ecritures) {
    test(`POST ${chemin} sans session → 401`, async () => {
      const reponse = await clanCycleController.handle(
        new Request(`http://localhost${chemin}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(corps),
        }),
      );
      expect(reponse.status).toBe(401);
      expect(await reponse.json()).toEqual({ success: false, error: "Non authentifié." });
    });
  }

  test("monté dans le module Achilléa, aucune autre route ne capte ces chemins", async () => {
    for (const [chemin, corps] of ecritures) {
      const reponse = await achilleaModule.handle(
        new Request(`http://localhost/achillea${chemin}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(corps),
        }),
      );
      expect(`${chemin} → ${reponse.status} ${JSON.stringify(await reponse.json())}`).toBe(
        `${chemin} → 401 ${JSON.stringify({ success: false, error: "Non authentifié." })}`,
      );
    }
  });

  test("un vote exige un booléen", async () => {
    const reponse = await clanCycleController.handle(
      new Request("http://localhost/clans/votes/9", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ approve: "oui" }),
      }),
    );
    expect(reponse.status).toBe(422);
  });
});

/**
 * Vote de fondation confronté au legacy (`create-clan.ts` / `ClanService.initFoundingVoteProcedure`,
 * `VoteButtons`, `VotingService.evaluateProposal`, `ClanFoundationVoteHandler`) :
 * Président + 4 fondateurs, seuls les 4 fondateurs votent, stratégie MAJORITY,
 * participation 1.0, 24 h, un seul clic par fondateur.
 */
describe("vote de fondation — règle du legacy", () => {
  /** Oracle recopié de la branche MAJORITY du legacy (`VotingService.evaluateProposal`). */
  function oracleLegacy(approvals: number, rejections: number, totalEligible: number, expired: boolean): ProposalStatus | null {
    const votesCount = approvals + rejections;
    const requiredParticipation = Math.ceil(totalEligible * 1.0);
    const remainingPossibleVotes = totalEligible - votesCount;
    if (expired && votesCount < requiredParticipation) return ProposalStatus.EXPIRED;
    if (approvals > rejections + remainingPossibleVotes) return ProposalStatus.APPROVED;
    if (rejections >= approvals + remainingPossibleVotes) return ProposalStatus.REJECTED;
    if (votesCount >= requiredParticipation) return approvals > rejections ? ProposalStatus.APPROVED : ProposalStatus.REJECTED;
    return null;
  }

  test("électorat : 5 fondateurs dont le Président, 4 votants, participation totale exigée", () => {
    expect(CLAN_FOUNDERS_COUNT).toBe(5);
    expect(FOUNDING_VOTE_MIN_PARTICIPATION).toBe(1);
    expect(FOUNDING_VOTE_DURATION_MS).toBe(24 * 60 * 60 * 1000);
  });

  test("toutes les combinaisons de 4 votants, échues ou non, rendent l'issue du legacy", () => {
    const passe = new Date(Date.now() - 1000);
    for (let approbations = 0; approbations <= 4; approbations++)
      for (let rejets = 0; approbations + rejets <= 4; rejets++)
        for (const expire of [false, true]) {
          const port = issueProposition({
            approbations,
            rejets,
            eligibles: CLAN_FOUNDERS_COUNT - 1,
            ratioParticipation: FOUNDING_VOTE_MIN_PARTICIPATION,
            strategie: "MAJORITY",
            expireLe: expire ? passe : null,
          });
          expect({ approbations, rejets, expire, issue: port }).toEqual({
            approbations,
            rejets,
            expire,
            issue: oracleLegacy(approbations, rejets, 4, expire),
          });
        }
  });

  test("cas limites : décision anticipée, égalité, quorum à l'échéance", () => {
    const base = { eligibles: 4, ratioParticipation: 1, strategie: "MAJORITY", expireLe: null };
    // Trois « pour » sur quatre : approuvé sans attendre le dernier fondateur.
    expect(issueProposition({ ...base, approbations: 3, rejets: 0 })).toBe(ProposalStatus.APPROVED);
    // Deux « contre » suffisent : la majorité stricte n'est plus atteignable.
    expect(issueProposition({ ...base, approbations: 0, rejets: 2 })).toBe(ProposalStatus.REJECTED);
    expect(issueProposition({ ...base, approbations: 1, rejets: 2 })).toBe(ProposalStatus.REJECTED);
    // Égalité 2-2 : rejet (la majorité doit être stricte).
    expect(issueProposition({ ...base, approbations: 2, rejets: 2 })).toBe(ProposalStatus.REJECTED);
    // 2-1 : encore indécis, le dernier fondateur tranche.
    expect(issueProposition({ ...base, approbations: 2, rejets: 1 })).toBeNull();
    // À l'échéance sans les quatre voix et sans décision : expirée, le clan est supprimé.
    const passe = new Date(Date.now() - 1000);
    expect(issueEchue({ ...base, approbations: 2, rejets: 1, expireLe: passe, maintenant: new Date() })).toBe(ProposalStatus.EXPIRED);
  });

  test("départ pendant le vote : refusé tant que le clan n'est pas approuvé (garde `ClanEnabled`)", () => {
    expect(refusDepart(ClanMemberRole.Member, ClanState.Creating)).toContain("pas encore approuvé");
    expect(refusDepart(ClanMemberRole.Member, ClanState.PendingReview)).toContain("pas encore approuvé");
    // Le legacy vérifiait l'état avant le rôle.
    expect(refusDepart(ClanMemberRole.Captain, ClanState.Creating)).toContain("pas encore approuvé");
    expect(refusDepart(ClanMemberRole.Member, ClanState.Approved)).toBeNull();
  });

  test("adhésion par le vote : « pour » d'un fondateur éligible, avant l'échéance, jamais forcé", () => {
    const base = { type: ProposalType.CLAN_CREATION, choix: VoteChoice.APPROVE, eligible: true, expire: false, force: false };
    expect(rejointLaFondation(base)).toBe(true);
    expect(rejointLaFondation({ ...base, choix: VoteChoice.REJECT })).toBe(false);
    expect(rejointLaFondation({ ...base, eligible: false })).toBe(false);
    expect(rejointLaFondation({ ...base, expire: true })).toBe(false);
    expect(rejointLaFondation({ ...base, force: true })).toBe(false);
    expect(rejointLaFondation({ ...base, type: ProposalType.CLAN_APPROVAL })).toBe(false);
  });
});
