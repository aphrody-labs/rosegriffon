/**
 * Tests du noyau de niveaux.
 *
 * Le rôle principal de ce fichier est de FIXER la recopie de
 * `inagle_exp_table` : une table de cent nombres recopiée à la main se dégrade
 * en silence, et personne ne s'en aperçoit avant qu'un membre ne trouve son
 * niveau bizarre six mois plus tard. Les points de contrôle ci-dessous ont été
 * relevés en base le 14/8/2026 par
 *
 *   with c as (select level, sum(need_exp) over (order by level) as cum
 *              from inagle_exp_table)
 *   select level, cum from c where level in (5,10,20,30,40,50,60,70,80,90,99);
 */
import { describe, expect, test } from "bun:test";

import {
	gainDeMessage,
	GAIN_DEFAUT,
	meriteAnnonce,
	messageEligible,
	NIVEAU_MAX,
	niveauPour,
	niveauxFranchis,
	PALIERS_EXPERIENCE,
	jetonsDeMontee,
	prochainRang,
	progression,
	rangDe,
	RANGS,
	XP_NIVEAU_MAX,
	xpPourAtteindre,
} from "./experience";

/** `cum(level)` de la requête ci-dessus = XP cumulée pour atteindre level + 1. */
const CONTROLES: ReadonlyArray<[niveau: number, cumule: number]> = [
	[5, 761],
	[10, 2_422],
	[20, 12_291],
	[30, 38_310],
	[40, 91_919],
	[50, 195_502],
	[60, 380_638],
	[70, 689_813],
	[80, 1_179_390],
	[90, 1_921_840],
	[99, 2_878_742],
];

describe("table d'expérience du jeu", () => {
	test("cent paliers, strictement croissants", () => {
		expect(PALIERS_EXPERIENCE).toHaveLength(100);
		for (let index = 1; index < PALIERS_EXPERIENCE.length; index++) {
			expect(PALIERS_EXPERIENCE[index]).toBeGreaterThan(PALIERS_EXPERIENCE[index - 1] as number);
		}
	});

	test("les cumuls relevés en base sont reproduits à l'unité près", () => {
		for (const [niveau, cumule] of CONTROLES) {
			// `cum(level)` inclut le palier de `level` : c'est donc l'XP pour
			// atteindre `level + 1`.
			expect(xpPourAtteindre(niveau + 1)).toBe(cumule);
		}
	});

	test("le plafond est celui du jeu", () => {
		expect(NIVEAU_MAX).toBe(100);
		expect(XP_NIVEAU_MAX).toBe(2_878_742);
	});
});

describe("niveau depuis l'XP", () => {
	test("on commence au niveau 1, sans XP", () => {
		expect(niveauPour(0)).toBe(1);
		expect(niveauPour(123)).toBe(1);
		expect(xpPourAtteindre(1)).toBe(0);
	});

	test("le palier exact fait monter, un point en dessous ne fait pas monter", () => {
		expect(niveauPour(124)).toBe(2);
		expect(niveauPour(123)).toBe(1);
		expect(niveauPour(xpPourAtteindre(50))).toBe(50);
		expect(niveauPour(xpPourAtteindre(50) - 1)).toBe(49);
	});

	test("au-delà du plafond, on reste au plafond", () => {
		expect(niveauPour(XP_NIVEAU_MAX)).toBe(NIVEAU_MAX);
		expect(niveauPour(XP_NIVEAU_MAX * 10)).toBe(NIVEAU_MAX);
	});

	test("une valeur aberrante ne remonte jamais en NaN", () => {
		expect(niveauPour(Number.NaN)).toBe(1);
		expect(niveauPour(-500)).toBe(1);
		expect(xpPourAtteindre(Number.NaN)).toBe(0);
		expect(xpPourAtteindre(10_000)).toBe(XP_NIVEAU_MAX);
	});
});

describe("progression affichable", () => {
	test("au milieu d'un niveau, tout se recoupe", () => {
		const base = xpPourAtteindre(10);
		const p = progression(base + 100);
		expect(p.niveau).toBe(10);
		expect(p.xpDansNiveau).toBe(100);
		expect(p.xpDuNiveau).toBe(PALIERS_EXPERIENCE[9]);
		expect(p.restant).toBe((PALIERS_EXPERIENCE[9] as number) - 100);
		expect(p.ratio).toBeCloseTo(100 / (PALIERS_EXPERIENCE[9] as number), 6);
		expect(p.auMaximum).toBe(false);
	});

	test("au plafond, la barre est pleine et il ne reste rien", () => {
		const p = progression(XP_NIVEAU_MAX + 1_000);
		expect(p.niveau).toBe(NIVEAU_MAX);
		expect(p.auMaximum).toBe(true);
		expect(p.ratio).toBe(1);
		expect(p.restant).toBe(0);
	});
});

describe("niveaux franchis", () => {
	test("aucun franchissement sans changement de niveau", () => {
		expect(niveauxFranchis(0, 100)).toEqual([]);
		expect(niveauxFranchis(1_000, 500)).toEqual([]);
	});

	test("un gain ordinaire franchit un palier", () => {
		expect(niveauxFranchis(120, 130)).toEqual([2]);
	});

	test("un gain exceptionnel rend TOUS les paliers, pas seulement le dernier", () => {
		// Sans ça, les rôles des niveaux intermédiaires ne seraient jamais posés.
		expect(niveauxFranchis(0, xpPourAtteindre(5))).toEqual([2, 3, 4, 5]);
	});
});

