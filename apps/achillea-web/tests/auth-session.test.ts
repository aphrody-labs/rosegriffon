import { afterEach, describe, expect, mock, test } from "bun:test";

import { AuthSessionService, safeReturnUrl } from "../src/app/core/auth/auth-session.service";

const originalFetch = globalThis.fetch;

afterEach(() => {
	globalThis.fetch = originalFetch;
});

describe("safeReturnUrl", () => {
	test("keeps local routes and rejects redirect bypasses", () => {
		expect(safeReturnUrl("/ranked?mode=solo#queue")).toBe("/ranked?mode=solo#queue");
		expect(safeReturnUrl("//evil.example")).toBe("/");
		expect(safeReturnUrl("/\\evil.example")).toBe("/");
		expect(safeReturnUrl("https://evil.example")).toBe("/");
		expect(safeReturnUrl("/safe\nLocation: https://evil.example")).toBe("/");
	});
});

describe("AuthSessionService", () => {
	test("deduplicates concurrent user loads and remembers anonymous state", async () => {
		const fetchMock = mock(() => Promise.resolve(new Response("", { status: 401 })));
		globalThis.fetch = fetchMock as typeof fetch;
		const service = new AuthSessionService();

		await Promise.all([service.loadUser(), service.loadUser(), service.loadUser()]);
		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(service.status()).toBe("anonymous");
		await service.loadUser();
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	test("distinguishes an API outage from an anonymous session", async () => {
		globalThis.fetch = mock(() => Promise.reject(new Error("offline"))) as typeof fetch;
		const service = new AuthSessionService();
		expect(await service.loadUser()).toBeUndefined();
		expect(service.status()).toBe("error");
	});

	test("caches the short-lived realtime token", async () => {
		const fetchMock = mock(() =>
			Promise.resolve(Response.json({ token: "realtime-token", expiresIn: 300 }))
		);
		globalThis.fetch = fetchMock as typeof fetch;
		const service = new AuthSessionService();
		expect(
			await Promise.all([
				service.getRealtimeToken(),
				service.getRealtimeToken(),
				service.getRealtimeToken(),
			])
		).toEqual(["realtime-token", "realtime-token", "realtime-token"]);
		expect(await service.getRealtimeToken()).toBe("realtime-token");
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});
});
