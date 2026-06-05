/**
 * Implémentation minimale du *Relying Party* OpenID 2.0 pour Steam.
 *
 * Pourquoi OpenID 2.0 et PAS OAuth2/OIDC ?
 * -----------------------------------------
 * Steam n'expose **pas** d'OAuth2 ni d'OpenID Connect public pour le login web tiers.
 * Le seul mécanisme officiel de « Sign in through Steam » est **OpenID 2.0**
 * (https://steamcommunity.com/openid/login). Il n'y a ni `client_id`, ni
 * `client_secret`, ni `scope`, ni `token endpoint` : Steam agit comme *OpenID
 * Provider* et renvoie uniquement un **SteamID64** vérifié. C'est pourquoi le plugin
 * Better Auth `genericOAuth` (OAuth2) ne convient pas — on implémente le flux OpenID 2.0
 * à la main, à l'image du plugin `siwe` (sign-in custom sans OAuth) du cœur Better Auth.
 *
 * Flux (OpenID 2.0 spec §9 « Requesting Authentication » + §11 « Verifying Assertions ») :
 * 1. Redirection : on envoie l'utilisateur vers Steam avec `openid.mode=checkid_setup`,
 *    `openid.identity` / `openid.claimed_id` = identifier_select, `openid.return_to`
 *    (notre callback) et `openid.realm` (notre origine).
 * 2. Retour : Steam redirige vers `return_to` avec une assertion signée (mode `id_res`).
 * 3. Vérification : on renvoie TOUS les paramètres `openid.*` reçus à Steam en remplaçant
 *    `openid.mode` par `check_authentication`. Steam répond `is_valid:true` si l'assertion
 *    est authentique. C'est la SEULE source de confiance sur le SteamID64.
 */

import {
	OPENID_IDENTIFIER_SELECT,
	OPENID_NS,
	STEAM_OPENID_ENDPOINT,
	extractSteamId64,
} from "./constants";

/**
 * Construit l'URL de redirection vers Steam (`checkid_setup`).
 *
 * @param returnTo  URL absolue de notre endpoint de callback (où Steam renverra l'assertion).
 * @param realm     Origine de confiance (scheme + host), ex. `https://rosegriffon.fr`.
 *                  `return_to` DOIT être sous ce realm (contrainte OpenID 2.0).
 */
export function buildSteamLoginUrl(returnTo: string, realm: string): string {
	const params = new URLSearchParams({
		"openid.ns": OPENID_NS,
		"openid.mode": "checkid_setup",
		"openid.return_to": returnTo,
		"openid.realm": realm,
		"openid.identity": OPENID_IDENTIFIER_SELECT,
		"openid.claimed_id": OPENID_IDENTIFIER_SELECT,
	});
	return `${STEAM_OPENID_ENDPOINT}?${params.toString()}`;
}

/**
 * Vérifie une assertion OpenID 2.0 renvoyée par Steam et retourne le SteamID64.
 *
 * Implémente le mode « direct verification » (§11.4.2) : on POST l'intégralité des
 * paramètres `openid.*` reçus, avec `openid.mode=check_authentication`, au provider.
 * Steam répond en texte clé:valeur ; `is_valid:true` atteste l'authenticité.
 *
 * Contrôles défensifs avant l'appel réseau :
 * - `openid.mode` doit valoir `id_res` (sinon : annulation / erreur).
 * - `openid.return_to` reçu doit correspondre à l'URL de callback attendue (anti-replay).
 * - le `claimed_id` doit être un vrai claimed_id Steam.
 *
 * @returns le SteamID64 (chaîne décimale) si l'assertion est valide, sinon `null`.
 */
export async function verifySteamAssertion(
	query: URLSearchParams,
	expectedReturnTo: string,
	fetchImpl: typeof fetch = fetch,
): Promise<string | null> {
	if (query.get("openid.mode") !== "id_res") {
		return null;
	}

	// Le return_to renvoyé par Steam doit matcher exactement celui qu'on a demandé.
	const returnTo = query.get("openid.return_to");
	if (!returnTo || !returnToMatches(returnTo, expectedReturnTo)) {
		return null;
	}

	const claimedId = query.get("openid.claimed_id");
	const steamId = extractSteamId64(claimedId);
	if (!steamId) {
		return null;
	}

	// Rejoue tous les champs openid.* tels quels, en forçant mode=check_authentication.
	const verify = new URLSearchParams();
	for (const [key, value] of query.entries()) {
		if (key.startsWith("openid.")) {
			verify.set(key, value);
		}
	}
	verify.set("openid.mode", "check_authentication");

	const resp = await fetchImpl(STEAM_OPENID_ENDPOINT, {
		method: "POST",
		headers: { "content-type": "application/x-www-form-urlencoded" },
		body: verify.toString(),
	});

	if (!resp.ok) {
		return null;
	}

	const text = await resp.text();
	// Réponse OpenID « Key-Value Form » (§5.1.1) : lignes `clé:valeur`.
	const isValid = text
		.split("\n")
		.map((line: string) => line.trim())
		.includes("is_valid:true");

	return isValid ? steamId : null;
}

/**
 * Compare deux URLs `return_to` en ignorant l'ordre/les query params ajoutés par Steam
 * (Steam préserve nos query params et en ajoute des `openid.*`). On exige que le
 * `return_to` reçu commence par celui attendu (même origine + chemin).
 */
function returnToMatches(received: string, expected: string): boolean {
	try {
		const r = new URL(received);
		const e = new URL(expected);
		return r.origin === e.origin && r.pathname === e.pathname;
	} catch {
		return false;
	}
}
