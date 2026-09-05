import { describe, expect, test } from "bun:test";
import {
	enregistrerDansDepot,
	listerDansDepot,
	ouvrirDansDepot,
	supprimerDansDepot,
} from "@/app/avatar/sauvegardes";
import type { AvatarEnregistre, DepotSauvegardes, LigneSauvegarde } from "@/app/avatar/sauvegardes";

const RECETTE: AvatarEnregistre = {
	choix: { 1: "face01" },
	valeurs: { taille: 7 },
	champs: { prenom: "Azalée" },
	genre: 1,
	morphologie: 2,
};
const CODE_A = "3".repeat(69);
const CODE_B = "4".repeat(69);
const USER_A = "10000000-0000-4000-8000-000000000001";
const USER_B = "20000000-0000-4000-8000-000000000002";

class DepotMemoire implements DepotSauvegardes {
	lignes: LigneSauvegarde[] = [];
	sequence = 0;

	async compter(userId: string) {
		return this.lignes.filter((ligne) => ligne.userId === userId).length;
	}

	async inserer(ligne: Omit<LigneSauvegarde, "id" | "modifieLe">) {
		if (ligne.code && this.lignes.some((existante) => existante.code === ligne.code)) {
			return { error: { code: "23505" } };
		}
		this.sequence += 1;
		const id = `00000000-0000-4000-8000-${String(this.sequence).padStart(12, "0")}`;
		this.lignes.push({ ...ligne, id, modifieLe: new Date(this.sequence).toISOString() });
		return { id };
	}

	async lister(userId: string, limite: number) {
		return { lignes: this.lignes.filter((ligne) => ligne.userId === userId).slice(0, limite) };
	}

	async trouverParCode(code: string) {
		return { ligne: this.lignes.find((ligne) => ligne.code === code) ?? null };
	}

	async supprimer(userId: string, id: string) {
		this.lignes = this.lignes.filter((ligne) => ligne.userId !== userId || ligne.id !== id);
		return {};
	}
}

describe("persistance serveur des avatars", () => {
	test("refuse l'enregistrement et la suppression hors session", async () => {
		const depot = new DepotMemoire();
		expect((await enregistrerDansDepot(depot, null, "Avatar", RECETTE, null)).error).toContain(
			"Connecte-toi"
		);
		expect(
			(await supprimerDansDepot(depot, null, "00000000-0000-4000-8000-000000000001")).error
		).toContain("Connecte-toi");
		expect(depot.lignes).toHaveLength(0);
	});

	test("refuse une recette client mal formée avant l'écriture privilégiée", async () => {
		const depot = new DepotMemoire();
		const recetteInjectee = { ...RECETTE, genre: 4 } as AvatarEnregistre;
		expect(
			(await enregistrerDansDepot(depot, USER_A, "Injecté", recetteInjectee, null)).error
		).toContain("recette");
		expect(depot.lignes).toHaveLength(0);
	});

	test("bloque la vingt-cinquième sauvegarde d'un compte", async () => {
		const depot = new DepotMemoire();
		for (let i = 0; i < 24; i += 1) {
			expect(
				(await enregistrerDansDepot(depot, USER_A, `Avatar ${i}`, RECETTE, null)).id
			).toBeTruthy();
		}
		expect((await enregistrerDansDepot(depot, USER_A, "Avatar 25", RECETTE, null)).error).toContain(
			"24"
		);
		expect(depot.lignes).toHaveLength(24);
	});

	test("signale un code de partage en doublon", async () => {
		const depot = new DepotMemoire();
		expect((await enregistrerDansDepot(depot, USER_A, "A", RECETTE, CODE_A)).id).toBeTruthy();
		expect((await enregistrerDansDepot(depot, USER_B, "B", RECETTE, CODE_A)).error).toContain(
			"déjà partagé"
		);
	});

	test("isole la liste et la suppression entre deux comptes", async () => {
		const depot = new DepotMemoire();
		const a = await enregistrerDansDepot(depot, USER_A, "Privé A", RECETTE, null);
		await enregistrerDansDepot(depot, USER_B, "Privé B", RECETTE, CODE_B);
		expect((await listerDansDepot(depot, USER_A)).avatars?.map(({ nom }) => nom)).toEqual([
			"Privé A",
		]);
		await supprimerDansDepot(depot, USER_B, a.id!);
		expect((await listerDansDepot(depot, USER_A)).avatars).toHaveLength(1);
	});

	test("ouvre un code valide et refuse longueur ou alphabet invalides", async () => {
		const depot = new DepotMemoire();
		await enregistrerDansDepot(depot, USER_A, "Partagé", RECETTE, CODE_A);
		expect(await ouvrirDansDepot(depot, CODE_A)).toMatchObject({ nom: "Partagé", avatar: RECETTE });
		expect((await ouvrirDansDepot(depot, "3".repeat(68))).error).toContain("pas valide");
		expect((await ouvrirDansDepot(depot, `${"3".repeat(68)}O`)).error).toContain("pas valide");
	});

	test("ne renvoie pas au navigateur une recette corrompue en base", async () => {
		const depot = new DepotMemoire();
		await enregistrerDansDepot(depot, USER_A, "Partagé", RECETTE, CODE_A);
		depot.lignes[0]!.donnees = { ...RECETTE, morphologie: 99 };
		expect((await ouvrirDansDepot(depot, CODE_A)).error).toContain("recette");
	});
});
