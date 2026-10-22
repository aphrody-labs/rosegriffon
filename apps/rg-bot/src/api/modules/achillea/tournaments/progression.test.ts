/**
 * Propagation d'un résultat de lobby dans l'arbre : issue des séries (BO1/BO3/BO5,
 * aller-retour, forfaits), avancée du vainqueur, byes, finale, idempotence.
 * L'arbre est un vrai `BracketsManager` sur un stockage en mémoire : seule la
 * base Postgres (lobbys, événements) n'est pas exercée ici.
 */
import { describe, expect, test } from "bun:test";
import type { BracketsManager } from "brackets-manager";

import { creerArbreSimple } from "./arbre-memoire.test-kit";
import {
  appliquerResultatArbre,
  issueSerie,
  mancheValidee,
  miseAJourMatch,
  resumeSerie,
  type IssueSerie,
  type MancheSerie,
} from "./progression";
import { lobbysAOuvrir, type MatchArbre } from "./start";

const m = (score1: number, score2: number, valide = true): MancheSerie => ({ valide, score1, score2 });
const aucun = { equipe1: false, equipe2: false };
type Decide = Extract<IssueSerie, { statut: "decide" }>;
const gagne = (gagnant: 1 | 2, forfait = false): Decide => ({
  statut: "decide",
  gagnant,
  score1: gagnant === 1 ? 1 : 0,
  score2: gagnant === 2 ? 1 : 0,
  forfait,
});

describe("issue d'une série", () => {
  test("BO1 : la manche validée décide", () => {
    expect(issueSerie("bo1", [m(3, 1)], aucun)).toEqual({ statut: "decide", gagnant: 1, score1: 1, score2: 0, forfait: false });
    expect(issueSerie("bo1", [m(0, 2)], aucun)).toEqual({ statut: "decide", gagnant: 2, score1: 0, score2: 1, forfait: false });
  });

  test("BO1 : manche non validée ou format absent → attente", () => {
    expect(issueSerie("bo1", [m(3, 1, false)], aucun)).toEqual({ statut: "attente" });
    expect(issueSerie(null, [m(1, 0, false)], aucun)).toEqual({ statut: "attente" });
  });

  test("BO3 : deux manches gagnées suffisent, la troisième est ignorée", () => {
    expect(issueSerie("bo3", [m(1, 0), m(2, 1), m(0, 0, false)], aucun)).toEqual({
      statut: "decide",
      gagnant: 1,
      score1: 2,
      score2: 0,
      forfait: false,
    });
  });

  test("BO3 : 1-1 reste en attente, 2-1 décide pour l'équipe 2", () => {
    expect(issueSerie("bo3", [m(1, 0), m(0, 1), m(0, 0, false)], aucun)).toEqual({ statut: "attente" });
    expect(issueSerie("bo3", [m(1, 0), m(0, 1), m(0, 5)], aucun)).toEqual({
      statut: "decide",
      gagnant: 2,
      score1: 1,
      score2: 2,
      forfait: false,
    });
  });

  test("BO3 : une manche saisie mais non validée ne compte pas", () => {
    expect(issueSerie("bo3", [m(1, 0), m(1, 0, false), m(0, 0, false)], aucun)).toEqual({ statut: "attente" });
  });

  test("BO5 : trois manches gagnées", () => {
    expect(issueSerie("bo5", [m(1, 0), m(1, 0), m(0, 1), m(0, 0, false), m(0, 0, false)], aucun)).toEqual({ statut: "attente" });
    const issue = issueSerie("bo5", [m(1, 0), m(1, 0), m(0, 1), m(1, 0), m(0, 0, false)], aucun);
    expect(issue).toMatchObject({ statut: "decide", gagnant: 1, score1: 3, score2: 1 });
  });

  test("aller-retour : cumul des buts, les deux manches doivent être validées", () => {
    expect(issueSerie("double_leg", [m(3, 1), m(0, 1)], aucun)).toEqual({
      statut: "decide",
      gagnant: 1,
      score1: 3,
      score2: 2,
      forfait: false,
    });
    expect(issueSerie("double_leg", [m(2, 0), m(0, 0, false)], aucun)).toEqual({ statut: "attente" });
  });

  test("aller-retour à égalité → litige, pas de départage automatique", () => {
    expect(issueSerie("double_leg", [m(1, 0), m(0, 1)], aucun)).toEqual({ statut: "egalite" });
  });

  test("un forfait tranche sans attendre les manches (1-0 pour l'autre camp)", () => {
    expect(issueSerie("bo3", [m(0, 0, false), m(0, 0, false), m(0, 0, false)], { equipe1: true, equipe2: false })).toEqual({
      statut: "decide",
      gagnant: 2,
      score1: 0,
      score2: 1,
      forfait: true,
    });
    expect(issueSerie("bo1", [m(0, 0, false)], { equipe1: false, equipe2: true })).toMatchObject({ gagnant: 1, forfait: true });
  });

  test("double forfait : impasse signalée, rien n'est décidé", () => {
    expect(issueSerie("bo1", [m(0, 0, false)], { equipe1: true, equipe2: true })).toEqual({ statut: "double_forfait" });
  });

  test("manche validée : organisateur, ou les deux camps", () => {
    expect(mancheValidee({ admin_validated: true, team1validated: false, team2validated: false })).toBe(true);
    expect(mancheValidee({ admin_validated: false, team1validated: true, team2validated: true })).toBe(true);
    expect(mancheValidee({ admin_validated: false, team1validated: true, team2validated: false })).toBe(false);
  });

  test("charge utile brackets-manager (legacy propagateToManager)", () => {
    expect(miseAJourMatch({ statut: "decide", gagnant: 1, score1: 2, score2: 1, forfait: false })).toEqual({
      opponent1: { score: 2, result: "win" },
      opponent2: { score: 1 },
    });
    expect(miseAJourMatch(gagne(1, true))).toEqual({ opponent1: { score: 1 }, opponent2: { forfeit: true } });
    expect(miseAJourMatch(gagne(2, true))).toEqual({ opponent1: { forfeit: true }, opponent2: { score: 1 } });
  });

  test("résumé public d'une propagation", () => {
    expect(resumeSerie({ etat: "attente" })).toMatchObject({ etat: "attente", gagnant: null, lobbysOuverts: [], tournoiTermine: false });
    expect(
      resumeSerie({ etat: "termine", gagnant: 2, score1: 1, score2: 2, forfait: false, lobbysOuverts: [9], tournoiTermine: true, championId: "u1" }),
    ).toEqual({ etat: "termine", gagnant: 2, score1: 1, score2: 2, forfait: false, lobbysOuverts: [9], tournoiTermine: true, championId: "u1" });
  });
});

