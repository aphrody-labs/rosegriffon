/**
 * VERDICT D'UNE RÉPONSE oEMBED — logique PURE.
 *
 * Séparé de `oembed.ts` (qui interroge Meta et porte `import "server-only"`)
 * pour UNE raison : `server-only` n'est fourni qu'au moment du bundle par Next,
 * donc un test qui importe le module serveur échoue sur « Cannot find package
 * 'server-only' ». Or c'est précisément cette fonction qui mérite d'être testée :
 * elle décide si le dépôt d'un membre est accepté, et se tromper de sens refuse
 * des créations légitimes en silence.
 */

/** Verdict de la vérification. `null` = on n'a pas pu conclure. */
export type VerdictPublication = "publique" | "introuvable" | "indeterminee";

export interface VerificationInstagram {
	verdict: VerdictVerification;
	/** Message destiné au déposant, en français, sans jargon d'API. */
	message: string;
}

type VerdictVerification = VerdictPublication;

/**
 * Traduit une réponse oEmbed en verdict.
 *
 * PURE et exportée pour être testée sans réseau : c'est la fonction qui décide
 * si le dépôt d'un membre est accepté, et se tromper de sens ici refuserait des
 * créations légitimes en silence.
 *
 * ⚠ UN ÉCHEC RÉSEAU N'EST PAS UN REFUS. Si Meta est injoignable ou rend un 5xx,
 * le verdict est `indeterminee` et le dépôt PASSE : refuser une création parce
 * que notre vérification est en panne ferait payer au participant une panne qui
 * n'est pas la sienne. Le staff voit la ligne arriver dans son salon de suivi et
 * tranche — c'est à ça que sert le relais.
 */
export function verdictDepuisReponse(
	statut: number,
	corps: unknown
): VerificationInstagram {
	if (statut === 200) {
		return { message: "Publication vérifiée.", verdict: "publique" };
	}

	// Meta encode la cause dans `error.code` / `error.error_subcode`. Le 400 seul
	// ne suffit pas : il couvre aussi une URL mal formée de notre côté.
	const erreur =
		typeof corps === "object" && corps !== null
			? ((corps as { error?: { code?: number; error_subcode?: number } }).error ?? {})
			: {};

	if (statut === 400 && (erreur.code === 24 || erreur.error_subcode === 2207045)) {
		return {
			message:
				"Instagram ne trouve pas cette publication. Vérifie le lien, et que ton compte n'est pas en privé.",
			verdict: "introuvable",
		};
	}

	if (statut === 400 || statut === 404) {
		return { message: "Ce lien n'est pas une publication Instagram valide.", verdict: "introuvable" };
	}

	return {
		message: "Instagram n'a pas répondu ; ta création est enregistrée et sera vérifiée par l'équipe.",
		verdict: "indeterminee",
	};
}
