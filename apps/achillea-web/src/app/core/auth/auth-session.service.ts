import { Injectable, signal } from "@angular/core";

import { apiUrl } from "../http/api-url";
import type { AuthStatus, AuthUser } from "./auth.models";

const REALTIME_REFRESH_MARGIN_MS = 30_000;

export function safeReturnUrl(value: unknown, fallback = "/"): string {
	if (
		typeof value !== "string" ||
		value.length > 2_048 ||
		!value.startsWith("/") ||
		value.startsWith("//") ||
		value.includes("\\") ||
		/[\u0000-\u001f\u007f]/.test(value)
	) {
		return fallback;
	}

	try {
		return new URL(value, "https://achillea.invalid").origin === "https://achillea.invalid"
			? value
			: fallback;
	} catch {
		return fallback;
	}
}

@Injectable({ providedIn: "root" })
export class AuthSessionService {
	private readonly currentStatus = signal<AuthStatus>("unknown");
	private readonly currentUser = signal<AuthUser | undefined>(undefined);
	readonly status = this.currentStatus.asReadonly();
	readonly user = this.currentUser.asReadonly();

	private loadPromise: { generation: number; value: Promise<AuthUser | undefined> } | null = null;
	private realtimeTokenPromise: { generation: number; value: Promise<string | null> } | null = null;
	private realtimeToken: { value: string; expiresAt: number } | null = null;
	private generation = 0;

	async loadUser(force = false): Promise<AuthUser | undefined> {
		if (!force && this.status() === "authenticated") return this.user();
		if (!force && this.status() === "anonymous") return undefined;
		if (this.loadPromise?.generation === this.generation) return this.loadPromise.value;

		this.currentStatus.set("loading");
		const pending = {
			generation: this.generation,
			value: this.fetchUser(this.generation),
		};
		this.loadPromise = pending;
		try {
			return await pending.value;
		} finally {
			if (this.loadPromise === pending) this.loadPromise = null;
		}
	}

	private async fetchUser(generation: number): Promise<AuthUser | undefined> {
		try {
			const response = await fetch(apiUrl("/api/users/me"), {
				credentials: "include",
				headers: { Accept: "application/json" },
			});

			if (response.status === 401 || response.status === 403 || response.status === 404) {
				if (generation === this.generation) this.clearLocalSession("anonymous");
				return undefined;
			}
			if (!response.ok) throw new Error(`Auth API unavailable (${response.status})`);

			const candidate = (await response.json()) as Partial<AuthUser>;
			if (typeof candidate.id !== "string" || !candidate.id) {
				throw new Error("Auth API returned an invalid user");
			}

			const user = candidate as AuthUser;
			if (generation !== this.generation) return undefined;
			this.currentUser.set(user);
			this.currentStatus.set("authenticated");
			return user;
		} catch {
			if (generation === this.generation) {
				this.currentUser.set(undefined);
				this.currentStatus.set("error");
			}
			return undefined;
		}
	}

	login(returnUrl: unknown): void {
		const target = safeReturnUrl(returnUrl);
		window.location.assign(apiUrl(`/api/auth/discord?state=${encodeURIComponent(target)}`));
	}

	async logout(): Promise<boolean> {
		try {
			const response = await fetch(apiUrl("/api/auth/logout"), {
				method: "POST",
				credentials: "include",
				headers: { Accept: "application/json", "Content-Type": "application/json" },
				// Le proxy ranked Bun attend un ReadableStream pour les requêtes POST.
				// Un objet JSON vide évite son erreur sur un corps totalement absent.
				body: "{}",
			});
			if (!response.ok) return false;
			this.clearLocalSession("anonymous");
			return true;
		} catch {
			return false;
		}
	}

	async getRealtimeToken(): Promise<string | null> {
		if (this.realtimeToken?.expiresAt && this.realtimeToken.expiresAt > Date.now()) {
			return this.realtimeToken.value;
		}
		if (this.realtimeTokenPromise?.generation === this.generation) {
			return this.realtimeTokenPromise.value;
		}

		const generation = this.generation;
		const pending = { generation, value: this.fetchRealtimeToken(generation) };
		this.realtimeTokenPromise = pending;
		try {
			return await pending.value;
		} finally {
			if (this.realtimeTokenPromise === pending) this.realtimeTokenPromise = null;
		}
	}

	private async fetchRealtimeToken(generation: number): Promise<string | null> {
		try {
			const response = await fetch(apiUrl("/api/auth/token"), {
				credentials: "include",
				headers: { Accept: "application/json" },
			});
			if (!response.ok) {
				this.realtimeToken = null;
				return null;
			}
			const body = (await response.json()) as { token?: unknown; expiresIn?: unknown };
			if (typeof body.token !== "string" || !body.token) return null;
			if (generation !== this.generation) return null;
			const ttlSeconds = typeof body.expiresIn === "number" ? body.expiresIn : 300;
			this.realtimeToken = {
				value: body.token,
				expiresAt: Date.now() + Math.max(0, ttlSeconds * 1_000 - REALTIME_REFRESH_MARGIN_MS),
			};
			return body.token;
		} catch {
			return null;
		}
	}

	invalidate(): void {
		this.clearLocalSession("unknown");
	}

	patchUser(partial: Partial<AuthUser>): void {
		const user = this.currentUser();
		if (user) this.currentUser.set({ ...user, ...partial });
	}

	clearRealtimeToken(): void {
		this.realtimeToken = null;
	}

	private clearLocalSession(status: AuthStatus): void {
		this.generation += 1;
		this.currentUser.set(undefined);
		this.currentStatus.set(status);
		this.realtimeToken = null;
	}
}
