import { describe, expect, test } from "bun:test";

import {
	aIdentiteNative,
	connexionsAuthentifiantes,
	etatCompte,
	peutDelier,
	type ConnexionLiee,
} from "../src/index";

const email: ConnexionLiee = { type: "email", libelle: "membre@exemple.fr" };
const discord: ConnexionLiee = { type: "discord", identifiant: "123", libelle: "membre" };
const patreon: ConnexionLiee = { type: "patreon", identifiant: "456" };
const achillea: ConnexionLiee = { type: "achillea", identifiant: "789" };

describe("connexions authentifiantes", () => {
	test("seules celles qui ouvrent une porte comptent", () => {
		const liees = [email, discord, patreon, achillea];
		expect(connexionsAuthentifiantes(liees).map((c) => c.type)).toEqual(["email", "discord"]);
	});

	test("Patreon, Steam et Achilléa apportent une capacité, pas un accès", () => {
		// Les traiter comme authentifiantes reviendrait à laisser la perte d'un
		// abonnement fermer l'accès au compte.
		expect(connexionsAuthentifiantes([patreon, achillea])).toEqual([]);
	});
});

describe("autonomie du compte", () => {
	test("l'adresse e-mail est la seule identité native", () => {
		expect(aIdentiteNative([email])).toBe(true);
		expect(aIdentiteNative([discord, patreon, achillea])).toBe(false);
	});

	test("un compte sans identité native est averti", () => {
		const etat = etatCompte([discord]);
		expect(etat.autonome).toBe(false);
		expect(etat.avertissement).toContain("adresse e-mail");
	});

	test("un compte avec e-mail n'est pas averti", () => {
		expect(etatCompte([email, discord]).avertissement).toBeNull();
	});
});

/**
 * La règle qui justifie ce module : un système multi-connexion sans garde-fou
 * laisse l'utilisateur se verrouiller dehors d'un seul clic, sans retour
 * possible.
 */
describe("déliaison", () => {
	test("refuse la dernière connexion authentifiante", () => {
		const resultat = peutDelier([discord, patreon], "discord");
		expect(resultat).toEqual({ autorise: false, motif: "derniere_authentifiante" });
	});

	test("autorise dès qu'une autre porte reste ouverte", () => {
		expect(peutDelier([email, discord], "discord").autorise).toBe(true);
		expect(peutDelier([email, discord], "email").autorise).toBe(true);
	});

	test("autorise toujours une connexion de capacité", () => {
		// Même seule : délier Patreon ne ferme aucune porte.
		expect(peutDelier([patreon], "patreon").autorise).toBe(true);
		expect(peutDelier([discord, achillea], "achillea").autorise).toBe(true);
	});

	test("refuse ce qui n'est pas lié", () => {
		expect(peutDelier([email], "steam")).toEqual({ autorise: false, motif: "non_liee" });
	});

	test("un compte réduit à son e-mail ne peut pas le retirer", () => {
		expect(peutDelier([email], "email")).toEqual({
			autorise: false,
			motif: "derniere_authentifiante",
		});
	});
});

describe("état de la page compte", () => {
	test("ne propose que ce qui n'est pas déjà lié", () => {
		const etat = etatCompte([email, discord]);
		const proposees = etat.disponibles.map((c) => c.id);
		expect(proposees).not.toContain("email");
		expect(proposees).not.toContain("discord");
		expect(proposees).toContain("achillea");
	});

	test("chaque connexion proposée dit ce qu'elle apporte", () => {
		for (const connexion of etatCompte([]).disponibles) {
			expect(connexion.apporte.length).toBeGreaterThan(10);
			expect(connexion.nom.length).toBeGreaterThan(0);
		}
	});
});
