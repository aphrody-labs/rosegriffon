/**
 * Tests de l'historique de modération.
 *
 * Ce qui est vérifié ici décide de la façon dont le staff juge une récidive.
 * Deux règles y sont défendues : une LEVÉE n'aggrave pas un dossier, et un
 * dossier ancien ne se lit pas comme un dossier récent.
 */
import { describe, expect, test } from "bun:test";

import {
	ACTIONS_MODERATION,
	estActionModeration,
	iconeAction,
	JOURS_RECENTS,
	libelleAction,
	libelleResume,
	poidsAction,
	resumer,
	type EntreeHistorique,
} from "./sanctions";

const LE_14 = new Date("2026-08-14T12:00:00.000Z");

function entree(action: string, joursAvant: number, motif: string | null = null): EntreeHistorique {
	return {
		action,
		le: new Date(LE_14.getTime() - joursAvant * 86_400_000),
		motif,
		parQui: "531549483067244566",
	};
}

describe("vocabulaire", () => {
	test("chaque action a un libellé et une icône", () => {
		for (const action of ACTIONS_MODERATION) {
			expect(estActionModeration(action)).toBe(true);
			expect(libelleAction(action)).not.toBe(action);
			expect(iconeAction(action).length).toBeGreaterThan(0);
		}
	});

	test("une action inconnue ressort telle quelle plutôt que d'être masquée", () => {
		expect(estActionModeration("discord.pardonner")).toBe(false);
		expect(libelleAction("discord.pardonner")).toBe("discord.pardonner");
		expect(poidsAction("discord.pardonner")).toBe(0);
	});

	test("la gravité croît avec la sévérité", () => {
		expect(poidsAction("discord.avertir")).toBeLessThan(poidsAction("discord.exclure"));
		expect(poidsAction("discord.exclure")).toBeLessThan(poidsAction("discord.expulser"));
		expect(poidsAction("discord.expulser")).toBeLessThan(poidsAction("discord.bannir"));
	});

	test("une LEVÉE ne pèse rien — on ne punit pas d'avoir été gracié", () => {
		expect(poidsAction("discord.lever-exclusion")).toBe(0);
		expect(poidsAction("discord.debannir")).toBe(0);
	});
});

describe("résumé", () => {
	test("un dossier vierge le dit sans détour", () => {
		const resume = resumer([], LE_14);
		expect(resume.total).toBe(0);
		expect(resume.derniere).toBeNull();
		expect(libelleResume(resume)).toContain("vierge");
	});

	test("le total et les récentes ne disent PAS la même chose", () => {
		// Quatre avertissements dont trois très anciens : le total alarme, la
		// fenêtre récente rassure. Un seul compteur confondrait les deux.
		const resume = resumer(
			[
				entree("discord.avertir", 1),
				entree("discord.avertir", 400),
				entree("discord.avertir", 500),
				entree("discord.avertir", 600),
			],
			LE_14
		);
		expect(resume.total).toBe(4);
		expect(resume.recentes).toBe(1);
	});

	test("la bordure de la fenêtre récente est incluse", () => {
		expect(resumer([entree("discord.avertir", JOURS_RECENTS)], LE_14).recentes).toBe(1);
		expect(resumer([entree("discord.avertir", JOURS_RECENTS + 1)], LE_14).recentes).toBe(0);
	});

	test("une exclusion levée reste dans l'historique mais n'alourdit pas la gravité", () => {
		const resume = resumer(
			[entree("discord.exclure", 10), entree("discord.lever-exclusion", 9)],
			LE_14
		);
		expect(resume.total).toBe(2);
		expect(resume.gravite).toBe(poidsAction("discord.exclure"));
	});

	test("la dernière entrée est la plus RÉCENTE, quel que soit l'ordre reçu", () => {
		const resume = resumer(
			[entree("discord.avertir", 30, "ancien"), entree("discord.bannir", 2, "récent")],
			LE_14
		);
		expect(resume.derniere?.motif).toBe("récent");
	});

	test("le décompte par action garde les actions à zéro", () => {
		// Une grille qui change de forme selon le membre ne se compare pas d'un
		// coup d'œil entre deux dossiers.
		const resume = resumer([entree("discord.avertir", 1)], LE_14);
		expect(resume.parAction).toHaveLength(ACTIONS_MODERATION.length);
		expect(resume.parAction.find((e) => e.action === "discord.avertir")?.nombre).toBe(1);
		expect(resume.parAction.find((e) => e.action === "discord.bannir")?.nombre).toBe(0);
	});

	test("une date illisible ne fait pas planter le résumé", () => {
		const resume = resumer(
			[{ action: "discord.avertir", le: new Date("pas une date"), motif: null, parQui: null }],
			LE_14
		);
		expect(resume.total).toBe(1);
		expect(resume.recentes).toBe(0);
	});
});
