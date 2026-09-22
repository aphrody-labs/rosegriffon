import crypto from "node:crypto";
import { agentAuth } from "@better-auth/agent-auth";
import { apiKey } from "@better-auth/api-key";
import { oauthProvider } from "@better-auth/oauth-provider";
import { betterAuth } from "better-auth";
import { admin, bearer, genericOAuth, jwt } from "better-auth/plugins";
import {
	commonAuthOptions,
	createAccountOptions,
	deuxFacteurs,
	ensureUserProfile,
	googleProvider,
	type AccountEmailSender,
} from "./index";

type BetterAuthDatabase = Parameters<typeof betterAuth>[0]["database"];

export interface PatreonAuthIntegration {
	authorizationUrl: string;
	tokenUrl: string;
	clientId: string;
	clientSecret: string;
	scopes: readonly string[];
	getUserInfo: (tokens: unknown) => Promise<{
		id: string | number;
		name?: string;
		email?: string | null;
		image?: string;
		emailVerified: boolean;
	} | null>;
	onAccountChanged?: (account: {
		id: string;
		userId: string;
		accountId: string;
		accessToken?: string | null;
		refreshToken?: string | null;
		accessTokenExpiresAt?: Date | null;
		scope?: string | null;
	}) => Promise<void>;
}

export interface RoseGriffonAuthOptions {
	database: BetterAuthDatabase;
	baseURL: string;
	secret: string;
	sendEmail: AccountEmailSender;
	executerSql?: (requete: string, parametres: unknown[]) => Promise<unknown>;
	nextCookiesPlugin?: unknown;
	patreon?: PatreonAuthIntegration;
}

/**
 * Single source of truth for the Rose Griffon website Better Auth instance.
 * App-specific transports are injected so this package stays independent of
 * Next.js path aliases and of the Patreon client implementation.
 */
export function createRoseGriffonAuth(options: RoseGriffonAuthOptions) {
	const patreon = options.patreon;
	const plugins = [
		admin({ defaultRole: "member", adminRoles: ["admin", "staff", "super_admin"] }),
		apiKey({
			defaultPrefix: "rg_",
			requireName: true,
			enableMetadata: true,
			rateLimit: { enabled: true, maxRequests: 1_000, timeWindow: 60 * 60 * 1_000 },
		}) as unknown as ReturnType<typeof admin>,
		jwt(),
		oauthProvider({ loginPage: "/login", consentPage: "/oauth/consent" }),
		agentAuth({
			providerName: "Rose Griffon",
			providerDescription: "Rose Griffon authentication and community capabilities.",
			deviceAuthorizationPage: "/device/capabilities",
			capabilities: [
				{
					name: "profile.read",
					description: "Read the authenticated Rose Griffon profile.",
					input: { type: "object", properties: {}, additionalProperties: false },
				},
			],
			onExecute: async ({ capability, agentSession }) => {
				if (capability !== "profile.read") throw new Error("Unsupported capability");
				return { user: agentSession.user };
			},
		}),
		deuxFacteurs("Rose Griffon"),
		bearer(),
		...(patreon
			? [
					genericOAuth({
						config: [
							{
								authorizationUrl: patreon.authorizationUrl,
								clientId: patreon.clientId,
								clientSecret: patreon.clientSecret,
								getUserInfo: patreon.getUserInfo as any,
								providerId: "patreon",
								scopes: [...patreon.scopes],
								tokenUrl: patreon.tokenUrl,
							},
						],
					}),
				]
			: []),
		...(options.nextCookiesPlugin ? [options.nextCookiesPlugin] : []),
	] as any[];

	return betterAuth({
		...commonAuthOptions,
		database: options.database,
		baseURL: options.baseURL,
		secret: options.secret,
		user: {
			...commonAuthOptions.user,
			...createAccountOptions({
				appName: "Rose Griffon",
				executerSql: options.executerSql,
				sendEmail: options.sendEmail,
			}),
		},
		emailAndPassword: {
			enabled: true,
			requireEmailVerification: true,
			minPasswordLength: 12,
			sendResetPassword: async ({ user, url }) => {
				await options.sendEmail({
					to: user.email,
					subject: "Réinitialiser ton mot de passe — Rose Griffon",
					html: `<p>Utilise ce lien pour réinitialiser ton mot de passe :</p><p><a href="${url}">Continuer</a></p>`,
				});
			},
		},
		emailVerification: {
			sendVerificationEmail: async ({ user, url }) => {
				await options.sendEmail({
					to: user.email,
					subject: "Confirme ton adresse — Rose Griffon",
					html: `<p>Confirme ton adresse email :</p><p><a href="${url}">Vérifier mon adresse</a></p>`,
				});
			},
		},
		socialProviders: {
			discord: {
				clientId: process.env.DISCORD_CLIENT_ID ?? "",
				clientSecret: process.env.DISCORD_CLIENT_SECRET ?? "",
				overrideUserInfoOnSignIn: true,
				prompt: "consent",
			},
			twitch: {
				clientId: process.env.TWITCH_AUTH_CLIENT_ID ?? process.env.TWITCH_CLIENT_ID ?? "",
				clientSecret: process.env.TWITCH_AUTH_CLIENT_SECRET ?? process.env.TWITCH_CLIENT_SECRET ?? "",
				scope: ["user:read:email", "user:read:follows", "user:read:subscriptions"],
			},
			...googleProvider,
		},
		account: {
			...commonAuthOptions.account,
			storeStateStrategy: "database",
			encryptOAuthTokens: true,
			accountLinking: {
				enabled: true,
				trustedProviders: ["discord", "google", "twitch", "patreon"],
			},
		},
		trustedOrigins: [
			"https://rosegriffon.fr",
			"https://www.rosegriffon.fr",
			"https://achillea.rosegriffon.fr",
			"https://ranked.rosegriffon.fr",
			"https://azalee.rosegriffon.fr",
			options.baseURL,
			"http://localhost:3000",
			"http://localhost:3001",
		].filter((value, index, values) => value && values.indexOf(value) === index),
		advanced: {
			...commonAuthOptions.advanced,
			database: { generateId: () => crypto.randomUUID() },
		},
		logger: {
			level: process.env.NODE_ENV === "production" ? "error" : "debug",
		},
		databaseHooks: {
			account: {
				create: { after: async (account) => { await patreon?.onAccountChanged?.(account); } },
				update: { after: async (account) => { await patreon?.onAccountChanged?.(account); } },
			},
			session: {
				create: {
					after: async (session) => {
						try {
							await ensureUserProfile(session.user as { id: string; name?: string | null; email?: string | null; image?: string | null }, undefined, { appName: "Rose Griffon" });
						} catch (error) {
							console.error("[auth] session profile sync failed", error);
						}
					},
				},
			},
			user: {
				create: {
					after: async (user) => {
						await ensureUserProfile(user);
					},
				},
			},
		},
		plugins,
	});
}

export type RoseGriffonAuth = ReturnType<typeof createRoseGriffonAuth>;
