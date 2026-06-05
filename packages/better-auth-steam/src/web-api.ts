/**
 * Client Steam Web API (hôte public `api.steampowered.com`), scopé IEVR (app 2799860).
 *
 * Endpoints réels (cf. partner.steamgames.com/doc/webapi + developer.valvesoftware.com/wiki/Steam_Web_API) :
 * - ISteamUser/GetPlayerSummaries/v0002      → profil public (personaname, avatar, état).
 * - IPlayerService/GetOwnedGames/v0001       → possession + temps de jeu (filtrable par appid).
 * - ISteamUserStats/GetPlayerAchievements/v0001 → succès d'un jeu pour un joueur.
 * - ISteamUserStats/GetUserStatsForGame/v0002 → stats brutes UserGameStats (Steam Cloud côté stats).
 * - ISteamUserStats/GetSchemaForGame/v2       → schéma succès/stats (libellés, descriptions, icônes).
 *
 * ── DEUX MODES D'AUTHENTIFICATION (important) ────────────────────────────────
 * La Steam Web API distingue deux preuves d'autorisation :
 *
 *   1) `access_token` de session utilisateur (token court, émis pour le compte connecté) :
 *      - SUFFIT pour `IPlayerService/GetOwnedGames` → possession + temps de jeu, MÊME profil privé,
 *        SANS aucune clé publisher (le token prouve le consentement de l'utilisateur lui-même).
 *      - NE permet PAS `ISteamUserStats/GetPlayerAchievements` (cet endpoint ignore `access_token`
 *        et exige une `key=` publisher/Web API → sinon HTTP 403 « Access is denied »).
 *
 *   2) `key` publisher / Web API (clé du jeu ou du dev, https://steamcommunity.com/dev/apikey) :
 *      - REQUISE pour `GetPlayerAchievements` / `GetSchemaForGame` / `GetUserStatsForGame`.
 *      - Donne aussi `GetOwnedGames`, mais soumis à la visibilité du profil cible.
 *
 * On expose donc deux chemins :
 *   • `SteamWebApiClient` (avec `key`)  → succès COMPLETS + schéma + stats (mode "publisher").
 *   • `getOwnershipWithToken(token)`    → possession + playtime SEULS via `access_token` de session
 *                                          (mode "token", aucune clé requise, succès indisponibles).
 *
 * Confidentialité : GetOwnedGames / GetPlayerAchievements via `key` ne renvoient des données que
 * si le profil Steam de l'utilisateur est public. On remonte `null`/listes vides proprement quand
 * la visibilité l'interdit.
 */

import {
	achievementDisplayDescription,
	achievementDisplayName,
	type AchievementLanguage,
	IEVR_ACHIEVEMENTS_COUNT,
	type IevrAchievementInfo,
	lookupAchievement,
} from "./achievements";
import {
	IEVR_STEAM_APP_ID,
	IEVR_VISIBLE_ACHIEVEMENT_COUNT,
	STEAM_WEB_API_HOST,
} from "./constants";

/** Erreur typée du client Web API (clé manquante, réseau, statut non-OK). */
export class SteamWebApiError extends Error {
	constructor(
		public readonly reason: "missing_api_key" | "http_error" | "private_profile" | "not_owned",
		message: string,
	) {
		super(message);
		this.name = "SteamWebApiError";
	}
}

/** Profil public Steam (sous-ensemble de GetPlayerSummaries). */
export interface SteamPlayerSummary {
	steamid: string;
	personaname: string;
	profileurl: string;
	avatar: string;
	avatarmedium: string;
	avatarfull: string;
	/** 0=offline,1=online,2=busy,3=away,4=snooze,5=looking to trade,6=looking to play. */
	personastate: number;
	/** 1=private, 2=friendsonly, 3=public. */
	communityvisibilitystate: number;
	lastlogoff?: number;
}

/** Entrée GetOwnedGames (jeu possédé + temps de jeu). */
export interface SteamOwnedGame {
	appid: number;
	name?: string;
	playtime_forever: number; // minutes
	playtime_2weeks?: number; // minutes (présent seulement si joué récemment)
	img_icon_url?: string;
	rtime_last_played?: number; // unix
}

