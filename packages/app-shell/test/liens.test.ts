import { existsSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "bun:test";

import { cheminsCliquables, construireNavigation } from "../src/config/navigation";
import { listerMotifsRoutes, motifAccepte, routeExiste } from "../src/lib/routes-next";
import { AZALEE_BASES, WEBSITE_BASES } from "../src/config/routes";

const RACINE = join(import.meta.dir, "../../..");

const APPS = [
	{ app: join(RACINE, "apps/azalee/app"), bases: AZALEE_BASES, nom: "azalee" },
	{ app: join(RACINE, "apps/website/src/app"), bases: WEBSITE_BASES, nom: "website" },
] as const;

describe("motifAccepte", () => {
	test("segment littéral", () => {
		expect(motifAccepte("/chara", "/chara")).toBe(true);
		expect(motifAccepte("/chara", "/skill")).toBe(false);
		// Pas de correspondance par préfixe de chaîne.
		expect(motifAccepte("/mode", "/modeles")).toBe(false);
	});

	test("segment dynamique", () => {
		expect(motifAccepte("/chara/[id]", "/chara/c05028001")).toBe(true);
		expect(motifAccepte("/chara/[id]", "/chara")).toBe(false);
		expect(motifAccepte("/chara/[id]", "/chara/a/b")).toBe(false);
	});

	test("catch-all optionnel `[[...x]]` avale aussi le vide", () => {
		expect(motifAccepte("/modeles/[[...path]]", "/modeles")).toBe(true);
		expect(motifAccepte("/modeles/[[...path]]", "/modeles/a/b/c")).toBe(true);
	});

	test("catch-all obligatoire `[...x]` exige au moins un segment", () => {
		expect(motifAccepte("/docs/[...path]", "/docs")).toBe(false);
		expect(motifAccepte("/docs/[...path]", "/docs/a")).toBe(true);
	});

	test("ignore la query string", () => {
		expect(routeExiste(["/search"], "/search?q=axel")).toBe(true);
	});
});

describe("inventaire des routes", () => {
	for (const { nom, app } of APPS) {
		test(`${nom} : l'arborescence app/ est lisible et non vide`, () => {
			expect(existsSync(app)).toBe(true);
			const motifs = listerMotifsRoutes(app);
			expect(motifs.length).toBeGreaterThan(50);
			// Les route groups ne doivent jamais fuiter dans une URL.
			expect(motifs.filter((m) => m.includes("("))).toEqual([]);
		});
	}
});

/**
 * Non-régression des liens : chaque entrée cliquable du menu doit correspondre à
 * une route réelle. C'est ce test qui a révélé que `/settings` et
 * `/dashboard/settings` étaient des 404 côté website alors que la barre latérale
 * et le clic sur l'avatar y menaient.
 */
describe("aucune entrée de menu ne mène à un 404", () => {
	for (const { nom, app, bases } of APPS) {
		const motifs = listerMotifsRoutes(app);
		const nav = construireNavigation(bases);

		test(`${nom} : navigation principale`, () => {
			const morts = cheminsCliquables(nav.navigationItems).filter((c) => !routeExiste(motifs, c));
			expect(morts).toEqual([]);
		});

		test(`${nom} : navigation mobile`, () => {
			const morts = cheminsCliquables(nav.mobileNavItems).filter((c) => !routeExiste(motifs, c));
			expect(morts).toEqual([]);
		});

		test(`${nom} : administration`, () => {
			const morts = cheminsCliquables(nav.dashboardItems).filter((c) => !routeExiste(motifs, c));
			expect(morts).toEqual([]);
		});
	}
});
