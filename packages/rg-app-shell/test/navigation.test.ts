import { describe, expect, test } from "bun:test";

import {
	cheminsCliquables,
	construireMobileNavUnifiee,
	construireNavigation,
	construireNavigationUnifiee,
	estItemActif,
	estRouteActive,
	parcourirNav,
	type NavItem,
} from "../src/config/navigation";
import { AZALEE_BASES, basesDepuisChemin, joindreWiki, WEBSITE_BASES } from "../src/config/routes";
import { DICTIONNAIRE_NAV_FR } from "../src/lib/translations";
import { DEFAULT_THEMES } from "../src/components/ThemeToggle";
import { THEMES } from "@rosegriffon/ui";

const azalee = construireNavigation(AZALEE_BASES);
const website = construireNavigation(WEBSITE_BASES);

describe("joindreWiki", () => {
	test("rend `/` et jamais la chaîne vide pour l'accueil sans préfixe", () => {
		// Une chaîne vide n'est pas une URL valide pour `next/link`.
		expect(joindreWiki("", "/")).toBe("/");
		expect(joindreWiki("/wiki", "/")).toBe("/wiki");
	});

	test("préfixe les routes du wiki", () => {
		expect(joindreWiki("", "/chara")).toBe("/chara");
		expect(joindreWiki("/wiki", "/chara")).toBe("/wiki/chara");
		expect(joindreWiki("/wiki", "/aura/totems")).toBe("/wiki/aura/totems");
	});

	test("tolère un préfixe terminé par une barre", () => {
		expect(joindreWiki("/wiki/", "/chara")).toBe("/wiki/chara");
	});
});

describe("estRouteActive", () => {
	test("compare par segment et non par préfixe de chaîne", () => {
		// `/modeles` commence par `/mode` sans être dedans.
		expect(estRouteActive("/modeles", "/mode")).toBe(false);
		expect(estRouteActive("/mode/menu", "/mode")).toBe(true);
	});

	test("allume un parent depuis une fiche enfant", () => {
		expect(estRouteActive("/chara/c05028001", "/chara")).toBe(true);
	});

	test("la racine n'est active que sur elle-même", () => {
		expect(estRouteActive("/", "/")).toBe(true);
		expect(estRouteActive("/chara", "/")).toBe(false);
	});
});

describe("estItemActif", () => {
	const item: NavItem = {
		children: [{ icon: "x", label: "enfant", path: "/aura/totems" }],
		groupOnly: true,
		icon: "x",
		label: "groupe",
		path: "/aura/faux-groupe",
	};

	test("un groupe sans route s'allume par ses enfants, jamais par son propre chemin", () => {
		expect(estItemActif("/aura/totems", item)).toBe(true);
		expect(estItemActif("/aura/faux-groupe", item)).toBe(false);
	});

	test("les activePaths allument l'item", () => {
		expect(
			estItemActif("/chroniques/2026", {
				activePaths: ["/chroniques"],
				icon: "x",
				label: "news",
				path: "/news",
			})
		).toBe(true);
	});
});

describe("parité azalee / website", () => {
	const aplatir = (items: NavItem[]) => parcourirNav(items).map((i) => i.label);

	test("website conserve les surfaces niers sans les réexposer sur azalee", () => {
		const labelsAzalee = aplatir(azalee.navigationItems);
		const labelsWebsite = aplatir(website.navigationItems);
		for (const label of ["nav.section.media", "nav.tools", "nav.wiki.models"]) {
			expect(labelsAzalee).not.toContain(label);
			expect(labelsWebsite).toContain(label);
		}
		expect(aplatir(azalee.mobileNavItems)).not.toContain("nav.tools");
		expect(aplatir(website.mobileNavItems)).toContain("nav.tools");
		expect(aplatir(website.dashboardItems)).toEqual(aplatir(azalee.dashboardItems));
	});

	test("chaque entrée du wiki est préfixée `/wiki` côté website", () => {
		const parLabel = new Map(parcourirNav(azalee.navigationItems).map((i) => [i.label, i.path]));
		for (const item of parcourirNav(website.navigationItems)) {
			const cheminAzalee = parLabel.get(item.label)!;
			// Les routes de service restent à la racine dans les deux apps.
			if (item.path === cheminAzalee) {
				expect(["/news", "/settings", "/search"]).toContain(item.path);
				continue;
			}
			expect(item.path.startsWith("/wiki")).toBe(true);
		}
	});

	test("aucune route de service n'est préfixée par le wiki", () => {
		const chemins = cheminsCliquables(website.navigationItems);
		expect(chemins).not.toContain("/wiki/news");
		expect(chemins).not.toContain("/wiki/settings");
		expect(chemins).toContain("/news");
		expect(chemins).toContain("/settings");
	});

	test("l'administration est enracinée différemment mais structurée pareil", () => {
		expect(cheminsCliquables(azalee.dashboardItems).every((c) => c.startsWith("/dashboard"))).toBe(
			true
		);
		expect(cheminsCliquables(website.dashboardItems).every((c) => c.startsWith("/admin"))).toBe(
			true
		);
	});
});

