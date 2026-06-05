/**
 * Constantes Steam pour le plugin Better Auth « steam ».
 *
 * Ancré sur du réel :
 * - App ID IEVR validé dans `iecode/src/IECODE.Core/IEVRConstants.cs` (`STEAM_APP_ID = 2799860`).
 *   ⚠️ `3593770` est un decoy (collision de nom "Victory Road") — ne JAMAIS l'utiliser.
 * - Endpoint OpenID 2.0 Steam : https://steamcommunity.com/openid/login
 *   (Steam est un OpenID 2.0 *provider*, PAS OAuth2/OIDC — cf. partner.steamgames.com/doc/webapi/auth).
 * - Steam Web API : api.steampowered.com (hôte public, par opposition à partner.steam-api.com
 *   qui exige une clé "publisher").
 */

/** App ID Steam d'Inazuma Eleven Victory Road (LEVEL5). Source de vérité : IEVRConstants.cs. */
export const IEVR_STEAM_APP_ID = 2799860 as const;

/** Endpoint OpenID 2.0 de Steam (redirection utilisateur + vérification d'assertion). */
export const STEAM_OPENID_ENDPOINT = "https://steamcommunity.com/openid/login" as const;

/** Namespace OpenID 2.0 (constant, défini par la spec OpenID Authentication 2.0). */
export const OPENID_NS = "http://specs.openid.net/auth/2.0" as const;

/**
 * Identifiant OpenID 2.0 « identifier_select » : on laisse Steam choisir l'identité
 * (le SteamID de l'utilisateur connecté). C'est la valeur attendue par Steam pour
 * `openid.identity` et `openid.claimed_id` dans la requête `checkid_setup`.
 */
export const OPENID_IDENTIFIER_SELECT =
	"http://specs.openid.net/auth/2.0/identifier_select" as const;

/**
 * Préfixe du `claimed_id` renvoyé par Steam après auth réussie.
 * Format : https://steamcommunity.com/openid/id/<steamid64>
 */
export const STEAM_OPENID_CLAIMED_ID_PREFIX =
	"https://steamcommunity.com/openid/id/" as const;

/** Hôte public de la Steam Web API. */
export const STEAM_WEB_API_HOST = "https://api.steampowered.com" as const;

/** providerId Better Auth utilisé pour les comptes liés via Steam. */
export const STEAM_PROVIDER_ID = "steam" as const;

/**
 * Extrait le SteamID64 d'un `claimed_id` Steam.
 * Renvoie `null` si l'URL ne correspond pas au format attendu (anti-spoof basique :
 * la vérification cryptographique réelle est faite via `check_authentication`).
 */
export function extractSteamId64(claimedId: string | undefined | null): string | null {
	if (!claimedId) {
		return null;
	}
	if (!claimedId.startsWith(STEAM_OPENID_CLAIMED_ID_PREFIX)) {
		return null;
	}
	const id = claimedId.slice(STEAM_OPENID_CLAIMED_ID_PREFIX.length).trim();
	// Un SteamID64 est un entier 64 bits décimal (17 chiffres usuels).
	return /^\d{2,20}$/.test(id) ? id : null;
}
