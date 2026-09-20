import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, test } from "bun:test";

const RACINE = join(import.meta.dir, "../../..");
const AZALEE = join(RACINE, "apps/azalee/components");
const WEBSITE = join(RACINE, "apps/website/src/components");

/**
 * Le wiki Azalée est servi par DEUX apps : à la racine d'`azalee.rosegriffon.fr`
 * et sous `/wiki` de `rosegriffon.fr`. Les composants qui le rendent — barre
 * latérale, barre d'application, pied de page, fiches, éditeur — existent donc
 * en deux exemplaires, et la seule garantie qu'ils restent interchangeables est
 * qu'ils soient IDENTIQUES.
 *
 * Ils avaient déjà dérivé : une barre latérale qui ne reconnaissait pas la
 * racine d'administration de l'autre app, un `useLanguage` qui levait au lieu de
 * retomber sur le français, un jeton de couleur inexistant d'un seul côté. Ce
 * test fige la synchronisation.
 */

/**
 * Divergences assumées, avec la raison. Toute autre différence fait échouer le
 * test : c'est une dérive, pas une adaptation.
 */
const DIVERGENCES_ASSUMEES = new Map<string, string>([
	[
		"dashboard/news-actions.tsx",
		"l'import d'actions serveur suit la racine d'administration de chaque app (/dashboard vs /admin)",
	],
	["home/WikiCarousel.tsx", "bloc de page d'accueil, propre à chaque site"],
	["home/AchilleaBanner.tsx", "bloc de page d'accueil, propre à chaque site"],
	["home/RgtvBanner.tsx", "bloc de page d'accueil, propre à chaque site"],
	[
		"AdSenseGate.tsx",
		"Azalée ne possède plus les surfaces plein écran migrées vers niers, contrairement au portail historique",
	],
	[
		"wiki/AuraDetail.tsx",
		"Azalée conserve la fiche de données sans le viewer 3D, désormais détenu par niers",
	],
	[
		"wiki/CharaAssetsSection.tsx",
		"Azalée conserve les voix du wiki sans les modèles 3D, désormais détenus par niers",
	],
	[
		"wiki/CharacterSheet.tsx",
		"Azalée ne propose plus de lien vers le comparateur retiré avec les outils niers",
	],
	[
		"wiki/CharacterTable.tsx",
		"Azalée ne charge plus le viewer 3D depuis les tableaux de personnages du wiki",
	],
]);

function listerFichiers(racine: string): string[] {
	const sortie: string[] = [];
	const visiter = (dossier: string) => {
		for (const entree of readdirSync(dossier)) {
			const chemin = join(dossier, entree);
			if (statSync(chemin).isDirectory()) {
				visiter(chemin);
			} else {
				sortie.push(relative(racine, chemin));
			}
		}
	};
	visiter(racine);
	return sortie.sort();
}

const FICHIERS_AZALEE = listerFichiers(AZALEE);
const PARTAGES = FICHIERS_AZALEE.filter((f) => {
	try {
		return statSync(join(WEBSITE, f)).isFile();
	} catch {
		return false;
	}
});

describe("chrome partagé entre azalee et website", () => {
	test("les deux apps partagent bien un gros socle de composants", () => {
		// Garde-fou du garde-fou : si quelqu'un déplace un des deux arbres, le
		// test ne doit pas se mettre à passer en ne comparant plus rien.
		expect(PARTAGES.length).toBeGreaterThan(150);
	});

	test("les pièces du chrome existent des deux côtés sous le même nom", () => {
		for (const piece of [
			"Shell.tsx",
			"wiki-sidebar.tsx",
			"layout/AzaleeFooter.tsx",
			"navigation/MaterialBottomNav.tsx",
			"navigation/AzaleeNavigationRail.tsx",
			"accessibility/SkipToContent.tsx",
			"providers/language-provider.tsx",
			"providers/AuthProvider.tsx",
		]) {
			expect(PARTAGES).toContain(piece);
		}
	});

	test("aucun composant partagé n'a dérivé", () => {
		const derives = PARTAGES.filter((f) => {
			if (DIVERGENCES_ASSUMEES.has(f)) {
				return false;
			}
			return readFileSync(join(AZALEE, f), "utf8") !== readFileSync(join(WEBSITE, f), "utf8");
		});
		expect(derives).toEqual([]);
	});

	test("chaque divergence assumée est réelle et documentée", () => {
		for (const [fichier, raison] of DIVERGENCES_ASSUMEES) {
			expect(raison.length).toBeGreaterThan(20);
			expect(PARTAGES).toContain(fichier);
			// Une entrée de la liste qui ne diverge plus doit en sortir, sinon la
			// liste enfle et finit par couvrir de vraies dérives.
			expect(readFileSync(join(AZALEE, fichier), "utf8")).not.toBe(
				readFileSync(join(WEBSITE, fichier), "utf8")
			);
		}
	});
});