type Arbre = Awaited<ReturnType<typeof creerArbreSimple>>;

async function matchsAJouer(manager: BracketsManager, stageId: number): Promise<MatchArbre[]> {
  const matchs = (await manager.storage.select("match", { stage_id: stageId })) ?? [];
  return matchs
    .filter(x => x.status < 4)
    .map(x => ({
      id: Number(x.id),
      opponent1: x.opponent1 ? { id: x.opponent1.id ?? null } : null,
      opponent2: x.opponent2 ? { id: x.opponent2.id ?? null } : null,
    }));
}

/** Lobbys ouvrables (noms de joueurs en équipes), sans ceux déjà ouverts. */
async function lobbysOuvrables(arbre: Arbre, couverts: Set<number>) {
  const joueurs = new Map([...arbre.nomParId].map(([id, nom]) => [id, nom]));
  return lobbysAOuvrir(await matchsAJouer(arbre.manager, arbre.stageId), joueurs, couverts);
}

/** Joue tout le tournoi : l'équipe 1 gagne sauf si `choisir` dit le contraire. Rend les vagues de lobbys. */
async function jouerTout(arbre: Arbre, choisir: (a: string, b: string) => 1 | 2 = () => 1) {
  const couverts = new Set<number>();
  const vagues: Array<Array<[string, string]>> = [];
  const joues: Array<{ matchId: number; gagnant: string }> = [];
  for (let garde = 0; garde < 20; garde++) {
    const lobbys = await lobbysOuvrables(arbre, couverts);
    if (lobbys.length === 0) break;
    vagues.push(lobbys.map(l => [l.equipe1, l.equipe2]));
    for (const lobby of lobbys) {
      couverts.add(lobby.matchId);
      const gagnant = choisir(lobby.equipe1, lobby.equipe2);
      await appliquerResultatArbre(arbre.manager, arbre.tournoiId, lobby.matchId, gagne(gagnant));
      joues.push({ matchId: lobby.matchId, gagnant: gagnant === 1 ? lobby.equipe1 : lobby.equipe2 });
    }
  }
  return { vagues, joues };
}

async function champion(arbre: Arbre) {
  const classement = await arbre.manager.get.finalStandings(arbre.stageId);
  const premier = classement.find(l => l.rank === 1);
  return arbre.nomParId.get(Number(premier?.id));
}