/** Un succès d'un joueur (GetPlayerAchievements). */
export interface SteamPlayerAchievement {
	apiname: string;
	achieved: number; // 0|1
	unlocktime: number; // unix, 0 si non débloqué
	name?: string; // libellé (avec l=...)
	description?: string;
}

/**
 * Succès enrichi : `SteamPlayerAchievement` + libellés lisibles résolus via le manifeste
 * IEVR (apiName `ACHIEVEMENT_NNNN` → fr/en/ja + trophyId), avec repli sur le libellé Steam.
 */
export interface IevrPlayerAchievement extends SteamPlayerAchievement {
	/** Identifiant texte du trophée (trophy_config), ou `null` si non mappé. */
	trophyId: string | null;
	/** Numéro interne (`TROPHY_INFO_N.int[1]`), ou `null` si non mappé. */
	num: number | null;
	/** Libellé lisible résolu (langue demandée → en → ja → libellé Steam → apiName). */
	displayName: string;
	/** Description lisible résolue (manifeste, sinon description Steam). */
	displayDescription?: string;
	/** `true` si l'apiName a été retrouvé dans le manifeste IEVR. */
	mapped: boolean;
}

/** Vue agrégée du compte d'un joueur pour IEVR. */
export interface SteamIevrAccount {
	summary: SteamPlayerSummary | null;
	/** Possession IEVR + temps de jeu, ou `null` si non possédé / profil privé. */
	ievr: SteamOwnedGame | null;
	/**
	 * Succès IEVR enrichis (apiName → fr/en/ja via le manifeste).
	 * Vide si profil privé, jeu non possédé, ou si l'on est en mode "token" (sans clé publisher).
	 */
	achievements: IevrPlayerAchievement[];
	/** Total renvoyé par Steam pour ce joueur (= succès *visibles* du schéma de l'app). */
	achievementsTotal: number;
	/** Nombre de succès débloqués (`achieved === 1`). */
	achievementsUnlocked: number;
	/**
	 * Comment les succès ont été obtenus :
	 * - "publisher" : via clé Web API (succès complets) ;
	 * - "token"     : via access_token de session (possession+playtime seuls, succès indisponibles) ;
	 * - "unavailable" : ni clé ni succès récupérables (profil privé, jeu non possédé…).
	 */
	achievementsMode: "publisher" | "token" | "unavailable";
	/** Référence : nombre de succès Steam visibles côté schéma app (mesuré). */
	visibleAchievementCount: number;
	/** Référence : nombre de trophées internes connus dans le manifeste IEVR. */
	manifestAchievementCount: number;
}

/** Client Steam Web API minimal, scopé sur l'app IEVR par défaut. */
export class SteamWebApiClient {
	private readonly key: string;
	private readonly host: string;
	private readonly fetchImpl: typeof fetch;
	private readonly appId: number;

	constructor(opts: {
		apiKey: string | undefined;
		appId?: number;
		host?: string;
		fetchImpl?: typeof fetch;
	}) {
		if (!opts.apiKey) {
			throw new SteamWebApiError(
				"missing_api_key",
				"STEAM_WEB_API_KEY absent : impossible d'interroger la Steam Web API.",
			);
		}
		this.key = opts.apiKey;
		this.appId = opts.appId ?? IEVR_STEAM_APP_ID;
		this.host = opts.host ?? STEAM_WEB_API_HOST;
		this.fetchImpl = opts.fetchImpl ?? fetch;
	}

	private async getJson<T>(path: string, params: Record<string, string>): Promise<T> {
		const url = new URL(`${this.host}${path}`);
		url.searchParams.set("key", this.key);
		url.searchParams.set("format", "json");
		for (const [k, v] of Object.entries(params)) {
			url.searchParams.set(k, v);
		}
		const resp = await this.fetchImpl(url.toString());
		if (!resp.ok) {
			throw new SteamWebApiError("http_error", `Steam Web API ${path} → HTTP ${resp.status}`);
		}
		return (await resp.json()) as T;
	}

