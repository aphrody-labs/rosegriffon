import type { z } from "zod";

import {
	achilleaGuildDetailSchema,
	achilleaGuildPageSchema,
	achilleaGuildStatsSchema,
	type AchilleaGuildDetail,
	type AchilleaGuildPage,
	type AchilleaGuildStats,
} from "./schemas";

export const DEFAULT_ACHILLEA_API_URL = "https://ranked.rosegriffon.fr/api";
export const DEFAULT_ACHILLEA_TIMEOUT_MS = 8000;

export type AchilleaClientFailure =
	| { ok: false; kind: "unreachable"; detail: string; path: string }
	| { ok: false; kind: "http"; detail: string; path: string; status: number }
	| { ok: false; kind: "invalid_json"; detail: string; path: string }
	| { ok: false; kind: "invalid_response"; detail: string; path: string };

export type AchilleaClientResult<T> = { ok: true; value: T } | AchilleaClientFailure;

export type AchilleaFetch = (
	input: string | URL | Request,
	init?: RequestInit
) => Promise<Response>;

export interface AchilleaClientOptions {
	/** API origin including its optional path prefix. Trailing slashes are ignored. */
	baseUrl?: string;
	/** Abort a request after this duration. Defaults to 8 seconds. */
	timeoutMs?: number;
	/** Injectable Fetch implementation for non-browser runtimes and tests. */
	fetch?: AchilleaFetch;
}

function errorDetail(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

function validationDetail(error: z.ZodError): string {
	const firstIssue = error.issues[0];
	if (!firstIssue) return "unexpected response structure";
	return `${firstIssue.path.join(".") || "(root)"} : ${firstIssue.message}`;
}

export class AchilleaClient {
	readonly baseUrl: string;
	readonly timeoutMs: number;
	readonly fetch: AchilleaFetch;

	constructor(options: AchilleaClientOptions = {}) {
		this.baseUrl = (options.baseUrl ?? DEFAULT_ACHILLEA_API_URL).replace(/\/+$/u, "");
		this.timeoutMs = options.timeoutMs ?? DEFAULT_ACHILLEA_TIMEOUT_MS;
		this.fetch = options.fetch ?? globalThis.fetch;
	}

	private async request<T>(path: string, schema: z.ZodType<T>): Promise<AchilleaClientResult<T>> {
		let response: Response;
		try {
			response = await this.fetch(`${this.baseUrl}${path}`, {
				headers: { Accept: "application/json" },
				signal: AbortSignal.timeout(this.timeoutMs),
			});
		} catch (error) {
			return { ok: false, kind: "unreachable", detail: errorDetail(error), path };
		}

		if (!response.ok) {
			return {
				ok: false,
				kind: "http",
				detail: `HTTP ${response.status} for ${path}`,
				path,
				status: response.status,
			};
		}

		let body: unknown;
		try {
			body = await response.json();
		} catch (error) {
			return {
				ok: false,
				kind: "invalid_json",
				detail: `unreadable response: ${errorDetail(error)}`,
				path,
			};
		}

		const parsed = schema.safeParse(body);
		if (!parsed.success) {
			return {
				ok: false,
				kind: "invalid_response",
				detail: validationDetail(parsed.error),
				path,
			};
		}

		return { ok: true, value: parsed.data };
	}

	/** `GET /guilds`: scanned guilds ordered by member count. */
	listGuilds(page = 1, limit = 25): Promise<AchilleaClientResult<AchilleaGuildPage>> {
		return this.request(`/guilds?page=${page}&limit=${limit}`, achilleaGuildPageSchema);
	}

	/** `GET /guilds/stats`: aggregates over all scanned guilds. */
	getGuildStats(): Promise<AchilleaClientResult<AchilleaGuildStats>> {
		return this.request("/guilds/stats", achilleaGuildStatsSchema);
	}

	/** `GET /guilds/:id`: guild details including roles and channels. */
	getGuild(id: string): Promise<AchilleaClientResult<AchilleaGuildDetail>> {
		return this.request(`/guilds/${encodeURIComponent(id)}`, achilleaGuildDetailSchema);
	}
}

export function createAchilleaClient(options: AchilleaClientOptions = {}): AchilleaClient {
	return new AchilleaClient(options);
}
