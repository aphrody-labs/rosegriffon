import { describe, expect, test } from "bun:test";

import {
  apparier,
  calculerVainqueur,
  clanEnConflit,
  decalageParis,
  defiExpire,
  dirigeLeClan,
  dirigeUnDesClans,
  estPret,
  ETAT,
  instantParis,
  lireDateDefi,
  peutLancer,
  peutVerrouiller,
  permis,
  ROLE_CLAN,
  TRANSITIONS,
  validerComposition,
  validerScore,
} from "./regles";

const H = 60 * 60 * 1000;

describe("heure de Paris", () => {
  test("+1 h l'hiver, +2 h l'été", () => {
    expect(decalageParis(Date.UTC(2026, 0, 15, 12))).toBe(H);
    expect(decalageParis(Date.UTC(2026, 6, 15, 12))).toBe(2 * H);
  });

  test("une heure murale de Paris devient le bon instant UTC", () => {
    expect(instantParis(2026, 7, 14, 21, 0)).toBe(Date.UTC(2026, 6, 14, 19, 0));
    expect(instantParis(2026, 12, 24, 21, 0)).toBe(Date.UTC(2026, 11, 24, 20, 0));
    expect(instantParis(2026, 2, 30, 21, 0)).toBeNull();
  });
});

describe("lireDateDefi", () => {
  const maintenant = Date.UTC(2026, 9, 22, 10, 0); // 22/10/2026 12:00 à Paris

  test("JJ/MM HH:MM dans la semaine", () => {
    const v = lireDateDefi("25/10 21:30", maintenant);
    expect(v.ok && v.valeur.toISOString()).toBe("2026-10-25T20:30:00.000Z"); // passage à l'heure d'hiver le 25/10
  });

  test("ISO 8601 accepté (site, CLI)", () => {
    const v = lireDateDefi("2026-10-24T18:00:00Z", maintenant);
    expect(v.ok && v.valeur.toISOString()).toBe("2026-10-24T18:00:00.000Z");
  });

  test("passé, au-delà de 7 jours, ou mal formé : refus 400", () => {
    for (const saisie of ["20/10 12:00", "30/10 21:00", "demain", "32/10 10:00"]) {
      const v = lireDateDefi(saisie, maintenant);
      expect(v.ok).toBe(false);
      if (!v.ok) expect(v.statut).toBe(400);
    }
  });

  test("fin décembre pour janvier : reporté à l'année suivante", () => {
    const fin = Date.UTC(2026, 11, 29, 12, 0);
    const v = lireDateDefi("02/01 20:00", fin);
    expect(v.ok && v.valeur.getUTCFullYear()).toBe(2027);
  });
});

describe("agenda", () => {
  const base = new Date(Date.UTC(2026, 9, 25, 18));
  test("conflit à moins de 8 h pour l'un des clans", () => {
    const existants = [{ clanA: 3, clanB: 9, date: new Date(base.getTime() + 2 * H), etat: ETAT.ACCEPTE }];
    expect(clanEnConflit(1, 3, base, existants)).toBe(3);
    expect(clanEnConflit(3, 1, base, existants)).toBe(3);
    expect(clanEnConflit(1, 2, base, existants)).toBeNull();
  });
  test("8 h d'écart ou interclan annulé : aucun conflit", () => {
    expect(clanEnConflit(1, 3, base, [{ clanA: 3, clanB: 9, date: new Date(base.getTime() + 8 * H), etat: ETAT.ACCEPTE }])).toBeNull();
    expect(clanEnConflit(1, 3, base, [{ clanA: 3, clanB: 9, date: base, etat: ETAT.ANNULE }])).toBeNull();
  });
});

describe("fenêtres", () => {
  const rencontre = new Date(Date.UTC(2026, 9, 25, 18));
  test("verrouillage dans l'heure qui précède", () => {
    expect(peutVerrouiller(rencontre, rencontre.getTime() - 30 * 60 * 1000)).toBe(true);
    expect(peutVerrouiller(rencontre, rencontre.getTime() - 2 * H)).toBe(false);
    expect(peutVerrouiller(rencontre, rencontre.getTime() + 1000)).toBe(false);
  });
  test("lancement de l'heure prévue à +4 h", () => {
    expect(peutLancer(rencontre, rencontre.getTime())).toBe(true);
    expect(peutLancer(rencontre, rencontre.getTime() + 4 * H)).toBe(true);
    expect(peutLancer(rencontre, rencontre.getTime() - 1000)).toBe(false);
    expect(peutLancer(rencontre, rencontre.getTime() + 4 * H + 1)).toBe(false);
  });
  test("défi expiré au-delà de 24 h", () => {
    const cree = new Date(0);
    expect(defiExpire(cree, 24 * H)).toBe(false);
    expect(defiExpire(cree, 24 * H + 1)).toBe(true);
  });
});

