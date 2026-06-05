import { describe, expect, test } from "bun:test";

import { extractSteamId64 } from "./constants";
import { buildSteamLoginUrl, verifySteamAssertion } from "./openid";

describe("extractSteamId64", () => {
	test("extrait le SteamID64 d'un claimed_id valide", () => {
		expect(
			extractSteamId64("https://steamcommunity.com/openid/id/76561197960434622"),
		).toBe("76561197960434622");
	});

	test("rejette un host non-Steam", () => {
		expect(extractSteamId64("https://evil.example/openid/id/76561197960434622")).toBeNull();
	});

	test("rejette un id non numérique", () => {
		expect(extractSteamId64("https://steamcommunity.com/openid/id/notanid")).toBeNull();
	});

	test("null/undefined → null", () => {
		expect(extractSteamId64(null)).toBeNull();
		expect(extractSteamId64(undefined)).toBeNull();
	});
});

describe("buildSteamLoginUrl", () => {
	test("construit une requête checkid_setup avec identifier_select", () => {
		const url = new URL(
			buildSteamLoginUrl("https://rosegriffon.fr/api/auth/steam/callback", "https://rosegriffon.fr"),
		);
		expect(url.origin + url.pathname).toBe("https://steamcommunity.com/openid/login");
		expect(url.searchParams.get("openid.mode")).toBe("checkid_setup");
		expect(url.searchParams.get("openid.ns")).toBe("http://specs.openid.net/auth/2.0");
		expect(url.searchParams.get("openid.identity")).toBe(
			"http://specs.openid.net/auth/2.0/identifier_select",
		);
		expect(url.searchParams.get("openid.claimed_id")).toBe(
			"http://specs.openid.net/auth/2.0/identifier_select",
		);
		expect(url.searchParams.get("openid.realm")).toBe("https://rosegriffon.fr");
		expect(url.searchParams.get("openid.return_to")).toBe(
			"https://rosegriffon.fr/api/auth/steam/callback",
		);
	});
});

describe("verifySteamAssertion", () => {
	const returnTo = "https://rosegriffon.fr/api/auth/steam/callback";
	const buildQuery = (mode: string) =>
		new URLSearchParams({
			"openid.mode": mode,
			"openid.return_to": returnTo,
			"openid.claimed_id": "https://steamcommunity.com/openid/id/76561197960434622",
			"openid.identity": "https://steamcommunity.com/openid/id/76561197960434622",
			"openid.sig": "deadbeef",
		});

	test("retourne le SteamID64 quand Steam confirme is_valid:true", async () => {
		const fakeFetch = (async () =>
			new Response("ns:http://specs.openid.net/auth/2.0\nis_valid:true\n", {
				status: 200,
			})) as unknown as typeof fetch;
		const id = await verifySteamAssertion(buildQuery("id_res"), returnTo, fakeFetch);
		expect(id).toBe("76561197960434622");
	});

	test("retourne null quand is_valid:false", async () => {
		const fakeFetch = (async () =>
			new Response("ns:http://specs.openid.net/auth/2.0\nis_valid:false\n", {
				status: 200,
			})) as unknown as typeof fetch;
		const id = await verifySteamAssertion(buildQuery("id_res"), returnTo, fakeFetch);
		expect(id).toBeNull();
	});

	test("rejette un mode != id_res sans appel réseau", async () => {
		let called = false;
		const fakeFetch = (async () => {
			called = true;
			return new Response("is_valid:true", { status: 200 });
		}) as unknown as typeof fetch;
		const id = await verifySteamAssertion(buildQuery("cancel"), returnTo, fakeFetch);
		expect(id).toBeNull();
		expect(called).toBe(false);
	});

	test("rejette un return_to qui ne correspond pas (anti-replay)", async () => {
		const fakeFetch = (async () =>
			new Response("is_valid:true", { status: 200 })) as unknown as typeof fetch;
		const id = await verifySteamAssertion(
			buildQuery("id_res"),
			"https://rosegriffon.fr/autre",
			fakeFetch,
		);
		expect(id).toBeNull();
	});
});