describe("cheminsCliquables", () => {
	test("exclut les entêtes de groupe, qui ne pointent nulle part", () => {
		for (const nav of [azalee.dashboardItems, website.dashboardItems]) {
			const chemins = cheminsCliquables(nav);
			for (const groupe of parcourirNav(nav).filter((i) => i.groupOnly)) {
				expect(chemins).not.toContain(groupe.path);
			}
		}
	});

	test("ne rend aucun chemin vide ni relatif", () => {
		for (const nav of [azalee, website]) {
			for (const items of [nav.navigationItems, nav.mobileNavItems, nav.dashboardItems]) {
				for (const chemin of cheminsCliquables(items)) {
					expect(chemin.startsWith("/")).toBe(true);
				}
			}
		}
	});
});

/**
 * Un libellé non traduit se voit : la barre latérale affiche `nav.esport.clans`
 * au lieu de « Clans ». Le dictionnaire français est le repli utilisé quand
 * aucun `LanguageProvider` n'est monté — il doit donc couvrir TOUTE entrée que
 * la navigation sait produire, sans exception.
 */
describe("dictionnaire de navigation", () => {
	test("chaque libellé du menu unifié a une traduction française", () => {
		const groupes = construireNavigationUnifiee(WEBSITE_BASES);
		const libelles = groupes.flatMap(({ item }) => [
			item.label,
			...parcourirNav(item.children ?? []).map((enfant) => enfant.label),
		]);

		const manquants = [...new Set(libelles)].filter((cle) => !(cle in DICTIONNAIRE_NAV_FR));
		expect(manquants).toEqual([]);
	});
});

/**
 * Déduction des bases depuis le chemin.
 *
 * Trois composants dépendaient d'une heuristique recopiée qui ne connaissait
 * que `/wiki` et `/admin` : une route `/achillea/**` retombait sur les bases
 * d'azalee et la barre latérale servait alors des liens wiki non préfixés —
 * des 404 produits par le menu lui-même.
 */
describe("basesDepuisChemin", () => {
	test("les routes de website rendent les bases de website", () => {
		for (const chemin of [
			"/wiki",
			"/wiki/chara",
			"/admin",
			"/admin/users",
			"/achillea",
			"/achillea/clans",
		]) {
			expect(basesDepuisChemin(chemin)).toBe(WEBSITE_BASES);
		}
	});

	test("tout le reste rend les bases d'azalee, qui sert le wiki à la racine", () => {
		for (const chemin of ["/", "/chara", "/dashboard", "/equipe"]) {
			expect(basesDepuisChemin(chemin)).toBe(AZALEE_BASES);
		}
	});

	test("compare par segment, jamais par préfixe de chaîne", () => {
		// `/wikipedia` n'est pas dans `/wiki`, `/achilleaxyz` pas dans `/achillea`.
		expect(basesDepuisChemin("/wikipedia")).toBe(AZALEE_BASES);
		expect(basesDepuisChemin("/achilleaxyz")).toBe(AZALEE_BASES);
	});
});

/**
 * Le sélecteur de thème recopiait sa liste : trois entrées contre cinq au
 * catalogue, et un identifiant `"dark"` qui ne désignait aucun thème. Azalée
 * clair et Achilléa n'étaient donc pas choisissables, alors qu'ils existent
 * dans `styles.css`. Ce test empêche la liste de redivergir.
 */
describe("sélecteur de thème", () => {
	test("propose exactement les thèmes du catalogue", () => {
		expect(DEFAULT_THEMES.map((t) => t.id).sort()).toEqual(Object.keys(THEMES).sort());
	});

	test("aucun identifiant fantôme", () => {
		for (const theme of DEFAULT_THEMES) {
			expect(Object.keys(THEMES)).toContain(theme.id);
			expect(theme.label.length).toBeGreaterThan(0);
		}
	});
});

describe("construireMobileNavUnifiee", () => {
	test("produit exactement 5 onglets pour website", () => {
		const items = construireMobileNavUnifiee(WEBSITE_BASES);
		expect(items).toHaveLength(5);
		expect(items.map((i) => i.icon)).toEqual([
			"home",
			"menu_book",
			"sports_esports",
			"search",
			"settings",
		]);
	});

	test("chaque onglet mène à un chemin valide", () => {
		const items = construireMobileNavUnifiee(WEBSITE_BASES);
		for (const item of items) {
			expect(item.path.startsWith("/")).toBe(true);
			expect(item.activePaths?.length).toBeGreaterThan(0);
		}
	});
});