	/** GetPlayerSummaries v0002 — profil public. */
	async getPlayerSummary(steamId64: string): Promise<SteamPlayerSummary | null> {
		const data = await this.getJson<{ response?: { players?: SteamPlayerSummary[] } }>(
			"/ISteamUser/GetPlayerSummaries/v0002/",
			{ steamids: steamId64 },
		);
		return data.response?.players?.[0] ?? null;
	}

	/**
	 * GetOwnedGames v0001 filtré sur l'app IEVR.
	 * `appids_filter` doit transiter en JSON (Service interface) → on l'encode via
	 * le param `input_json` documenté pour les interfaces de service.
	 */
	async getIevrOwnership(steamId64: string): Promise<SteamOwnedGame | null> {
		const inputJson = JSON.stringify({
			steamid: steamId64,
			include_appinfo: true,
			include_played_free_games: true,
			appids_filter: [this.appId],
		});
		const data = await this.getJson<{ response?: { games?: SteamOwnedGame[] } }>(
			"/IPlayerService/GetOwnedGames/v0001/",
			{
				steamid: steamId64,
				include_appinfo: "1",
				include_played_free_games: "1",
				input_json: inputJson,
			},
		);
		const games = data.response?.games ?? [];
		return games.find((g) => g.appid === this.appId) ?? null;
	}

	/**
	 * GetPlayerAchievements v0001 pour l'app IEVR.
	 * `l` = langue des libellés (ex. "french"). Renvoie `[]` si profil privé / jeu non possédé.
	 */
	async getIevrAchievements(
		steamId64: string,
		language = "french",
	): Promise<SteamPlayerAchievement[]> {
		const data = await this.getJson<{
			playerstats?: {
				success?: boolean;
				error?: string;
				achievements?: SteamPlayerAchievement[];
			};
		}>("/ISteamUserStats/GetPlayerAchievements/v0001/", {
			steamid: steamId64,
			appid: String(this.appId),
			l: language,
		});
		if (data.playerstats?.success !== true) {
			// Profil privé, jeu non possédé, ou aucun succès défini → liste vide.
			return [];
		}
		return data.playerstats.achievements ?? [];
	}

	/**
	 * GetUserStatsForGame v0002 pour l'app IEVR — stats brutes (UserGameStats).
	 * Côté "Steam Cloud" exploitable via Web API : ce sont les stats/achievements
	 * synchronisés. Les *fichiers* Steam Cloud (saves) ne sont PAS exposés par la Web API
	 * publique (ils transitent par ISteamRemoteStorage côté client natif, cf. SteamApi.cs).
	 */
	async getIevrUserStats(
		steamId64: string,
	): Promise<{ stats: Record<string, number>; achievements: Record<string, number> }> {
		const data = await this.getJson<{
			playerstats?: {
				stats?: { name: string; value: number }[];
				achievements?: { name: string; achieved: number }[];
			};
		}>("/ISteamUserStats/GetUserStatsForGame/v0002/", {
			steamid: steamId64,
			appid: String(this.appId),
		});
		const stats: Record<string, number> = {};
		for (const s of data.playerstats?.stats ?? []) {
			stats[s.name] = s.value;
		}
		const achievements: Record<string, number> = {};
		for (const a of data.playerstats?.achievements ?? []) {
			achievements[a.name] = a.achieved;
		}
		return { stats, achievements };
	}

	/**
	 * Vue agrégée complète du compte d'un joueur pour IEVR (mode "publisher" : clé Web API).
	 * Robuste : si une sous-requête échoue (profil privé), on dégrade sans tout casser.
	 * Les succès sont enrichis via le manifeste IEVR (apiName → fr/en/ja).
	 */
	async getIevrAccount(steamId64: string, language = "french"): Promise<SteamIevrAccount> {
		const [summary, ievr] = await Promise.all([
			this.getPlayerSummary(steamId64).catch(() => null),
			this.getIevrOwnership(steamId64).catch(() => null),
		]);

		let raw: SteamPlayerAchievement[] = [];
		let mode: SteamIevrAccount["achievementsMode"] = "unavailable";
		if (ievr) {
			raw = await this.getIevrAchievements(steamId64, language).catch(() => []);
			mode = raw.length > 0 ? "publisher" : "unavailable";
		}

		const achievements = enrichAchievements(raw, webApiLangToManifest(language));
		return {
			summary,
			ievr,
			achievements,
			achievementsTotal: achievements.length,
			achievementsUnlocked: achievements.filter((a) => a.achieved === 1).length,
			achievementsMode: mode,
			visibleAchievementCount: IEVR_VISIBLE_ACHIEVEMENT_COUNT,
			manifestAchievementCount: IEVR_ACHIEVEMENTS_COUNT,
		};
	}
}

