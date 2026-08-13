/**
 * Tests du verdict rendu par l'oEmbed de Meta.
 *
 * Cette fonction décide si le dépôt d'un membre est accepté. Se tromper de sens
 * refuse en silence des créations légitimes — et personne ne le saura, puisque
 * le participant croira simplement que « ça n'a pas marché ».
 *
 * ⚠ AUCUNE FIXTURE INVENTÉE : les formes ci-dessous sont celles observées le
 * 13/8/2026 sur `graph.facebook.com/v23.0/instagram_oembed` — 200 sur le post
 * réel de la campagne, 400 / code 24 / subcode 2207045 sur un shortcode
 * inexistant.
 */

import { describe, expect, test } from "bun:test";

import { verdictDepuisReponse } from "./oembed-shared";

/** La réponse réelle de Meta sur un shortcode qui n'existe pas. */
const MEDIA_INTROUVABLE = {
	error: {
		code: 24,
		error_subcode: 2207045,
		message: "Media Not Found",
		type: "OAuthException",
	},
};

describe("publication vérifiée", () => {
	test("un 200 vaut « publique »", () => {
		const r = verdictDepuisReponse(200, { provider_name: "Instagram", type: "rich" });
		expect(r.verdict).toBe("publique");
	});
});

describe("publication refusée", () => {
	test("le code 24 de Meta = introuvable, supprimée ou compte privé", () => {
		const r = verdictDepuisReponse(400, MEDIA_INTROUVABLE);
		expect(r.verdict).toBe("introuvable");
		// Le message parle au déposant, jamais en jargon d'API : « code 24 » ne lui
		// dit pas quoi faire, « ton compte est peut-être en privé » si.
		expect(r.message).toContain("privé");
		expect(r.message).not.toContain("24");
	});

	test("un 400 sans code Meta reste un refus", () => {
		expect(verdictDepuisReponse(400, {}).verdict).toBe("introuvable");
		expect(verdictDepuisReponse(404, null).verdict).toBe("introuvable");
	});
});

describe("vérification impossible", () => {
	test("UNE PANNE DE META N'EST PAS UN REFUS", () => {
		// Refuser une création parce que NOTRE vérification est en panne ferait
		// payer au participant une panne qui n'est pas la sienne. Le dépôt passe,
		// et le staff tranche depuis son salon de suivi.
		for (const statut of [500, 502, 503, 429]) {
			expect(verdictDepuisReponse(statut, null).verdict).toBe("indeterminee");
		}
	});

	test("un corps illisible ne fait pas basculer le verdict", () => {
		expect(verdictDepuisReponse(500, "pas du json").verdict).toBe("indeterminee");
		expect(verdictDepuisReponse(200, undefined).verdict).toBe("publique");
	});

	test("le message d'attente promet une vérification humaine, pas un succès", () => {
		const r = verdictDepuisReponse(503, null);
		expect(r.message).toContain("équipe");
	});
});
