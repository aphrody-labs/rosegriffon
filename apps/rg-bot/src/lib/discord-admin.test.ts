/**
 * Tests du socle des pouvoirs Discord.
 *
 * Aucun appel à l'API : tout ce qui est vérifié ici est ce que l'on veut savoir
 * AVANT d'appeler Discord, parce qu'après il est trop tard — un bannissement ne
 * se rejoue pas, et un `50013` ne dit pas ce qui a bloqué.
 */
import { describe, expect, test } from "bun:test";
import { PermissionFlagsBits, PermissionsBitField } from "discord.js";

import {
	AGE_MAX_SUPPRESSION_MASSE_MS,
	analyserDuree,
	dureeLisible,
	empechementHierarchie,
	expliquerEmpechement,
	LIMITE_MOTIF_AUDIT,
	MAX_EXCLUSION_MS,
	MAX_LENTEUR_SECONDES,
	motifAudit,
	normaliserJoursPurge,
	normaliserLenteur,
	normaliserNomSalon,
	partitionnerSuppression,
	permissionsManquantes,
} from "./discord-admin";

describe("analyserDuree", () => {
	test("lit les formes usuelles", () => {
		expect(analyserDuree("10m")).toBe(600_000);
		expect(analyserDuree("2h")).toBe(7_200_000);
		expect(analyserDuree("7j")).toBe(604_800_000);
		expect(analyserDuree("45 min")).toBe(2_700_000);
		expect(analyserDuree("30s")).toBe(30_000);
	});

	test("additionne les composantes", () => {
		expect(analyserDuree("1h30m")).toBe(5_400_000);
		expect(analyserDuree("1j12h")).toBe(129_600_000);
	});

	test("refuse une saisie partiellement comprise plutôt que d'en deviner la fin", () => {
		// « 10mois » lu comme 10 minutes exclurait quelqu'un 10 minutes au lieu de
		// refuser la saisie : c'est le genre d'écart qui ne se voit jamais.
		expect(analyserDuree("10mois")).toBeNull();
		expect(analyserDuree("bientôt")).toBeNull();
		expect(analyserDuree("10")).toBeNull();
		expect(analyserDuree("")).toBeNull();
		expect(analyserDuree(null)).toBeNull();
	});

	test("refuse au-delà du plafond de 28 jours imposé par l'API", () => {
		expect(analyserDuree("28j")).toBe(MAX_EXCLUSION_MS);
		expect(analyserDuree("29j")).toBeNull();
		expect(analyserDuree("30j")).toBeNull();
	});
});

describe("dureeLisible", () => {
	test("n'écrit pas d'unité vide", () => {
		expect(dureeLisible(5_400_000)).toBe("1 h 30 min");
		expect(dureeLisible(604_800_000)).toBe("7 j");
		expect(dureeLisible(30_000)).toBe("30 s");
	});

	test("rend un tiret sur une durée absurde", () => {
		expect(dureeLisible(0)).toBe("—");
		expect(dureeLisible(Number.NaN)).toBe("—");
	});
});

describe("motifAudit", () => {
	test("nomme toujours l'auteur humain", () => {
		expect(motifAudit({ auteur: "yoyo", motif: "spam répété" })).toBe(
			"spam répété — demandé par yoyo"
		);
		expect(motifAudit({ auteur: "yoyo" })).toBe("Demandé par yoyo");
		expect(motifAudit({ auteur: "yoyo", motif: "   " })).toBe("Demandé par yoyo");
	});

	test("borne à la limite de l'en-tête d'audit", () => {
		const resultat = motifAudit({ auteur: "yoyo", motif: "x".repeat(900) });
		expect(resultat.length).toBe(LIMITE_MOTIF_AUDIT);
		expect(resultat.endsWith("…")).toBe(true);
	});
});

