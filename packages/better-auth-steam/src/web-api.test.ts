import { describe, expect, test } from "bun:test";

import { IEVR_STEAM_APP_ID } from "./constants";
import {
	enrichAchievements,
	getIevrOwnershipWithToken,
	type SteamPlayerAchievement,
	SteamWebApiClient,
	SteamWebApiError,
} from "./web-api";

const STEAMID = "76561197960434622";

/** Construit un `fetch` factice qui route par chemin d'URL et journalise les appels. */
function makeFetch(routes: Record<string, unknown>, calls: URL[] = []) {
	return (async (input: string | URL) => {
		const url = new URL(typeof input === "string" ? input : input.toString());
		calls.push(url);
		for (const [path, body] of Object.entries(routes)) {
			if (url.pathname.includes(path)) {
				return new Response(JSON.stringify(body), { status: 200 });
			}
		}
		return new Response("not found", { status: 404 });
	}) as unknown as typeof fetch;
}

describe("enrichAchievements (apiName → libellés du manifeste)", () => {
	test("mappe un ACHIEVEMENT_NNNN connu vers fr + trophyId + num", () => {
		const raw: SteamPlayerAchievement[] = [
			{ apiname: "ACHIEVEMENT_0001", achieved: 1, unlocktime: 1700000000 },
		];
		const [a] = enrichAchievements(raw, "fr");
		expect(a?.mapped).toBe(true);
		expect(a?.num).toBe(1);
		expect(a?.trophyId).toBe("activity_story_miniquest_001");
		expect(a?.displayName).toBe("Vieil homme qui a perdu sa clé");
		expect(a?.achieved).toBe(1);
	});

	test("repli sur le libellé Steam puis l'apiName quand non mappé", () => {
		const raw: SteamPlayerAchievement[] = [
			{ apiname: "ACHIEVEMENT_9999", achieved: 0, unlocktime: 0, name: "Libellé Steam brut" },
			{ apiname: "ACHIEVEMENT_8888", achieved: 0, unlocktime: 0 },
		];
		const enriched = enrichAchievements(raw, "fr");
		expect(enriched[0]?.mapped).toBe(false);
		expect(enriched[0]?.displayName).toBe("Libellé Steam brut");
		expect(enriched[1]?.displayName).toBe("ACHIEVEMENT_8888");
	});
});

describe("SteamWebApiClient — mode publisher (key=)", () => {
	test("construit chaque requête avec la clé et l'app IEVR", async () => {
		const calls: URL[] = [];
		const client = new SteamWebApiClient({
			apiKey: "PUBKEY",
			fetchImpl: makeFetch(
				{
					"/GetPlayerSummaries/": { response: { players: [{ steamid: STEAMID, personaname: "Mark" }] } },
					"/GetOwnedGames/": {
						response: {
							games: [{ appid: IEVR_STEAM_APP_ID, name: "IEVR", playtime_forever: 1234 }],
						},
					},
					"/GetPlayerAchievements/": {
						playerstats: {
							success: true,
							achievements: [
								{ apiname: "ACHIEVEMENT_0001", achieved: 1, unlocktime: 1700000000 },
								{ apiname: "ACHIEVEMENT_0002", achieved: 0, unlocktime: 0 },
							],
						},
					},
				},
				calls,
			),
		});

		const acct = await client.getIevrAccount(STEAMID, "french");
		expect(acct.summary?.personaname).toBe("Mark");
		expect(acct.ievr?.playtime_forever).toBe(1234);
		expect(acct.achievementsMode).toBe("publisher");
		expect(acct.achievementsTotal).toBe(2);
		expect(acct.achievementsUnlocked).toBe(1);
		expect(acct.achievements[0]?.displayName).toBe("Vieil homme qui a perdu sa clé");
		// la clé publisher est bien transmise sur toutes les requêtes
		expect(calls.every((u) => u.searchParams.get("key") === "PUBKEY")).toBe(true);
	});

	test("profil privé / jeu non possédé → mode unavailable, listes vides", async () => {
		const client = new SteamWebApiClient({
			apiKey: "PUBKEY",
			fetchImpl: makeFetch({
				"/GetPlayerSummaries/": { response: { players: [{ steamid: STEAMID, personaname: "X" }] } },
				"/GetOwnedGames/": { response: { games: [] } },
				"/GetPlayerAchievements/": { playerstats: { success: false, error: "Profile is private" } },
			}),
		});
		const acct = await client.getIevrAccount(STEAMID);
		expect(acct.ievr).toBeNull();
		expect(acct.achievementsMode).toBe("unavailable");
		expect(acct.achievements).toHaveLength(0);
		expect(acct.achievementsUnlocked).toBe(0);
	});

	test("constructeur sans clé → SteamWebApiError(missing_api_key)", () => {
		expect(() => new SteamWebApiClient({ apiKey: undefined })).toThrow(SteamWebApiError);
	});
});

describe("getIevrOwnershipWithToken — mode token (access_token=, sans clé)", () => {
	test("envoie access_token (pas key) et renvoie la possession IEVR", async () => {
		const calls: URL[] = [];
		const ownership = await getIevrOwnershipWithToken({
			accessToken: "SESSION_TOKEN",
			fetchImpl: makeFetch(
				{
					"/GetOwnedGames/": {
						response: {
							games: [{ appid: IEVR_STEAM_APP_ID, name: "IEVR", playtime_forever: 42 }],
						},
					},
				},
				calls,
			),
		});
		expect(ownership?.appid).toBe(IEVR_STEAM_APP_ID);
		expect(ownership?.playtime_forever).toBe(42);
		const u = calls[0];
		expect(u?.searchParams.get("access_token")).toBe("SESSION_TOKEN");
		expect(u?.searchParams.get("key")).toBeNull();
	});

	test("jeu non possédé → null", async () => {
		const ownership = await getIevrOwnershipWithToken({
			accessToken: "SESSION_TOKEN",
			fetchImpl: makeFetch({ "/GetOwnedGames/": { response: { games: [] } } }),
		});
		expect(ownership).toBeNull();
	});

	test("HTTP non-OK → SteamWebApiError(http_error)", async () => {
		const failing = (async () => new Response("nope", { status: 500 })) as unknown as typeof fetch;
		await expect(
			getIevrOwnershipWithToken({ accessToken: "T", fetchImpl: failing }),
		).rejects.toBeInstanceOf(SteamWebApiError);
	});
});
