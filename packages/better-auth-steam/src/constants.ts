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

/* -------------------------------------------------------------------------- */
/* Identité Steam IEVR — extrait de nie.exe (RE) + appmanifest_2799860.acf.    */
/* Données ancrées sur le réel (RE de nie.exe, validées sur un compte réel).   */
/* Source workflow : reRes axes app/achievements/ticket-cloud.                 */
/* -------------------------------------------------------------------------- */

/**
 * Identifiants Steam IEVR « catalogue ».
 *
 * Sources :
 * - appId        : appmanifest_2799860.acf + nie.exe func_const 0x140ef27c0/0x140ef2610.
 * - buildId      : appmanifest_2799860.acf (build installé au moment du dump).
 * - depotBase    : appmanifest InstalledDepots (depot principal du contenu jeu).
 * - manifestId   : appmanifest depot 2799861 (manifeste de contenu du depot base).
 * - publisher    : nie.exe .text 0x174a690 ("LEVEL5 Inc.").
 * - pdbPath      : nie.exe .rdata 0x1857968 (chemin de build du PDB, trace de l'éditeur).
 */
export const IEVR_STEAM = {
	appId: 2799860,
	appName: "INAZUMA ELEVEN: Victory Road",
	buildId: 22792000,
	/** Depot de contenu principal (base game). */
	depotBase: 2799861,
	/** Manifeste de contenu du depot base (au moment du dump RE). */
	manifestId: "1147708054852059036",
	publisher: "LEVEL5 Inc.",
	pdbPath: "G:\\nie1v2\\program\\main\\program\\SteamRelease\\x64\\nie.pdb",
} as const;

/**
 * Shared depots EA (Easy Anti-Cheat) déclarés dans `SharedDepots` de l'appmanifest.
 * Les 4 depots EAC référencés pointent tous vers l'app partagée 228980 (Steamworks Common Redistributables).
 * Source : appmanifest_2799860.acf SharedDepots.
 */
export const IEVR_SHARED_DEPOTS = {
	/** App partagée cible (Steamworks Common Redistributables, "EA" = EAC). */
	target: 228980,
	/** Depots locaux mappés vers la cible 228980. */
	depots: [228989, 228990, 229000, 229007] as const,
} as const;

/**
 * Versions d'interfaces Steamworks effectivement liées par nie.exe (chaînes `CreateInterface`).
 * Source : nie.exe .rdata (offsets entre parenthèses). Utile pour reproduire fidèlement
 * le comportement client (ex. SteamUserStats v013 pour les succès, RemoteStorage v016 pour le Cloud).
 */
export const IEVR_STEAM_INTERFACES = {
	SteamUser: "SteamUser023",
	SteamUserStats: "STEAMUSERSTATS_INTERFACE_VERSION013",
	SteamApps: "STEAMAPPS_INTERFACE_VERSION008",
	SteamRemoteStorage: "STEAMREMOTESTORAGE_INTERFACE_VERSION016",
	SteamFriends: "SteamFriends018",
	SteamUtils: "SteamUtils010",
	SteamInput: "SteamInput006",
	SteamController: "SteamController008",
	SteamUGC: "STEAMUGC_INTERFACE_VERSION021",
	SteamHTTP: "STEAMHTTP_INTERFACE_VERSION003",
	SteamInventory: "STEAMINVENTORY_INTERFACE_V003",
	SteamHTMLSurface: "STEAMHTMLSURFACE_INTERFACE_VERSION_005",
	SteamVideo: "STEAMVIDEO_INTERFACE_V007",
	SteamRemotePlay: "STEAMREMOTEPLAY_INTERFACE_VERSION003",
	SteamScreenshots: "STEAMSCREENSHOTS_INTERFACE_VERSION003",
	SteamMusicRemote: "STEAMMUSICREMOTE_INTERFACE_VERSION001",
	SteamMusic: "STEAMMUSIC_INTERFACE_VERSION001",
	SteamParentalSettings: "STEAMPARENTALSETTINGS_INTERFACE_VERSION001",
	SteamMatchMaking: "SteamMatchMaking009",
	SteamMatchMakingServers: "SteamMatchMakingServers002",
	SteamMatchGameSearch: "SteamMatchGameSearch001",
	SteamNetworking: "SteamNetworking006",
	SteamNetworkingMessages: "SteamNetworkingMessages002",
	SteamNetworkingSockets: "SteamNetworkingSockets012",
	SteamNetworkingUtils: "SteamNetworkingUtils004",
	SteamParties: "SteamParties002",
} as const;