describe("empechementHierarchie", () => {
	const base = {
		positionBot: 10,
		positionCible: 5,
		cibleProprietaire: false,
		cibleEstAuteur: false,
		cibleEstBot: false,
	};

	test("laisse passer une cible sous le bot", () => {
		expect(empechementHierarchie(base)).toBeNull();
	});

	test("refuse un rôle supérieur ou égal", () => {
		expect(empechementHierarchie({ ...base, positionCible: 11 })).toBe("role-superieur");
		expect(empechementHierarchie({ ...base, positionCible: 10 })).toBe("role-egal");
	});

	test("refuse le propriétaire, soi-même et le bot", () => {
		expect(empechementHierarchie({ ...base, cibleProprietaire: true })).toBe("proprietaire");
		expect(empechementHierarchie({ ...base, cibleEstAuteur: true })).toBe("soi-meme");
		expect(empechementHierarchie({ ...base, cibleEstBot: true })).toBe("le-bot");
	});

	test("chaque empêchement a une explication non vide", () => {
		for (const cas of ["soi-meme", "le-bot", "proprietaire", "role-superieur", "role-egal"] as const) {
			expect(expliquerEmpechement(cas).length).toBeGreaterThan(20);
		}
	});
});

describe("permissionsManquantes", () => {
	test("l'administrateur couvre tout", () => {
		const admin = new PermissionsBitField(PermissionFlagsBits.Administrator);
		expect(permissionsManquantes(admin, "bannir")).toEqual([]);
		expect(permissionsManquantes(admin, "purger")).toEqual([]);
		expect(permissionsManquantes(admin, "journal")).toEqual([]);
	});

	test("nomme en clair ce qui manque", () => {
		const lecteur = new PermissionsBitField(PermissionFlagsBits.ViewChannel);
		expect(permissionsManquantes(lecteur, "bannir")).toEqual(["Bannir des membres"]);
		expect(permissionsManquantes(lecteur, "exclure")).toEqual([
			"Exclure temporairement des membres",
		]);
	});

	test("ne réclame pas une permission déjà détenue", () => {
		expect(permissionsManquantes(PermissionFlagsBits.BanMembers, "bannir")).toEqual([]);
	});
});

describe("bornes de saisie", () => {
	test("un nom de salon suit la normalisation de Discord", () => {
		expect(normaliserNomSalon("Salon des Annonces")).toBe("salon-des-annonces");
		expect(normaliserNomSalon("  Équipe Azalée  ")).toBe("equipe-azalee");
		expect(normaliserNomSalon("a///b")).toBe("a-b");
		expect(normaliserNomSalon("x".repeat(200)).length).toBe(100);
	});

	test("le mode lent reste dans les six heures", () => {
		expect(normaliserLenteur(0)).toBe(0);
		expect(normaliserLenteur(30)).toBe(30);
		expect(normaliserLenteur(MAX_LENTEUR_SECONDES)).toBe(MAX_LENTEUR_SECONDES);
		expect(normaliserLenteur(MAX_LENTEUR_SECONDES + 1)).toBeNull();
		expect(normaliserLenteur(-1)).toBeNull();
		expect(normaliserLenteur("30")).toBeNull();
	});

	test("la purge de bannissement va de zéro à sept jours", () => {
		expect(normaliserJoursPurge(0)).toBe(0);
		expect(normaliserJoursPurge(7)).toBe(7);
		expect(normaliserJoursPurge(8)).toBeNull();
		expect(normaliserJoursPurge(-1)).toBeNull();
	});
});

describe("partitionnerSuppression", () => {
	const maintenant = 1_776_000_000_000;

	test("écarte les messages de plus de quatorze jours", () => {
		const horodatages = [
			maintenant - 1000,
			maintenant - 60_000,
			maintenant - AGE_MAX_SUPPRESSION_MASSE_MS - 1,
			maintenant - AGE_MAX_SUPPRESSION_MASSE_MS * 2,
		];
		expect(partitionnerSuppression(horodatages, maintenant, 10)).toEqual({
			supprimables: 2,
			tropAnciens: 2,
			plafonne: false,
		});
	});

	test("signale le plafond de cent", () => {
		const horodatages = Array.from({ length: 150 }, () => maintenant - 1000);
		const resultat = partitionnerSuppression(horodatages, maintenant, 150);
		expect(resultat.supprimables).toBe(100);
		expect(resultat.plafonne).toBe(true);
	});
});
