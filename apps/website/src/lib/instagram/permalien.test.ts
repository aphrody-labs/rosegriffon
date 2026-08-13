/**
 * Tests de l'analyse d'un permalien Instagram.
 *
 * Le shortcode est la CLÉ PRIMAIRE de `campagne_creations_instagram`. Deux
 * écritures du même post doivent donc rendre la même clé, sinon un membre qui
 * redépose son lien depuis un autre appareil crée une seconde carte dans la
 * galerie. Et un shortcode inventé passe la validation de forme, puis échoue à
 * la vérification Meta, puis laisse une carte vide : mieux vaut refuser.
 *
 * ⚠ AUCUNE FIXTURE INVENTÉE : `Db_AxXAlywQ` est le shortcode RÉEL du post
 * d'annonce de la campagne, publié par `@rose_griffonfr`
 * (https://www.instagram.com/rose_griffonfr/p/Db_AxXAlywQ/).
 */

import { describe, expect, test } from "bun:test";

import { analyserPermalien, hashtagDansLegende, normaliserPseudo } from "./permalien";

const CODE = "Db_AxXAlywQ";
const CANONIQUE = `https://www.instagram.com/p/${CODE}/`;

describe("formes acceptées d'un permalien", () => {
	test("la forme canonique", () => {
		expect(analyserPermalien(CANONIQUE)).toEqual({
			permalien: CANONIQUE,
			pseudo: null,
			shortcode: CODE,
		});
	});

	test("la forme AVEC le pseudo — celle du post réel de la campagne", () => {
		expect(analyserPermalien(`https://www.instagram.com/rose_griffonfr/p/${CODE}/`)).toEqual({
			permalien: CANONIQUE,
			pseudo: "rose_griffonfr",
			shortcode: CODE,
		});
	});

	test("un reel, une vidéo IGTV", () => {
		expect(analyserPermalien(`https://www.instagram.com/reel/${CODE}/`)?.shortcode).toBe(CODE);
		expect(analyserPermalien(`https://www.instagram.com/tv/${CODE}/`)?.shortcode).toBe(CODE);
	});

	test("sans protocole, sans www, sans barre finale", () => {
		for (const forme of [
			`instagram.com/p/${CODE}`,
			`https://instagram.com/p/${CODE}`,
			`  https://www.instagram.com/p/${CODE}/  `,
		]) {
			expect(analyserPermalien(forme)?.shortcode).toBe(CODE);
		}
	});

	test("le jeton de traçage `igsh` est RETIRÉ du permalien conservé", () => {
		// Il identifie le partageur, pas la publication : le garder stockerait une
		// donnée de pistage, et deux membres partageant le même post créeraient
		// deux lignes au lieu d'une.
		const r = analyserPermalien(`https://www.instagram.com/p/${CODE}/?igsh=MzRlODBiNWFlZA%3D%3D`);
		expect(r?.permalien).toBe(CANONIQUE);
		expect(r?.permalien).not.toContain("igsh");
	});

	test("deux écritures du même post donnent le MÊME permalien canonique", () => {
		const a = analyserPermalien(`https://www.instagram.com/rose_griffonfr/p/${CODE}/?igsh=abc`);
		const b = analyserPermalien(`instagram.com/p/${CODE}`);
		expect(a?.permalien).toBe(b?.permalien!);
		expect(a?.shortcode).toBe(b?.shortcode!);
	});
});

describe("ce qui est refusé", () => {
	test("un profil n'est pas une publication", () => {
		expect(analyserPermalien("https://www.instagram.com/rose_griffonfr/")).toBeNull();
	});

	test("un autre domaine, même s'il contient le mot instagram", () => {
		expect(analyserPermalien(`https://instagram.com.pirate.example/p/${CODE}/`)).toBeNull();
		expect(analyserPermalien(`https://x.com/p/${CODE}/`)).toBeNull();
	});

	test("un shortcode absent ou hors gabarit", () => {
		expect(analyserPermalien("https://www.instagram.com/p/")).toBeNull();
		expect(analyserPermalien("https://www.instagram.com/p/ab/")).toBeNull(); // trop court
		expect(analyserPermalien("https://www.instagram.com/p/" + "a".repeat(40))).toBeNull();
		expect(analyserPermalien("https://www.instagram.com/p/avec espace/")).toBeNull();
	});

	test("du texte quelconque, du vide", () => {
		expect(analyserPermalien("mon dessin")).toBeNull();
		expect(analyserPermalien("")).toBeNull();
		expect(analyserPermalien("   ")).toBeNull();
	});
});

describe("normalisation du pseudo", () => {
	test("les trois écritures d'un même compte convergent", () => {
		for (const forme of [
			"rose_griffonfr",
			"@rose_griffonfr",
			"https://www.instagram.com/rose_griffonfr/",
			"  @rose_griffonfr  ",
		]) {
			expect(normaliserPseudo(forme)).toBe("rose_griffonfr");
		}
	});

	test("un pseudo impossible rend null plutôt qu'un pseudo faux", () => {
		// La galerie sait afficher « auteur inconnu » ; elle ne sait pas rattraper
		// une attribution erronée.
		expect(normaliserPseudo("")).toBeNull();
		expect(normaliserPseudo("a b c")).toBeNull();
		expect(normaliserPseudo("é".repeat(5))).toBeNull();
		expect(normaliserPseudo(null)).toBeNull();
		expect(normaliserPseudo(undefined)).toBeNull();
	});
});

describe("hashtag dans la légende", () => {
	const HASHTAGS = ["iergday", "inazumargday"];

	test("la graphie exacte apparie", () => {
		expect(hashtagDansLegende("Mon OC #IERGDay !", HASHTAGS)).toBe("iergday");
	});

	test("la casse et le tiret bas ne comptent pas", () => {
		expect(hashtagDansLegende("#IERG_DAY", HASHTAGS)).toBe("iergday");
	});

	test("un hashtag étranger n'apparie pas", () => {
		expect(hashtagDansLegende("#InazumaEleven #fanart", HASHTAGS)).toBeNull();
	});

	test("une légende vide ou sans hashtag n'apparie rien", () => {
		// Le dépôt reste possible sans hashtag — le rattachement vient alors du
		// formulaire lui-même, exactement comme un dépôt dans le salon Discord.
		expect(hashtagDansLegende("Voici mon OC", HASHTAGS)).toBeNull();
		expect(hashtagDansLegende("", HASHTAGS)).toBeNull();
	});
});
