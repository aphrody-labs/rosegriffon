/**
 * Ce qui est vérifié ici : les badges du profil, et le piège qu'ils tendent à
 * chaque fois que le catalogue change.
 */
import { describe, expect, test } from "bun:test";

import {
	BADGES_PROFIL,
	filtrerBadges,
	MAX_BADGES_PROFIL,
	SchemaLienPublic,
	SchemaProfilPublic,
} from "./profil";

const BASE = {
	badges: [] as string[],
	bio: "",
	full_name: "",
	twitter_handle: "",
	username: "coach",
	website: "",
};

describe("badges", () => {
	test("les quatre éléments du jeu, et eux seuls", () => {
		expect([...BADGES_PROFIL]).toEqual(["fire", "wind", "forest", "mountain"]);
	});

	test("un badge d'un ancien catalogue est écarté, pas refusé", () => {
		// Cinq comptes portaient « staff », « founder », « vip » ou « beta » quand
		// les badges sont devenus les éléments. Un refus aurait rendu LEUR
		// formulaire inutilisable, sur un champ qu'ils ne voient plus.
		const resultat = SchemaProfilPublic.safeParse({
			...BASE,
			badges: ["staff", "fire", "founder"],
		});
		expect(resultat.success).toBe(true);
		expect(resultat.success && resultat.data.badges).toEqual(["fire"]);
	});

	test("on ne porte pas plus de trois badges", () => {
		const resultat = SchemaProfilPublic.safeParse({
			...BASE,
			badges: ["fire", "wind", "forest", "mountain"],
		});
		expect(resultat.success).toBe(false);
		expect(MAX_BADGES_PROFIL).toBe(3);
	});

	test("plus aucun badge ne se mérite — mais la garde reste opérante", () => {
		// Le jour où un badge redira quelque chose de vérifiable, c'est cette
		// fonction qui le tiendra ; le test la garde vivante en attendant.
		expect(
			filtrerBadges(["fire", "wind"], { dejaPoses: [], estMecene: false, estStaff: false })
		).toEqual(["fire", "wind"]);
	});
});

describe("lien public", () => {
	test("http et https passent", () => {
		expect(SchemaLienPublic.safeParse("https://rosegriffon.fr").success).toBe(true);
		expect(SchemaLienPublic.safeParse("http://exemple.fr").success).toBe(true);
	});

	test("javascript: est refusé — il finissait en href sur le profil public", () => {
		// `z.string().url()` l'accepte : c'est une URL valide au sens de la norme.
		expect(SchemaLienPublic.safeParse("javascript:alert(1)").success).toBe(false);
		expect(SchemaLienPublic.safeParse("data:text/html,<script>").success).toBe(false);
	});
});