describe("compositions", () => {
  const membres = new Set(["10001", "10002", "10003", "10004", "10005", "10006"]);
  const p = (userId: string, position: number) => ({ userId, position });

  test("cinq membres du clan, triés par position", () => {
    const v = validerComposition([p("10002", 2), p("10001", 1), p("10003", 3)], membres, false);
    expect(v.ok && v.valeur.map(x => x.userId)).toEqual(["10001", "10002", "10003"]);
  });

  test("doublons, intrus, positions, verrou, excès", () => {
    expect(validerComposition([p("10001", 1), p("10001", 2)], membres, false)).toMatchObject({ ok: false, statut: 400 });
    expect(validerComposition([p("99999", 1)], membres, false)).toMatchObject({ ok: false, message: expect.stringContaining("99999") });
    expect(validerComposition([p("10001", 1), p("10002", 1)], membres, false)).toMatchObject({ ok: false });
    expect(validerComposition([p("10001", 6)], membres, false)).toMatchObject({ ok: false });
    expect(validerComposition([p("10001", 1)], membres, true)).toMatchObject({ ok: false, statut: 409 });
    const six = ["10001", "10002", "10003", "10004", "10005", "10006"].map((id, i) => p(id, i + 1));
    expect(validerComposition(six, membres, false)).toMatchObject({ ok: false });
  });

  test("prêt quand les deux sont complètes ET verrouillées", () => {
    expect(estPret([{ verrouillee: true, joueurs: 5 }, { verrouillee: true, joueurs: 5 }])).toBe(true);
    expect(estPret([{ verrouillee: true, joueurs: 5 }, { verrouillee: false, joueurs: 5 }])).toBe(false);
    expect(estPret([{ verrouillee: true, joueurs: 4 }, { verrouillee: true, joueurs: 5 }])).toBe(false);
  });

  test("appariements position contre position", () => {
    expect(apparier([p("a2", 2), p("a1", 1)], [p("b1", 1), p("b2", 2), p("b3", 3)])).toEqual([
      { joueurA: "a1", joueurB: "b1" },
      { joueurA: "a2", joueurB: "b2" },
    ]);
  });
});

describe("résultats", () => {
  test("scores entiers de 0 à 99", () => {
    expect(validerScore(3, 0).ok).toBe(true);
    expect(validerScore(-1, 0).ok).toBe(false);
    expect(validerScore(1.5, 0).ok).toBe(false);
    expect(validerScore(100, 0).ok).toBe(false);
  });

  test("vainqueur aux matchs gagnés, nul sans vainqueur", () => {
    const m = (a: number, b: number) => ({ scoreA: a, scoreB: b });
    expect(calculerVainqueur([m(3, 1), m(0, 2), m(2, 1), m(1, 1), m(4, 0)], 7, 9)).toEqual({ pointsA: 3, pointsB: 1, vainqueur: 7 });
    expect(calculerVainqueur([m(0, 1), m(0, 2)], 7, 9).vainqueur).toBe(9);
    expect(calculerVainqueur([m(1, 0), m(0, 1), m(2, 2)], 7, 9)).toEqual({ pointsA: 1, pointsB: 1, vainqueur: null });
  });
});

describe("machine d'états", () => {
  test("chaque action n'est permise que depuis ses états", () => {
    expect(permis("repondre", ETAT.EN_ATTENTE).ok).toBe(true);
    expect(permis("repondre", ETAT.ACCEPTE)).toMatchObject({ ok: false, statut: 409 });
    expect(permis("composer", ETAT.ACCEPTE).ok).toBe(true);
    expect(permis("composer", ETAT.PRET).ok).toBe(false);
    expect(permis("annuler", ETAT.PRET).ok).toBe(true);
    expect(permis("annuler", ETAT.EN_COURS).ok).toBe(false);
    expect(permis("lancer", ETAT.PRET).ok).toBe(true);
    expect(permis("saisir", ETAT.EN_COURS).ok).toBe(true);
    expect(permis("conclure", ETAT.TERMINE).ok).toBe(true);
    expect(permis("conclure", ETAT.RESULTAT_VALIDE).ok).toBe(false);
  });

  test("les états terminaux n'autorisent plus rien", () => {
    for (const terminal of [ETAT.REFUSE, ETAT.ANNULE, ETAT.RESULTAT_VALIDE])
      for (const etats of Object.values(TRANSITIONS)) expect(etats.includes(terminal)).toBe(false);
  });
});

describe("autorisations", () => {
  const acteur = (clanId: number | null, roleClan: number, roleUtilisateur = 0) => ({ clanId, roleClan, roleUtilisateur });

  test("Vice-Président du clan, ou administrateur", () => {
    expect(dirigeLeClan(acteur(1, ROLE_CLAN.VICE_PRESIDENT), 1).ok).toBe(true);
    expect(dirigeLeClan(acteur(1, ROLE_CLAN.MEMBRE), 1)).toMatchObject({ ok: false, statut: 403 });
    expect(dirigeLeClan(acteur(2, ROLE_CLAN.PRESIDENT), 1)).toMatchObject({ ok: false, statut: 403 });
    expect(dirigeLeClan(acteur(null, -1, 2), 1).ok).toBe(true);
    expect(dirigeLeClan(acteur(1, ROLE_CLAN.VICE_PRESIDENT), 1, ROLE_CLAN.PRESIDENT).ok).toBe(false);
  });

  test("l'un des deux clans : rend le clan de l'acteur", () => {
    expect(dirigeUnDesClans(acteur(9, ROLE_CLAN.PRESIDENT), 7, 9)).toEqual({ ok: true, valeur: 9 });
    expect(dirigeUnDesClans(acteur(4, ROLE_CLAN.PRESIDENT), 7, 9)).toMatchObject({ ok: false, statut: 403 });
  });
});
