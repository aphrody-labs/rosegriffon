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
 * Toutes les méthodes exigent `STEAM_WEB_API_KEY` (clé Web API utilisateur, à obtenir sur
 * https://steamcommunity.com/dev/apikey). Sans clé → on lève `SteamWebApiError("missing_api_key")`
 * que l'appelant peut traiter en « configuration manquante » plutôt qu'en 500.
 *
 * Confidentialité : GetOwnedGames / GetPlayerAchievements ne renvoient des données que si le
 * profil Steam de l'utilisateur est public (ou si la clé appartient au même compte). On
 * remonte donc `null`/listes vides proprement quand la visibilité l'interdit.
 */

import { IEVR_STEAM_APP_ID, STEAM_WEB_API_HOST } from "./constants";

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

/** Vue agrégée du compte d'un joueur pour IEVR. */
export interface SteamIevrAccount {
	summary: SteamPlayerSummary | null;
	/** Possession IEVR + temps de jeu, ou `null` si non possédé / profil privé. */
	ievr: SteamOwnedGame | null;
	/** Succès IEVR (vide si profil privé ou jeu non possédé). */
	achievements: SteamPlayerAchievement[];
	achievementsTotal: number;
	achievementsUnlocked: number;
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
	 * Vue agrégée complète du compte d'un joueur pour IEVR.
	 * Robuste : si une sous-requête échoue (profil privé), on dégrade sans tout casser.
	 */
	async getIevrAccount(steamId64: string, language = "french"): Promise<SteamIevrAccount> {
		const [summary, ievr] = await Promise.all([
			this.getPlayerSummary(steamId64).catch(() => null),
			this.getIevrOwnership(steamId64).catch(() => null),
		]);

		let achievements: SteamPlayerAchievement[] = [];
		if (ievr) {
			achievements = await this.getIevrAchievements(steamId64, language).catch(() => []);
		}

		return {
			summary,
			ievr,
			achievements,
			achievementsTotal: achievements.length,
			achievementsUnlocked: achievements.filter((a) => a.achieved === 1).length,
		};
	}
}
