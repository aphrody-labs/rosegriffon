import { describe, expect, test } from "bun:test";
import jwt from "jsonwebtoken";

import {
	AUDIENCE_SESSION_ACHILLEA,
	EMETTEUR_ACHILLEA,
	signerJetonAchillea,
} from "./jeton";

const SECRET = "secret-de-test-uniquement";

/**
 * Le jeton est signé ici et vérifié LÀ-BAS. Ce test fait tourner le vérificateur
 * réel du bot (`jsonwebtoken`, mêmes options que
 * `apps/achillea-bot/src/auth/session.ts`) sur notre signature maison : si l'un
 * des deux dérive, c'est ici que ça casse, pas en production sur une session qui
 * refuse de s'ouvrir.
 */
describe("signerJetonAchillea", () => {
	test("produit un jeton que le vérificateur du bot accepte", () => {
		const jeton = signerJetonAchillea({ id: "123456789", username: "testeur" }, SECRET);

		const charge = jwt.verify(jeton, SECRET, {
			algorithms: ["HS256"],
			audience: AUDIENCE_SESSION_ACHILLEA,
			issuer: EMETTEUR_ACHILLEA,
		}) as Record<string, unknown>;

		expect(charge.id).toBe("123456789");
		expect(charge.sub).toBe("123456789");
		expect(charge.username).toBe("testeur");
		expect(charge.tokenUse).toBe("session");
	});

	test("`id` et `sub` sont toujours égaux", () => {
		// Le bot lève « Token identity mismatch » quand ils diffèrent.
		const jeton = signerJetonAchillea({ id: "42" }, SECRET);
		const charge = JSON.parse(
			Buffer.from(jeton.split(".")[1]!, "base64url").toString()
		) as Record<string, unknown>;
		expect(charge.id).toBe(charge.sub);
	});

	test("omet les champs absents plutôt que d'envoyer null", () => {
		const jeton = signerJetonAchillea({ id: "42", avatar: null, username: null }, SECRET);
		const charge = JSON.parse(
			Buffer.from(jeton.split(".")[1]!, "base64url").toString()
		) as Record<string, unknown>;
		expect("username" in charge).toBe(false);
		expect("avatar" in charge).toBe(false);
	});

	test("refuse de signer sans identifiant Discord", () => {
		expect(() => signerJetonAchillea({ id: "" }, SECRET)).toThrow();
	});

	test("une signature faite avec un autre secret est rejetée", () => {
		const jeton = signerJetonAchillea({ id: "42" }, "autre-secret");
		expect(() => jwt.verify(jeton, SECRET, { algorithms: ["HS256"] })).toThrow();
	});
});
