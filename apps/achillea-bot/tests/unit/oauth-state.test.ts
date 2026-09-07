import { describe, expect, test } from "bun:test";

import {
	createOAuthState,
	getCookieValue,
	isSafeInternalRedirect,
	OAUTH_STATE_COOKIE,
	verifyOAuthState,
} from "../../src/api/security/oauth-state";

describe("OAuth state security", () => {
	test("binds the signed redirect state to a browser nonce", () => {
		const { nonce, state } = createOAuthState("/ranked?queue=solo");
		expect(verifyOAuthState(state, `${OAUTH_STATE_COOKIE}=${nonce}`)).toBe("/ranked?queue=solo");
	});

	test("rejects a state replayed without the original browser cookie", () => {
		const { state } = createOAuthState("/ranked");
		expect(() => verifyOAuthState(state, `${OAUTH_STATE_COOKIE}=wrong`)).toThrow();
		expect(() => verifyOAuthState(state, undefined)).toThrow();
	});

	test("never signs a protocol-relative or backslash redirect", () => {
		expect(isSafeInternalRedirect("//evil.example")).toBe(false);
		expect(isSafeInternalRedirect("/\\evil.example")).toBe(false);
		expect(isSafeInternalRedirect("/safe")).toBe(true);

		const { nonce, state } = createOAuthState("//evil.example");
		expect(verifyOAuthState(state, `${OAUTH_STATE_COOKIE}=${nonce}`)).toBe("/");
	});

	test("handles malformed percent encoding in cookies without throwing", () => {
		expect(getCookieValue(`${OAUTH_STATE_COOKIE}=%ZZ`, OAUTH_STATE_COOKIE)).toBeNull();
	});
});
