import { createHmac } from "node:crypto";

/**
 * Signature du jeton de session Achilléa.
 *
 * Le format n'est pas négociable : il est lu par
 * `apps/achillea-bot/src/auth/session.ts`, qui le vérifie avec `jsonwebtoken`
 * en exigeant `HS256`, l'émetteur `achillea` et l'audience `achillea-web`, et
 * qui REFUSE un jeton dont `id` et `sub` diffèrent. Un module à part, plutôt
 * qu'une fonction enfouie dans la route, pour que ce contrat soit testable sans
 * base ni session.
 *
 * `jsonwebtoken` n'est pas ajouté aux dépendances du site pour autant : c'est
 * une dépendance du bot, et trois lignes de `node:crypto` suffisent à produire
 * exactement le même jeton.
 */

export const EMETTEUR_ACHILLEA = "achillea";
export const AUDIENCE_SESSION_ACHILLEA = "achillea-web";
export const COOKIE_SESSION_ACHILLEA = "token";
export const DUREE_SESSION_ACHILLEA_SECONDES = 30 * 24 * 60 * 60;

export interface IdentiteAchillea {
	/** Identifiant Discord — c'est la clé primaire du joueur côté Achilléa. */
	id: string;
	username?: string | null;
	avatar?: string | null;
}

function base64url(valeur: Buffer | string): string {
	return Buffer.from(valeur)
		.toString("base64")
		.replaceAll("+", "-")
		.replaceAll("/", "_")
		.replaceAll("=", "");
}

export function signerJetonAchillea(
	identite: IdentiteAchillea,
	secret: string,
	maintenant = Math.floor(Date.now() / 1000)
): string {
	if (!identite.id) {
		throw new Error("Impossible de signer un jeton Achilléa sans identifiant Discord");
	}

	const charge = {
		id: identite.id,
		...(identite.username ? { username: identite.username } : {}),
		...(identite.avatar ? { avatar: identite.avatar } : {}),
		tokenUse: "session",
		sub: identite.id,
		iss: EMETTEUR_ACHILLEA,
		aud: AUDIENCE_SESSION_ACHILLEA,
		iat: maintenant,
		exp: maintenant + DUREE_SESSION_ACHILLEA_SECONDES,
	};

	const entete = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
	const corps = base64url(JSON.stringify(charge));
	const signature = base64url(createHmac("sha256", secret).update(`${entete}.${corps}`).digest());
	return `${entete}.${corps}.${signature}`;
}