describe("rangs", () => {
	test("les quatre libellés viennent des données FR du jeu", () => {
		expect(RANGS.map((rang) => rang.nom)).toEqual([
			"Normal",
			"Expérimenté",
			"Héros",
			"BASARA",
		]);
	});

	test("chaque niveau tombe dans un rang, bornes comprises", () => {
		expect(rangDe(1).nom).toBe("Normal");
		expect(rangDe(19).nom).toBe("Normal");
		expect(rangDe(20).nom).toBe("Expérimenté");
		expect(rangDe(49).nom).toBe("Expérimenté");
		expect(rangDe(50).nom).toBe("Héros");
		expect(rangDe(79).nom).toBe("Héros");
		expect(rangDe(80).nom).toBe("BASARA");
		expect(rangDe(NIVEAU_MAX).nom).toBe("BASARA");
	});

	test("le prochain rang existe jusqu'au dernier", () => {
		expect(prochainRang(1)?.depuis).toBe(20);
		expect(prochainRang(49)?.depuis).toBe(50);
		expect(prochainRang(80)).toBeNull();
	});
});

describe("filtre d'annonce", () => {
	test("sans montée, rien à annoncer", () => {
		expect(meriteAnnonce(10, 10)).toBe(false);
		expect(meriteAnnonce(10, 9)).toBe(false);
	});

	test("par défaut, un niveau sur cinq seulement", () => {
		// Le cas qui compte : un membre actif monte tous les deux ou trois jours en
		// début de courbe. Sans filtre, deux mille membres rendent le salon
		// illisible en une semaine.
		expect(meriteAnnonce(6, 7)).toBe(false);
		expect(meriteAnnonce(8, 9)).toBe(false);
		expect(meriteAnnonce(9, 10)).toBe(true);
		expect(meriteAnnonce(14, 15)).toBe(true);
	});

	test("un palier TRAVERSÉ compte, pas seulement atterri dessus", () => {
		// Un gain exceptionnel peut sauter par-dessus le multiple.
		expect(meriteAnnonce(9, 11)).toBe(true);
		expect(meriteAnnonce(2, 8)).toBe(true);
	});

	test("un changement de rang s'annonce même hors palier", () => {
		// Niveau 20 = passage de Normal à Expérimenté. Trois fois dans une vie de
		// membre : ça se fête.
		expect(meriteAnnonce(19, 20, { palier: 100 })).toBe(true);
		expect(meriteAnnonce(49, 50, { palier: 100 })).toBe(true);
		expect(meriteAnnonce(79, 80, { palier: 100 })).toBe(true);
		expect(meriteAnnonce(19, 20, { annoncerRang: false, palier: 100 })).toBe(false);
	});

	test("palier 1 rétablit l'annonce à chaque niveau", () => {
		expect(meriteAnnonce(6, 7, { palier: 1 })).toBe(true);
	});

	test("un palier aberrant ne fait pas tout passer", () => {
		expect(meriteAnnonce(6, 7, { annoncerRang: false, palier: 0 })).toBe(true);
		expect(meriteAnnonce(6, 7, { annoncerRang: false, palier: Number.NaN })).toBe(false);
	});
});

describe("gain d'un message", () => {
	test("le tirage couvre toute la fourchette, bornes comprises", () => {
		expect(gainDeMessage(GAIN_DEFAUT, 0)).toBe(15);
		expect(gainDeMessage(GAIN_DEFAUT, 0.999_999)).toBe(25);
		expect(gainDeMessage(GAIN_DEFAUT, 0.5)).toBeGreaterThanOrEqual(15);
		expect(gainDeMessage(GAIN_DEFAUT, 0.5)).toBeLessThanOrEqual(25);
	});

	test("une fourchette inversée ne rend jamais moins que son minimum", () => {
		expect(gainDeMessage({ delaiSecondes: 60, maximum: 5, minimum: 20 }, 0.9)).toBe(20);
	});

	test("un tirage aberrant ne casse pas le gain", () => {
		expect(gainDeMessage(GAIN_DEFAUT, Number.NaN)).toBe(15);
		expect(gainDeMessage(GAIN_DEFAUT, 42)).toBe(25);
	});

	test("le premier message d'un membre rapporte toujours", () => {
		expect(messageEligible(null)).toBe(true);
		expect(messageEligible(undefined)).toBe(true);
		expect(messageEligible("pas une date")).toBe(true);
	});

	test("le délai anti-spam se compte à la seconde près", () => {
		const maintenant = new Date("2026-08-14T12:01:00.000Z");
		expect(messageEligible("2026-08-14T12:00:00.000Z", maintenant, 60)).toBe(true);
		expect(messageEligible("2026-08-14T12:00:01.000Z", maintenant, 60)).toBe(false);
	});

	test("les points de montée croissent avec le niveau", () => {
		expect(jetonsDeMontee(1)).toBe(10);
		expect(jetonsDeMontee(50)).toBe(500);
		expect(jetonsDeMontee(50, 0)).toBe(0);
	});
});