describe("élimination simple : le vainqueur avance et le tour suivant s'ouvre", () => {
  test("4 joueurs : 2 demi-finales, puis la finale seulement quand les deux sont jouées", async () => {
    const arbre = await creerArbreSimple(["A", "B", "C", "D"], 4);
    const couverts = new Set<number>();
    const demis = await lobbysOuvrables(arbre, couverts);
    expect(demis).toHaveLength(2);
    expect(demis.map(l => [l.equipe1, l.equipe2])).toEqual([
      ["A", "D"],
      ["B", "C"],
    ]);
    for (const l of demis) couverts.add(l.matchId);

    const premiere = await appliquerResultatArbre(arbre.manager, 1, demis[0]!.matchId, gagne(1));
    expect(premiere.ecrit).toBe(true);
    expect(premiere.arbreTermine).toBe(false);
    // Un seul camp de la finale est connu : pas de lobby.
    expect(await lobbysOuvrables(arbre, couverts)).toEqual([]);

    await appliquerResultatArbre(arbre.manager, 1, demis[1]!.matchId, gagne(2));
    const finale = await lobbysOuvrables(arbre, couverts);
    expect(finale.map(l => [l.equipe1, l.equipe2])).toEqual([["A", "C"]]);
  });

  test("8 joueurs : vagues 4 → 2 → 1, 7 matchs, champion = tête de série 1", async () => {
    const arbre = await creerArbreSimple(["A", "B", "C", "D", "E", "F", "G", "H"], 8);
    const { vagues, joues } = await jouerTout(arbre);
    expect(vagues.map(v => v.length)).toEqual([4, 2, 1]);
    expect(joues).toHaveLength(7);
    expect(await champion(arbre)).toBe("A");
  });

  test("le vainqueur est celui qui gagne, pas l'équipe 1 par défaut", async () => {
    const arbre = await creerArbreSimple(["A", "B", "C", "D"], 4);
    // Toujours l'équipe 2 : D bat A, C bat B, puis la finale D-C → C (équipe 2).
    await jouerTout(arbre, () => 2);
    expect(await champion(arbre)).toBe("C");
  });

  test("finale : l'arbre n'est terminé qu'après elle, jamais avant", async () => {
    const arbre = await creerArbreSimple(["A", "B", "C", "D"], 4);
    const couverts = new Set<number>();
    const etats: boolean[] = [];
    for (let tour = 0; tour < 3; tour++) {
      const lobbys = await lobbysOuvrables(arbre, couverts);
      for (const l of lobbys) {
        couverts.add(l.matchId);
        etats.push((await appliquerResultatArbre(arbre.manager, 1, l.matchId, gagne(1))).arbreTermine);
      }
    }
    expect(etats).toEqual([false, false, true]);
    expect(await arbre.manager.get.currentStage(1)).toBeNull();
  });
});

describe("byes", () => {
  test("6 joueurs dans 8 places : les byes avancent seuls, vagues 2 → 2 → 1, jamais de lobby de bye", async () => {
    const arbre = await creerArbreSimple(["A", "B", "C", "D", "E", "F"], 8);
    const { vagues, joues } = await jouerTout(arbre);
    expect(vagues.map(v => v.length)).toEqual([2, 2, 1]);
    // n joueurs → n-1 matchs réellement joués.
    expect(joues).toHaveLength(5);
    expect(await champion(arbre)).toBe("A");
    for (const vague of vagues) for (const [a, b] of vague) expect(a && b).toBeTruthy();
  });

  test("5 joueurs dans 8 places : 3 byes, 4 matchs joués", async () => {
    const arbre = await creerArbreSimple(["A", "B", "C", "D", "E"], 8);
    const { vagues, joues } = await jouerTout(arbre);
    expect(joues).toHaveLength(4);
    expect(vagues.flat().length).toBe(4);
    expect(await champion(arbre)).toBe("A");
  });

  test("3 joueurs dans 4 places : le bye est déjà en finale, qui s'ouvre après l'autre demi", async () => {
    const arbre = await creerArbreSimple(["A", "B", "C"], 4);
    const couverts = new Set<number>();
    const premiers = await lobbysOuvrables(arbre, couverts);
    expect(premiers).toHaveLength(1);
    couverts.add(premiers[0]!.matchId);
    await appliquerResultatArbre(arbre.manager, 1, premiers[0]!.matchId, gagne(1));
    const finale = await lobbysOuvrables(arbre, couverts);
    expect(finale).toHaveLength(1);
    expect(finale[0]!.equipe1).toBe("A");
  });
});