/**
 * Mode "token" — possession + temps de jeu via un `access_token` de session utilisateur,
 * SANS clé publisher. Idéal après un login OpenID/OAuth où l'on dispose du token de l'utilisateur.
 *
 * `IPlayerService/GetOwnedGames` accepte `access_token=<token>` à la place de `key=` : Steam
 * répond avec les jeux du propriétaire du token (même profil privé), sans aucune clé.
 * ⚠️ Les SUCCÈS ne sont PAS accessibles par ce chemin (`GetPlayerAchievements` exige `key=`).
 *
 * @returns le jeu IEVR possédé (+ playtime) ou `null` si non possédé / token invalide.
 */
export async function getIevrOwnershipWithToken(opts: {
	accessToken: string;
	appId?: number;
	host?: string;
	fetchImpl?: typeof fetch;
}): Promise<SteamOwnedGame | null> {
	const appId = opts.appId ?? IEVR_STEAM_APP_ID;
	const host = opts.host ?? STEAM_WEB_API_HOST;
	const fetchImpl = opts.fetchImpl ?? fetch;
	const url = new URL(`${host}/IPlayerService/GetOwnedGames/v0001/`);
	url.searchParams.set("access_token", opts.accessToken);
	url.searchParams.set("include_appinfo", "1");
	url.searchParams.set("include_played_free_games", "1");
	url.searchParams.set("format", "json");
	url.searchParams.set(
		"input_json",
		JSON.stringify({
			include_appinfo: true,
			include_played_free_games: true,
			appids_filter: [appId],
		}),
	);
	const resp = await fetchImpl(url.toString());
	if (!resp.ok) {
		throw new SteamWebApiError(
			"http_error",
			`Steam Web API GetOwnedGames (token) → HTTP ${resp.status}`,
		);
	}
	const data = (await resp.json()) as { response?: { games?: SteamOwnedGame[] } };
	const games = data.response?.games ?? [];
	return games.find((g) => g.appid === appId) ?? null;
}

/** Convertit le code langue Web API ("french"/"english"…) vers le code manifeste ("fr"/"en"/"ja"). */
function webApiLangToManifest(language: string): AchievementLanguage {
	const l = language.toLowerCase();
	if (l.startsWith("japan") || l === "ja" || l === "jp") {
		return "ja";
	}
	if (l.startsWith("en")) {
		return "en";
	}
	// Par défaut français (langue privilégiée du wiki).
	return "fr";
}

/**
 * Enrichit une liste de succès Steam bruts avec les libellés lisibles du manifeste IEVR.
 * Pour chaque `apiname` (`ACHIEVEMENT_NNNN`), résout fr/en/ja + trophyId, avec repli sur le
 * libellé Steam puis sur l'apiName. Exporté pour usage hors client (mode token, tests).
 */
export function enrichAchievements(
	raw: SteamPlayerAchievement[],
	language: AchievementLanguage = "fr",
): IevrPlayerAchievement[] {
	return raw.map((a) => {
		const info: IevrAchievementInfo | null = lookupAchievement(a.apiname);
		const displayName =
			achievementDisplayName(info, language, a.name ?? a.apiname) ?? a.apiname;
		const displayDescription =
			achievementDisplayDescription(info, language) ?? a.description ?? undefined;
		return {
			...a,
			trophyId: info?.trophyId ?? null,
			num: info?.num ?? null,
			displayName,
			displayDescription,
			mapped: info !== null,
		};
	});
}
