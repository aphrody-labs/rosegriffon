/**
 * Tests de `commands/administration/valeurs.ts`.
 *
 * Module pur : ni base, ni réseau, ni client Discord. Les valeurs de référence
 * viennent de la base de production (répartition réelle de `profiles.role`,
 * identifiants de `team_members.team_id`), relevées le 13/8/2026.
 */
import { describe, expect, test } from "bun:test";

import {
	EQUIPES_RG,
	JOURS_SEMAINE,
	PREFIXE_CONFIRMATION,
	ROLES_ASSIGNABLES,
	STATUTS_ARTICLE,
	abregerIdentifiant,
	analyserDate,
	analyserHeure,
	analyserIdConfirmation,
	bornerValeur,
	construireIdConfirmation,
	decrireChangement,
	estIdentifiantDiscord,
	estRoleAssignable,
	estStatutArticle,
	estUuid,
} from "./valeurs";

describe("ROLES_ASSIGNABLES", () => {
	test("contient « member », le rôle de 1 839 profils sur 1 850", () => {
		// L'ancien /rg-user ne le proposait pas : filtrer sur le rôle majoritaire
		// de la base était donc impossible.
		expect(ROLES_ASSIGNABLES).toContain("member");
	});

	test("contient aussi « superadmin », présent en base et absent de l'ancienne liste", () => {
		expect(ROLES_ASSIGNABLES).toContain("superadmin");
	});

	test("couvre les rôles observés en production", () => {
		for (const role of ["member", "admin", "superadmin", "user", "moderator"]) {
			expect(estRoleAssignable(role)).toBe(true);
		}
	});

	test("refuse ce qui n'est pas un rôle", () => {
		expect(estRoleAssignable("root")).toBe(false);
		expect(estRoleAssignable("")).toBe(false);
		expect(estRoleAssignable(null)).toBe(false);
		expect(estRoleAssignable(42)).toBe(false);
	});

	test("tient dans les 25 choix d'une option Discord et n'a pas de doublon", () => {
		expect(ROLES_ASSIGNABLES.length).toBeLessThanOrEqual(25);
		expect(new Set(ROLES_ASSIGNABLES).size).toBe(ROLES_ASSIGNABLES.length);
	});
});

describe("statuts d'article", () => {
	test("les trois valeurs de la colonne", () => {
		expect([...STATUTS_ARTICLE]).toEqual(["published", "draft", "archived"]);
	});

	test("refuse une valeur inventée", () => {
		expect(estStatutArticle("publié")).toBe(false);
		expect(estStatutArticle(undefined)).toBe(false);
	});
});

describe("EQUIPES_RG et JOURS_SEMAINE", () => {
	test("les dix équipes portent les identifiants de la base", () => {
		const valeurs = EQUIPES_RG.map((equipe) => equipe.valeur);
		expect(valeurs).toContain("achilleateam");
		expect(valeurs).toContain("assoteam");
		expect(valeurs).toContain("dessinateurteam");
		expect(valeurs).toHaveLength(10);
	});

	test("le jour 0 est dimanche, comme l'index de stream_schedules", () => {
		expect(JOURS_SEMAINE[0]).toBe("Dimanche");
		expect(JOURS_SEMAINE[6]).toBe("Samedi");
	});
});

describe("analyserDate", () => {
	test("accepte les formes ISO ancrées", () => {
		expect(analyserDate("2026-05-01")?.toISOString()).toBe("2026-05-01T00:00:00.000Z");
		expect(analyserDate("2026-05-01T20:00:00Z")?.toISOString()).toBe("2026-05-01T20:00:00.000Z");
		expect(analyserDate("2026-05-01T20:00:00+02:00")?.toISOString()).toBe(
			"2026-05-01T18:00:00.000Z"
		);
	});

	test("accepte l'espace à la place du T", () => {
		expect(analyserDate("2026-05-01 20:00")).not.toBeNull();
	});

	test("refuse les formats ambigus plutôt que de deviner", () => {
		// 01/05/2026 : jour/mois ou mois/jour ? Selon le moteur, ce n'est pas la
		// même date. On refuse.
		expect(analyserDate("01/05/2026")).toBeNull();
		expect(analyserDate("demain")).toBeNull();
		expect(analyserDate("")).toBeNull();
		expect(analyserDate(null)).toBeNull();
	});

	test("refuse une date impossible au lieu de rendre Invalid Date", () => {
		expect(analyserDate("2026-13-45")).toBeNull();
		expect(analyserDate("2026-02-30")).toBeNull();
	});
});