/**
 * Features Steamworks effectivement utilisées par nie.exe (présence d'imports / RTTI / classes).
 * Source : nie.exe imports + RTTI (classes `C*ControllerSteam`, `CSteamCallbacks`, etc.).
 */
export const IEVR_STEAM_FEATURES = {
	/** SteamEncryptedAppTicket (BDecryptTicket/BIsTicketForApp/GetTicketSteamID). Déchiffrement côté serveur uniquement. */
	encryptedAppTicket: true,
	/** GetTicketForWebApiResponse_t — ticket pour authentification d'API web tierce. */
	webApiTicket: true,
	/** Sauvegarde Steam Cloud (CSaveControllerSteam, RemoteStorageFileRead/WriteAsync). */
	cloudSave: true,
	/** Steam Workshop (UGC v021). */
	workshop: true,
	/** DLC via CAddContentControllerSteam + add_content_config.cfg.bin (dans CPK chiffré). */
	dlc: true,
	/** Support Steam Deck (police gaiji dédiée + check IsSteamPlatform). */
	steamDeck: true,
} as const;

/**
 * Patron de nom d'API Steam des succès, tel qu'embarqué dans nie.exe.
 * Source : nie.exe .rdata 0x17439d0 (format string `ACHIEVEMENT_%04u`).
 * Le numéro `%04u` provient de `TROPHY_INFO_N.int[1]` (champ `num`) du trophy_config.
 */
export const IEVR_ACHIEVEMENT_API_NAME_FORMAT = "ACHIEVEMENT_%04u" as const;

/** Préfixe littéral des noms d'API de succès (`ACHIEVEMENT_`). */
export const IEVR_ACHIEVEMENT_API_NAME_PREFIX = "ACHIEVEMENT_" as const;

/**
 * Nombre de succès internes (trophées) définis dans le trophy_config (`TROPHY_INFO_N`).
 * Source : trophy_config_0.00.00.00.cfg.bin (230 entrées, nums 1..1051).
 * ⚠️ Steam n'expose qu'un sous-ensemble *visible* (~52 succès mesurés sur un compte réel) ;
 * les 230 internes incluent des compteurs/jalons non publiés en succès Steam.
 */
export const IEVR_TROPHY_COUNT = 230 as const;

/**
 * Nombre de succès Steam *visibles* (schéma public de l'app), mesuré sur un compte réel.
 * Source : compte réel (41/52 débloqués au moment de la mesure).
 */
export const IEVR_VISIBLE_ACHIEVEMENT_COUNT = 52 as const;

/**
 * Construit le nom d'API Steam d'un succès à partir de son numéro interne (`TROPHY_INFO_N.int[1]`).
 * Reproduit `ACHIEVEMENT_%04u` (padding 4 chiffres minimum, sans troncature au-delà).
 *
 * @example achievementApiName(1) // "ACHIEVEMENT_0001"
 * @example achievementApiName(1051) // "ACHIEVEMENT_1051"
 */
export function achievementApiName(num: number): string {
	if (!Number.isInteger(num) || num < 0) {
		throw new RangeError(`achievementApiName: numéro de succès invalide (${num}).`);
	}
	return `${IEVR_ACHIEVEMENT_API_NAME_PREFIX}${String(num).padStart(4, "0")}`;
}

/**
 * Extrait le numéro interne d'un nom d'API Steam (`ACHIEVEMENT_NNNN` → `NNNN`).
 * Renvoie `null` si la chaîne ne suit pas le format attendu.
 */
export function achievementNumFromApiName(apiName: string | null | undefined): number | null {
	if (!apiName || !apiName.startsWith(IEVR_ACHIEVEMENT_API_NAME_PREFIX)) {
		return null;
	}
	const rest = apiName.slice(IEVR_ACHIEVEMENT_API_NAME_PREFIX.length);
	if (!/^\d+$/.test(rest)) {
		return null;
	}
	return Number.parseInt(rest, 10);
}

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
