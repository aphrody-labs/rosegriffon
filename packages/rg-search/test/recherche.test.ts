import { describe, expect, test } from "bun:test";

import {
	BASES_PAR_DEFAUT,
	construireRequete,
	formaterLigne,
	grouperParDomaine,
	LONGUEUR_MINIMALE,
	motifIlike,
	rechercherPartout,
	type LigneBrute,
} from "../src/index";

describe("motif ILIKE", () => {
	test("entoure le terme de jokers", () => {
		expect(motifIlike("axel")).toBe("%axel%");
	});

	/**
	 * Sans échappement, chercher « 100% » rend `%100%%` : le `%` saisi devient un
	 * joker et la requête ramène tout ce qui commence par « 100 ». Idem pour `_`,
	 * qui remplace n'importe quel caractère.
	 */
	test("échappe les jokers saisis par l'utilisateur", () => {
		expect(motifIlike("100%")).toBe("%100\\%%");
		expect(motifIlike("a_b")).toBe("%a\\_b%");
		expect(motifIlike("c:\\x")).toBe("%c:\\\\x%");
	});
});

describe("requête d'union", () => {
	const sql = construireRequete();

	test("une seule requête couvre les trois domaines", () => {
		expect(sql).toContain("public.articles");
		expect(sql).toContain("public.inagle_characters");
		expect(sql).toContain("achillea.clan");
		expect(sql).toContain('achillea."user"');
	});

	test("n'interpole jamais de valeur : seuls $1 et $2 varient", () => {
		expect(sql).toContain("$1");
		expect(sql).toContain("$2");
		// Aucune valeur littérale entre guillemets simples hormis les filtres
		// constants déclarés dans les sources.
		const litteraux = sql.match(/'[^']*'/g) ?? [];
		expect(litteraux).toEqual(["'published'"]);
	});

	test("chaque branche porte son index de source", () => {
		// Sans cet index, impossible de savoir d'où vient une ligne au retour.
		expect(sql).toContain("0::int AS source");
		expect(sql).toContain("6::int AS source");
	});

	test("le nombre de branches suit le nombre de sources", () => {
		expect(sql.split("UNION ALL").length).toBe(7);
	});
});

describe("mise en forme", () => {
	const ligne = (source: string, id = "42", titre = "Axel"): LigneBrute => ({
		detail: null,
		id,
		source,
		titre,
	});

	test("préfixe l'URL par la base du domaine", () => {
		expect(formaterLigne(ligne("1", "axel-blaze"), BASES_PAR_DEFAUT)?.href).toBe(
			"/wiki/chara/axel-blaze"
		);
		expect(formaterLigne(ligne("4"), BASES_PAR_DEFAUT)?.href).toBe("/achillea/clans/42");
	});

	test("suit des bases différentes sans réécriture", () => {
		// Azalée montait le wiki à la racine : la mise en forme doit suivre.
		const bases = { association: "", esport: "/achillea", wiki: "" };
		expect(formaterLigne(ligne("1", "axel"), bases)?.href).toBe("/chara/axel");
	});

	test("rend null sur une source inconnue plutôt que de fabriquer une URL", () => {
		expect(formaterLigne(ligne("99"), BASES_PAR_DEFAUT)).toBeNull();
	});

	test("l'identifiant rendu est unique entre domaines", () => {
		// Deux tables peuvent porter le même id : sans préfixe de type, React
		// verrait deux clés identiques dans la liste de résultats.
		const a = formaterLigne(ligne("1", "42"), BASES_PAR_DEFAUT);
		const b = formaterLigne(ligne("4", "42"), BASES_PAR_DEFAUT);
		expect(a?.id).not.toBe(b?.id);
	});
});

describe("recherche complète", () => {
	const lignes: LigneBrute[] = [
		{ detail: null, id: "c1", source: "1", titre: "Axel Blaze édition limitée" },
		{ detail: null, id: "c2", source: "1", titre: "Axel" },
		{ detail: null, id: "k1", source: "4", titre: "Axel Corp" },
		{ detail: null, id: "a1", source: "0", titre: "Axel revient" },
	];
	const executer = async () => lignes;

	test("refuse une requête trop courte sans toucher la base", async () => {
		let appele = false;
		const espion = async () => {
			appele = true;
			return [];
		};
		expect(await rechercherPartout(espion, "a")).toEqual([]);
		expect(appele).toBe(false);
		expect(LONGUEUR_MINIMALE).toBe(2);
	});

	test("ignore les espaces autour du terme", async () => {
		expect(await rechercherPartout(executer, "  a  ")).toEqual([]);
	});

	test("trie par domaine puis par titre le plus court", async () => {
		const resultats = await rechercherPartout(executer, "axel");
		expect(resultats.map((r) => r.domaine)).toEqual(["association", "wiki", "wiki", "esport"]);
		// Au sein du wiki, la correspondance courte passe devant.
		expect(resultats[1]?.titre).toBe("Axel");
	});

	/**
	 * Le miroir Achilléa peut être absent (machine de développement, schéma
	 * retiré). La recherche doit alors dégrader, pas casser la page.
	 */
	test("ne lève jamais quand une source est indisponible", async () => {
		const casse = async () => {
			throw new Error('relation "achillea.clan" does not exist');
		};
		expect(await rechercherPartout(casse, "axel")).toEqual([]);
	});

	test("respecte la limite totale", async () => {
		const resultats = await rechercherPartout(executer, "axel", { limiteTotale: 2 });
		expect(resultats).toHaveLength(2);
	});

	test("groupe par domaine en omettant les domaines vides", async () => {
		const groupes = grouperParDomaine(await rechercherPartout(executer, "axel"));
		expect(groupes.map((g) => g.domaine)).toEqual(["association", "wiki", "esport"]);
		expect(groupes[1]?.resultats).toHaveLength(2);
	});
});
