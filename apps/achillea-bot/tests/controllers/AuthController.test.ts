/**
 * Tests AuthController — T-1.1
 *
 * Run: bun test tests/controllers/AuthController.test.ts
 */

import "reflect-metadata";

import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import jwt from "jsonwebtoken";
import { container } from "tsyringe";

class MockUserServiceClass {}
class MockOAuthServiceClass {}
class MockDatabaseClass {}
class MockStoreClass {}
class MockLoggerClass {}
class MockStatsClass {}
class MockCustomImagesUploadClass {}

mock.module("../../src/services", () => ({
	UserService: MockUserServiceClass,
	OAuthService: MockOAuthServiceClass,
	Database: MockDatabaseClass,
	Store: MockStoreClass,
	Logger: MockLoggerClass,
	Stats: MockStatsClass,
	CustomImagesUpload: MockCustomImagesUploadClass,
}));

mock.module("@/services", () => ({
	UserService: MockUserServiceClass,
	OAuthService: MockOAuthServiceClass,
	Database: MockDatabaseClass,
	Store: MockStoreClass,
	Logger: MockLoggerClass,
	Stats: MockStatsClass,
	CustomImagesUpload: MockCustomImagesUploadClass,
}));

// Mock database entities to prevent circular dependency ReferenceErrors on module load
const createMockEntity = (name: string) => {
	const cls = class {};
	Object.defineProperty(cls, "name", { value: name });
	return cls;
};

const entityNames = [
	"BaseEntity",
	"User",
	"Guild",
	"Data",
	"Stat",
	"Image",
	"Clan",
	"ClanMember",
	"ClanMemberHistory",
	"ClanInvite",
	"ClanApplication",
	"Vote",
	"VoteProposal",
	"Event",
	"Ranked",
	"RankedQueueEntry",
	"EventAnnouncement",
	"Lobby",
	"LobbyUser",
	"LobbyMatch",
	"OauthCsrf",
	"UserConnection",
	"Rank",
	"UserElo",
	"Experience",
	"UserExperience",
	"ClanExperience",
	"ClanExperienceLog",
	"UserExperienceLog",
	"UserView",
	"ClanTeamMember",
	"ClanTeam",
	"Interclan",
	"InterclanLineup",
	"InterclanLineupMember",
	"Blacklist",
	"Organization",
	"OrganizationManager",
	"Notification",
	"UserNotification",
	"OrganizationValidation",
	"Tournament",
	"TournamentParticipant",
	"TournamentSeries",
	"AuditLog",
	"Sanction",
	"CastEvent",
	"CastSlot",
	"CastAvailability",
	"CastAttribution",
	"Ruleset",
	"License",
	"TournamentPhase",
	"Season",
	"Wallet",
	"Transaction",
];

const mockEntitiesTarget: Record<string, any> = {
	__esModule: true,
};

for (const name of entityNames) {
	mockEntitiesTarget[name] = createMockEntity(name);
}

const mockEntities = new Proxy(mockEntitiesTarget, {
	get: (target, prop) => {
		if (prop === "__esModule") return true;
		if (prop in target) return target[prop as string];
		return createMockEntity(String(prop));
	},
	ownKeys: (target) => {
		return Reflect.ownKeys(target);
	},
	getOwnPropertyDescriptor: (target, prop) => {
		return {
			enumerable: true,
			configurable: true,
			value: target[prop as string] || createMockEntity(String(prop)),
		};
	},
});

mock.module(import.meta.resolve("@/entities"), () => mockEntities);
mock.module(import.meta.resolve("../../src/entities/Data"), () => ({
	defaultData: {},
	Data: mockEntities.Data,
}));
mock.module(import.meta.resolve("../../src/entities/ClanTeam"), () => ({
	ClanTeam: mockEntities.ClanTeam,
}));

