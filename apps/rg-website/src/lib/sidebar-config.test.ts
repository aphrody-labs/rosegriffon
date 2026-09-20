import { describe, expect, test } from "bun:test";

import { listerMotifsRoutes, routeExiste } from "@rosegriffon/app-shell/routes-next";

import {
	assoMenu,
	contactMenu,
	getBadgeVariant,
	isValidMenuItem,
	isValidSubMenuItem,
	type MenuItem,
	type MenuSection,
	type SubMenuItem,
} from "./sidebar-config";

const SECTIONS: MenuSection[] = [assoMenu, contactMenu];
const TOUS_LES_ITEMS: MenuItem[] = SECTIONS.flatMap((s) => s.items);
const TOUS_LES_SOUS_ITEMS: SubMenuItem[] = TOUS_LES_ITEMS.flatMap((i) => i.items ?? []);

/** Lien sortant : ni route Next, ni ancre interne. */
const estExterne = (url: string) => /^(https?:|mailto:|tel:)/.test(url);

describe("getBadgeVariant", () => {
	test.each(["new", "hot", "beta", "soon"] as const)("la variante %s rend un style", (variante) => {
		const style = getBadgeVariant(variante);
		for (const clef of ["bg", "text", "border", "animation"] as const) {
			expect(typeof style[clef]).toBe("string");
		}
		expect(style.bg).toBeTruthy();
	});

	test("les quatre variantes sont visuellement distinctes", () => {
		const styles = (["new", "hot", "beta", "soon"] as const).map((v) =>
			JSON.stringify(getBadgeVariant(v))
		);
		expect(new Set(styles).size).toBe(4);
	});

	test("sans argument, retombe sur la variante `new`", () => {
		expect(getBadgeVariant()).toEqual(getBadgeVariant("new"));
	});
});

describe("gardes de type", () => {
	// Composant fonction ET composant `forwardRef` : lucide-react rend le second,
	// et c'est précisément celui que les gardes rejetaient.
	const icone = () => null;
	const iconeForwardRef = { $$typeof: Symbol.for("react.forward_ref"), render: () => null };

	test("isValidMenuItem accepte un item minimal", () => {
		expect(isValidMenuItem({ icon: icone, title: "Accueil" })).toBe(true);
	});

	test("isValidMenuItem accepte une icône `forwardRef` (lucide-react)", () => {
		expect(isValidMenuItem({ icon: iconeForwardRef, title: "Accueil" })).toBe(true);
	});

	test.each([
		[null, "null"],
		[undefined, "undefined"],
		["Accueil", "une chaîne"],
		[42, "un nombre"],
		[{ title: "Accueil" }, "une icône manquante"],
		[{ icon: icone }, "un titre manquant"],
		[{ icon: "Home", title: "Accueil" }, "une icône qui n'est pas un composant"],
		[{ icon: {}, title: "Accueil" }, "un objet sans $$typeof"],
		[{ icon: icone, title: "Accueil", url: 12 }, "une url qui n'est pas une chaîne"],
	])("isValidMenuItem rejette %p (%s)", (valeur) => {
		expect(isValidMenuItem(valeur)).toBe(false);
	});

	test("isValidSubMenuItem exige une url, contrairement à isValidMenuItem", () => {
		// Un item de premier niveau peut n'être qu'un entête repliable ; un
		// sous-item sans url est un lien qui ne mène nulle part.
		expect(isValidSubMenuItem({ icon: icone, title: "Contact" })).toBe(false);
		expect(isValidSubMenuItem({ icon: icone, title: "Contact", url: "/contact" })).toBe(true);
	});
});

describe("invariants du menu livré", () => {
	test("chaque section porte un libellé et au moins un item", () => {
		for (const section of SECTIONS) {
			expect(section.label).toBeTruthy();
			expect(section.items.length).toBeGreaterThan(0);
		}
	});

	test("tous les items passent leur propre garde de type", () => {
		for (const item of TOUS_LES_ITEMS) {
			expect(isValidMenuItem(item)).toBe(true);
		}
		for (const sous of TOUS_LES_SOUS_ITEMS) {
			expect(isValidSubMenuItem(sous)).toBe(true);
		}
	});

	test("aucune url vide ni relative", () => {
		for (const { url } of [...TOUS_LES_ITEMS, ...TOUS_LES_SOUS_ITEMS]) {
			if (url === undefined) {
				continue;
			}
			expect(url).not.toBe("");
			expect(estExterne(url) || url.startsWith("/") || url.startsWith("#")).toBe(true);
		}
	});

	test("aucun doublon de destination interne", () => {
		// Deux entrées vers la même page, c'est un clic sur deux qui ne fait rien
		// de visible pour l'utilisateur.
		const internes = [...TOUS_LES_ITEMS, ...TOUS_LES_SOUS_ITEMS]
			.map((i) => i.url)
			.filter((u): u is string => Boolean(u) && !estExterne(u!));
		expect(internes.length).toBe(new Set(internes).size);
	});

	test("un item sans url a forcément des sous-items", () => {
		for (const item of TOUS_LES_ITEMS) {
			if (!item.url) {
				expect(item.items?.length ?? 0).toBeGreaterThan(0);
			}
		}
	});

	test("un lien externe est marqué comme tel", () => {
		for (const item of [...TOUS_LES_ITEMS, ...TOUS_LES_SOUS_ITEMS]) {
			if (item.url && estExterne(item.url)) {
				expect((item as MenuItem).isExternal).toBe(true);
			}
		}
	});
});

describe("aucun lien de la barre latérale ne mène à un 404", () => {
	const motifs = listerMotifsRoutes(new URL("../app", import.meta.url).pathname);

	test("l'inventaire de routes est exploitable", () => {
		expect(motifs.length).toBeGreaterThan(50);
	});

	test("toutes les destinations internes existent", () => {
		const morts = [...TOUS_LES_ITEMS, ...TOUS_LES_SOUS_ITEMS]
			.map((i) => i.url)
			.filter((u): u is string => Boolean(u) && !estExterne(u!) && !u!.startsWith("#"))
			.filter((u) => !routeExiste(motifs, u));
		expect(morts).toEqual([]);
	});
});
