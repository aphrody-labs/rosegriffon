/**
 * Tests AuthController — T-1.1
 *
 * Run: bun test tests/controllers/AuthController.test.ts
 */

import "reflect-metadata";

import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
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

	test("discordLogin redirects to the unified Rose Griffon login", async () => {
		// Wait a brief moment to ensure dependency resolution in controller constructor completes
		await new Promise((resolve) => setTimeout(resolve, 10));

		const redirectMock = mock(() => {});
		const mockRes = {
			redirect: redirectMock,
		} as any;

		authController.discordLogin("/profile", mockRes);

		expect(redirectMock.mock.calls.length).toBe(1);
		const redirectUrl = new URL(redirectMock.mock.calls[0][0]);
		expect(redirectUrl.pathname).toBe("/login");
		expect(redirectUrl.searchParams.get("redirect")).toBe("/profile");
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

	test("token relays the unified realtime-token endpoint", async () => {
		const body = { token: "unified-realtime-token", expiresIn: 300, userId: "42" };
		globalThis.fetch = mock(async () => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } })) as unknown as typeof fetch;
		const sendMock = mock(() => {});
		const mockRes = { status: mock(() => mockRes), setHeader: mock(() => mockRes), type: mock(() => mockRes), send: sendMock } as any;
		await authController.token({ headers: { cookie: "token=unified" } } as any, mockRes);
		expect(sendMock).toHaveBeenCalledTimes(1);
		expect(sendMock.mock.calls[0][0]).toContain("unified-realtime-token");
	});

	test("legacy callback routes to unified RG login without exchanging a Discord code", async () => {
		const redirectMock = mock(() => {});

		await authController.callback({ redirect: redirectMock });

		expect(redirectMock).toHaveBeenCalledTimes(1);
		const redirectUrl = new URL(redirectMock.mock.calls[0][0]);
		expect(redirectUrl.pathname).toBe("/login");
		expect(redirectUrl.searchParams.get("redirect")).toBe("/achillea");
		expect(mockUserService.syncWebUser).not.toHaveBeenCalled();
	});
});