// Mock to avoid heavy discord/dependency side effects
mock.module("@aphrody/discordx", () => {
	const dummyDecorator = () => (target: unknown, propertyKey?: string, descriptor?: any) => {};
	return {
		Client: class MockClient {},
		singleton: () => (target: unknown) => target,
		DOn: {
			create: () => ({
				decorate: () => ({}),
			}),
		},
		MetadataStorage: {
			instance: {
				addOn: () => {},
			},
		},
		SimpleCommandMessage: class MockSimpleCommandMessage {},
		Bot: dummyDecorator,
		ButtonComponent: dummyDecorator,
		Discord: dummyDecorator,
		Guard: dummyDecorator,
		Guild: dummyDecorator,
		ModalComponent: dummyDecorator,
		SelectMenuComponent: dummyDecorator,
		SimpleCommand: dummyDecorator,
		SimpleCommandOption: dummyDecorator,
	};
});

// original describe block begins here

describe("AuthController", () => {
	let authController: any;
	let mockUserService: any;
	let mockOAuthService: any;
	let originalFetch: typeof globalThis.fetch;

	beforeEach(async () => {
		originalFetch = globalThis.fetch;

		// Mock service implementations
		mockUserService = {
			syncWebUser: mock(() => Promise.resolve({ id: "123", username: "testuser" })),
			toDTO: mock((user: any) => Promise.resolve(user)),
		};

		mockOAuthService = {
			getChallongeOAuthUrl: mock(() => Promise.resolve("https://challonge.com/oauth")),
			getTwitchOAuthUrl: mock(() => Promise.resolve("https://twitch.tv/oauth")),
		};

		// Register mocked instances in container
		container.registerInstance(MockUserServiceClass as any, mockUserService);
		container.registerInstance(MockOAuthServiceClass as any, mockOAuthService);

		// Dynamically import AuthController so that it uses the mocked services
		const authModule = await import("../../src/api/controllers/auth");
		authController = new authModule.AuthController();
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
		container.clearInstances();
	});

	test("discordLogin redirects to Discord OAuth page", async () => {
		// Wait a brief moment to ensure dependency resolution in controller constructor completes
		await new Promise((resolve) => setTimeout(resolve, 10));

		const redirectMock = mock(() => {});
		const cookieMock = mock(() => {});
		const mockRes = {
			cookie: cookieMock,
			redirect: redirectMock,
		} as any;

		authController.discordLogin("/profile", mockRes);

		expect(redirectMock.mock.calls.length).toBe(1);
		expect(cookieMock.mock.calls.length).toBe(1);
		const redirectUrl = new URL(redirectMock.mock.calls[0][0]);
		expect(redirectUrl.origin).toBe("https://discord.com");
		expect(redirectUrl.searchParams.get("client_id")).toBeTruthy();
		expect(redirectUrl.searchParams.get("redirect_uri")).not.toContain("evil.example");
		expect(redirectUrl.searchParams.get("state")).not.toBe("/profile");
	});

	test("logout clears cookie and returns ok", () => {
		const clearCookieMock = mock(() => {});
		const jsonMock = mock(() => {});
		const mockRes = {
			clearCookie: clearCookieMock,
			setHeader: mock(() => {}),
			json: jsonMock,
		} as any;

		authController.logout(mockRes);

		expect(clearCookieMock.mock.calls.length).toBe(1);
		expect(clearCookieMock.mock.calls[0][0]).toBe("token");
		expect(jsonMock.mock.calls.length).toBe(1);
		expect(jsonMock.mock.calls[0][0]).toEqual({ ok: true });
	});

	test("token returns a short-lived realtime token instead of the session cookie", () => {
		const jsonMock = mock(() => {});
		const mockRes = { setHeader: mock(() => {}), json: jsonMock } as any;
		const ctx = {
			get: mock(() => ({ id: "42", username: "realtime-user", avatar: "hash" })),
		} as any;

		authController.token(ctx, mockRes);

		expect(jsonMock).toHaveBeenCalledTimes(1);
		const body = jsonMock.mock.calls[0][0] as { token: string; expiresIn: number; userId: string };
		expect(body.expiresIn).toBe(300);
		expect(body.userId).toBe("42");
		const decoded = jwt.decode(body.token) as jwt.JwtPayload & { tokenUse: string };
		expect(decoded.tokenUse).toBe("realtime");
		expect(decoded.aud).toBe("achillea-realtime");
	});

	test("callback exchanges code, syncs user, sets session cookie and redirects", async () => {
		// Wait for constructor dependency resolution
		await new Promise((resolve) => setTimeout(resolve, 10));

		// Mock Discord APIs fetch
		globalThis.fetch = mock((url: string, init?: any) => {
			if (url.includes("oauth2/token")) {
				return Promise.resolve({
					ok: true,
					json: () => Promise.resolve({ access_token: "mock-access-token" }),
				} as any);
			}
			if (url.includes("users/@me")) {
				return Promise.resolve({
					ok: true,
					json: () =>
						Promise.resolve({
							id: "98765432109876543",
							username: "discorduser",
							avatar: "avatar_hash",
						}),
				} as any);
			}
			return Promise.reject(new Error(`Unknown fetch target: ${url}`));
		}) as any;

		const cookieMock = mock(() => {});
		const redirectMock = mock(() => {});
		const mockRes = {
			cookie: cookieMock,
			redirect: redirectMock,
		} as any;
		const { createOAuthState, OAUTH_STATE_COOKIE } =
			await import("../../src/api/security/oauth-state");
		const oauthState = createOAuthState("/clans");

		await authController.callback(
			"some-auth-code",
			oauthState.state,
			`${OAUTH_STATE_COOKIE}=${oauthState.nonce}`,
			mockRes
		);

		// Verify fetch calls
		expect(globalThis.fetch).toHaveBeenCalled();

		// Verify syncWebUser was called with Discord ID
		expect(mockUserService.syncWebUser).toHaveBeenCalledWith("98765432109876543");

		// Verify session token cookie was set
		expect(cookieMock.mock.calls.length).toBe(1);
		expect(cookieMock.mock.calls[0][0]).toBe("token");
		expect(cookieMock.mock.calls[0][1]).toBeDefined(); // JWT token
		expect(cookieMock.mock.calls[0][2].httpOnly).toBe(true);
		// Une seule mutation de cookie doit traverser le proxy Bun : le nonce CSRF
		// court expire naturellement, la session ne doit jamais être le 2e Set-Cookie.
		expect(cookieMock.mock.calls.length).toBe(1);

		// Verify redirect to safe state
		expect(redirectMock.mock.calls.length).toBe(1);
		expect(redirectMock.mock.calls[0][0]).toBe("/clans");
	});

	test("callback redirects with a notice when the user denies the authorization", async () => {
		globalThis.fetch = mock(() => Promise.reject(new Error("must not be called"))) as any;
		const { createOAuthState, OAUTH_STATE_COOKIE } =
			await import("../../src/api/security/oauth-state");
		const oauthState = createOAuthState("/ranked");
		const redirectMock = mock(() => {});
		const statusMock = mock(() => ({ send: mock(() => {}) }));
		const mockRes = { redirect: redirectMock, status: statusMock } as any;

		await authController.callback(
			"",
			oauthState.state,
			`${OAUTH_STATE_COOKIE}=${oauthState.nonce}`,
			mockRes,
			"access_denied",
			"The resource owner or authorization server denied the request"
		);

		expect(statusMock).not.toHaveBeenCalled();
		expect(redirectMock.mock.calls[0][0]).toBe("/ranked?auth=denied");
		expect(globalThis.fetch).not.toHaveBeenCalled();
	});

	test("callback without code nor state falls back to the home page with a notice", async () => {
		globalThis.fetch = mock(() => Promise.reject(new Error("must not be called"))) as any;
		const redirectMock = mock(() => {});
		const mockRes = { redirect: redirectMock } as any;

		await authController.callback("", "", "", mockRes);

		expect(redirectMock.mock.calls[0][0]).toBe("/?auth=error");
	});

	test("callback rejects a state that is not bound to the browser cookie", async () => {
		globalThis.fetch = mock(() => Promise.reject(new Error("must not be called"))) as any;
		const { createOAuthState, OAUTH_STATE_COOKIE } =
			await import("../../src/api/security/oauth-state");
		const oauthState = createOAuthState("/clans");
		const sendMock = mock(() => {});
		const mockRes = { send: sendMock } as any;
		const statusMock = mock(() => mockRes);
		mockRes.status = statusMock;

		await authController.callback(
			"some-auth-code",
			oauthState.state,
			`${OAUTH_STATE_COOKIE}=attacker-nonce`,
			mockRes
		);

		expect(statusMock).toHaveBeenCalledWith(400);
		expect(globalThis.fetch).not.toHaveBeenCalled();
	});
});