describe("idempotence", () => {
  test("valider deux fois le même résultat n'avance pas deux fois", async () => {
    const arbre = await creerArbreSimple(["A", "B", "C", "D"], 4);
    const couverts = new Set<number>();
    const demis = await lobbysOuvrables(arbre, couverts);
    for (const l of demis) couverts.add(l.matchId);

    const premiere = await appliquerResultatArbre(arbre.manager, 1, demis[0]!.matchId, gagne(1));
    const avant = JSON.stringify(await arbre.manager.storage.select("match"));
    const rejeu = await appliquerResultatArbre(arbre.manager, 1, demis[0]!.matchId, gagne(1));
    expect(premiere.ecrit).toBe(true);
    expect(rejeu.ecrit).toBe(false);
    expect(JSON.stringify(await arbre.manager.storage.select("match"))).toBe(avant);
  });

  test("un rejeu avec un autre vainqueur ne réécrit pas l'histoire", async () => {
    const arbre = await creerArbreSimple(["A", "B", "C", "D"], 4);
    const couverts = new Set<number>();
    const demis = await lobbysOuvrables(arbre, couverts);
    for (const l of demis) couverts.add(l.matchId);
    await appliquerResultatArbre(arbre.manager, 1, demis[0]!.matchId, gagne(1));
    const rejeu = await appliquerResultatArbre(arbre.manager, 1, demis[0]!.matchId, gagne(2));
    expect(rejeu.ecrit).toBe(false);
    await appliquerResultatArbre(arbre.manager, 1, demis[1]!.matchId, gagne(1));
    expect((await lobbysOuvrables(arbre, couverts)).map(l => [l.equipe1, l.equipe2])).toEqual([["A", "B"]]);
  });

  test("les lobbys déjà ouverts ne sont jamais rouverts", async () => {
    const arbre = await creerArbreSimple(["A", "B", "C", "D"], 4);
    const couverts = new Set<number>();
    const demis = await lobbysOuvrables(arbre, couverts);
    for (const l of demis) couverts.add(l.matchId);
    await appliquerResultatArbre(arbre.manager, 1, demis[0]!.matchId, gagne(1));
    await appliquerResultatArbre(arbre.manager, 1, demis[1]!.matchId, gagne(1));
    const finale = await lobbysOuvrables(arbre, couverts);
    expect(finale).toHaveLength(1);
    couverts.add(finale[0]!.matchId);
    expect(await lobbysOuvrables(arbre, couverts)).toEqual([]);
  });
});

describe("forfait", () => {
  test("le forfait d'un joueur qualifie son adversaire, scores 1-0", async () => {
    const arbre = await creerArbreSimple(["A", "B", "C", "D"], 4);
    const couverts = new Set<number>();
    const demis = await lobbysOuvrables(arbre, couverts);
    for (const l of demis) couverts.add(l.matchId);
    // A (équipe 1) déclare forfait : D passe.
    await appliquerResultatArbre(arbre.manager, 1, demis[0]!.matchId, gagne(2, true));
    const match = await arbre.manager.storage.select("match", demis[0]!.matchId);
    expect(match?.opponent1?.forfeit).toBe(true);
    expect(match?.opponent2?.result).toBe("win");
    await appliquerResultatArbre(arbre.manager, 1, demis[1]!.matchId, gagne(1));
    expect((await lobbysOuvrables(arbre, couverts)).map(l => [l.equipe1, l.equipe2])).toEqual([["D", "B"]]);
  });
});

describe("série BO3 jusqu'à l'arbre", () => {
  test("la série n'écrit dans l'arbre qu'une fois décidée, avec le score en manches", async () => {
    const arbre = await creerArbreSimple(["A", "B", "C", "D"], 4);
    const couverts = new Set<number>();
    const demis = await lobbysOuvrables(arbre, couverts);
    for (const l of demis) couverts.add(l.matchId);

    const apres1 = issueSerie("bo3", [m(1, 0), m(0, 0, false), m(0, 0, false)], aucun);
    expect(apres1.statut).toBe("attente");
    const apres2 = issueSerie("bo3", [m(1, 0), m(0, 2), m(0, 0, false)], aucun);
    expect(apres2.statut).toBe("attente");
    const decidee = issueSerie("bo3", [m(1, 0), m(0, 2), m(3, 2)], aucun);
    if (decidee.statut !== "decide") throw new Error("série non décidée");
    await appliquerResultatArbre(arbre.manager, 1, demis[0]!.matchId, decidee);
    const match = await arbre.manager.storage.select("match", demis[0]!.matchId);
    expect(match?.opponent1).toMatchObject({ score: 2, result: "win" });
    expect(match?.opponent2).toMatchObject({ score: 1 });
  });
});

describe("tournoi terminé", () => {
  test("16 joueurs : 15 matchs, plus aucun lobby ouvrable, classement complet", async () => {
    const noms = Array.from({ length: 16 }, (_, i) => `J${i + 1}`);
    const arbre = await creerArbreSimple(noms, 16);
    const { vagues, joues } = await jouerTout(arbre);
    expect(vagues.map(v => v.length)).toEqual([8, 4, 2, 1]);
    expect(joues).toHaveLength(15);
    expect(await arbre.manager.get.currentStage(1)).toBeNull();
    expect(await lobbysOuvrables(arbre, new Set(joues.map(j => j.matchId)))).toEqual([]);
    const classement = await arbre.manager.get.finalStandings(arbre.stageId);
    expect(classement).toHaveLength(16);
    expect(await champion(arbre)).toBe("J1");
  });
});