describe("analyserHeure", () => {
	test("normalise sur deux chiffres", () => {
		expect(analyserHeure("9:05")).toBe("09:05");
		expect(analyserHeure("21:30")).toBe("21:30");
	});

	test("refuse hors bornes ou mal formé", () => {
		expect(analyserHeure("24:00")).toBeNull();
		expect(analyserHeure("21:60")).toBeNull();
		expect(analyserHeure("21h30")).toBeNull();
		expect(analyserHeure(undefined)).toBeNull();
	});
});

describe("estUuid et estIdentifiantDiscord", () => {
	test("reconnaît un UUID de profil", () => {
		expect(estUuid("3f2504e0-4f89-11d3-9a0c-0305e82c3301")).toBe(true);
		expect(estUuid("3f2504e0-4f89-11d3-9a0c")).toBe(false);
	});

	test("reconnaît un flocon Discord", () => {
		expect(estIdentifiantDiscord("790867082397097984")).toBe(true);
		expect(estIdentifiantDiscord("12345")).toBe(false);
		expect(estIdentifiantDiscord("pas-un-id")).toBe(false);
	});
});

describe("abregerIdentifiant", () => {
	test("coupe à huit caractères", () => {
		expect(abregerIdentifiant("3f2504e0-4f89-11d3-9a0c-0305e82c3301")).toBe("3f2504e0…");
	});

	test("laisse passer ce qui est déjà court, et dit l'absence", () => {
		expect(abregerIdentifiant("abc")).toBe("abc");
		expect(abregerIdentifiant(null)).toBe("—");
	});
});

describe("identifiants de bouton de confirmation", () => {
	test("aller-retour complet", () => {
		const id = construireIdConfirmation("oui", "1234567890123456789");
		expect(id).toBe("rgconf|oui|1234567890123456789");
		expect(analyserIdConfirmation(id)).toEqual({
			reponse: "oui",
			graine: "1234567890123456789",
		});
	});

	test("tient sous les 100 caractères imposés par Discord", () => {
		expect(construireIdConfirmation("non", "1234567890123456789").length).toBeLessThanOrEqual(100);
	});

	test("rejette ce qui ne nous appartient pas", () => {
		expect(analyserIdConfirmation("tw|1|2|3")).toBeNull();
		expect(analyserIdConfirmation(`${PREFIXE_CONFIRMATION}|peutetre|123`)).toBeNull();
		expect(analyserIdConfirmation(`${PREFIXE_CONFIRMATION}|oui|`)).toBeNull();
		expect(analyserIdConfirmation(`${PREFIXE_CONFIRMATION}|oui`)).toBeNull();
		expect(analyserIdConfirmation(null)).toBeNull();
	});
});

describe("bornerValeur et decrireChangement", () => {
	test("aplatit une valeur composite sur une ligne", () => {
		expect(bornerValeur({ actif: true, comptes: ["a"] })).toBe('{"actif":true,"comptes":["a"]}');
	});

	test("écrase les sauts de ligne, qui casseraient la ligne d'accusé", () => {
		expect(bornerValeur("une\nvaleur\tmultiligne")).toBe("une valeur multiligne");
	});

	test("distingue absence et chaîne vide", () => {
		expect(bornerValeur(null)).toBe("aucune");
		expect(bornerValeur(undefined)).toBe("aucune");
		expect(bornerValeur("   ")).toBe("vide");
	});

	test("tronque sans dépasser la limite", () => {
		const texte = bornerValeur("w".repeat(400), 50);
		expect(texte.length).toBe(50);
		expect(texte.endsWith("…")).toBe(true);
	});

	test("dit d'où l'on vient, pas seulement où l'on va", () => {
		expect(decrireChangement("member", "admin")).toBe("`member` → `admin`");
		expect(decrireChangement(null, "admin")).toBe("`aucune` → `admin`");
	});

	test("une valeur cyclique ne fait pas lever l'accusé de réception", () => {
		const cyclique: Record<string, unknown> = {};
		cyclique.moi = cyclique;
		expect(() => bornerValeur(cyclique)).not.toThrow();
	});
});
