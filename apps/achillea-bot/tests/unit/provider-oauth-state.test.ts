import { describe, expect, test } from "bun:test";

import { parseProviderOAuthState } from "../../src/api/security/provider-oauth-state";

describe("provider OAuth state", () => {
	test("accepts only a Discord snowflake bound to the generated 24-byte nonce", () => {
		const valid = `123456789012345678:${"a".repeat(48)}`;
		expect(parseProviderOAuthState(valid)).toEqual({
			discordId: "123456789012345678",
			token: "a".repeat(48),
		});
		expect(parseProviderOAuthState(`123:${"a".repeat(48)}`)).toBeNull();
		expect(parseProviderOAuthState(`123456789012345678:${"a".repeat(47)}`)).toBeNull();
		expect(parseProviderOAuthState("123456789012345678:token:extra")).toBeNull();
	});
});
